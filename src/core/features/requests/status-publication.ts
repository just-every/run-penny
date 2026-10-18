import type { DatabaseConnection } from '@/core/platform/database'
import type { PublicRequestStatus } from '@/core/shared/api/public'
import { createRequestId } from './lifecycle-ids'
import { RequestLifecycleError } from './lifecycle-types'
import { requestStatusExpression } from './status-sql'

export interface StatusPublication {
 readonly slug:string; readonly operatorId:string; readonly status:PublicRequestStatus
 readonly body:string; readonly pinned:boolean; readonly now:string; readonly appOrigin?:string
 readonly idempotencyKey?:string; readonly internalStatusId?:string|null; readonly publicEta?:string|null
}

export async function publishStatusUpdate(connection:DatabaseConnection,input:StatusPublication):Promise<void> {
 const db=connection.binding
 const request=await db.prepare('SELECT id FROM requests WHERE slug=?').bind(input.slug).first<{id:string}>()
 if(!request)throw new RequestLifecycleError(404,'not_found','The published request does not exist.')
 if(input.status==='declined'&&!input.body.trim())throw new RequestLifecycleError(400,'decline_reason_required','Declining a request requires a public reason.')
 if(input.internalStatusId&&!await db.prepare('SELECT id FROM request_internal_statuses WHERE id=? AND public_status=?').bind(input.internalStatusId,input.status).first())
  throw new RequestLifecycleError(400,'invalid_internal_status','Choose an internal status mapped to this public status.')
 const id=createRequestId(),etaSupplied=input.publicEta!==undefined?1:0,key=input.idempotencyKey??null
 const results=await db.batch([
  db.prepare(`INSERT INTO request_status_updates
   (id,request_id,public_status,previous_public_state,body,pinned,operator_id,published_at,created_at,updated_at,action_key,publication_version,public_eta,internal_status_id,previous_status_source,previous_direct_status_changed_at,previous_internal_status_id)
   SELECT ?,r.id,?,CASE WHEN ?='declined' THEN CASE WHEN r.public_state='declined' THEN
    (SELECT previous_public_state FROM request_status_updates WHERE request_id=r.id AND public_status='declined' AND previous_public_state!='declined' ORDER BY publication_version DESC,published_at DESC,id DESC LIMIT 1)
    ELSE r.public_state END ELSE NULL END,?,?,?,?,?,?,?,
    (SELECT COALESCE(MAX(publication_version),0)+1 FROM request_status_updates WHERE request_id=r.id),CASE WHEN ?=1 THEN ? ELSE r.public_eta END,?,CASE WHEN r.public_state='declined' THEN
    (SELECT previous_status_source FROM request_status_updates WHERE request_id=r.id AND public_status='declined' ORDER BY publication_version DESC,published_at DESC,id DESC LIMIT 1)
    ELSE r.latest_status_source END,
   CASE WHEN r.public_state='declined' THEN
    (SELECT previous_direct_status_changed_at FROM request_status_updates WHERE request_id=r.id AND public_status='declined' ORDER BY publication_version DESC,published_at DESC,id DESC LIMIT 1)
    ELSE r.direct_status_changed_at END,
   CASE WHEN r.public_state='declined' THEN
    (SELECT previous_internal_status_id FROM request_status_updates WHERE request_id=r.id AND public_status='declined' ORDER BY publication_version DESC,published_at DESC,id DESC LIMIT 1)
    ELSE r.internal_status_id END
   FROM requests r JOIN boards b ON b.id=r.board_id LEFT JOIN requesters author ON author.id=r.author_requester_id
   WHERE r.id=? AND b.visibility='public' AND r.moderation_state='approved' AND r.published_at IS NOT NULL
    AND r.withdrawn_at IS NULL AND r.merged_into_request_id IS NULL AND (author.id IS NULL OR author.blocked_at IS NULL)
    AND (? IS NULL OR EXISTS(SELECT 1 FROM request_internal_statuses WHERE id=? AND public_status=?))
    AND NOT EXISTS(SELECT 1 FROM request_status_updates WHERE request_id=r.id AND action_key=?)
    AND (${requestStatusExpression}!=? OR r.internal_status_id IS NOT ? OR (?=1 AND r.public_eta IS NOT ?) OR
     (?!='' AND NOT EXISTS(SELECT 1 FROM request_status_updates WHERE id=(SELECT id FROM request_status_updates WHERE request_id=r.id
       ORDER BY COALESCE(publication_version,0) DESC,published_at DESC,id DESC LIMIT 1) AND public_status=? AND body=? AND pinned=?)))
   RETURNING 1 AS affected`)
   .bind(id,input.status,input.status,input.body,input.pinned?1:0,input.operatorId,input.now,input.now,input.now,key,etaSupplied,input.publicEta??null,input.internalStatusId??null,
    request.id,input.internalStatusId??null,input.internalStatusId??null,input.status,key,input.status,input.internalStatusId??null,etaSupplied,input.publicEta??null,input.body,input.status,input.body,input.pinned?1:0),
  db.prepare(`UPDATE requests SET public_state=?,internal_status_id=?,public_eta=(SELECT public_eta FROM request_status_updates WHERE id=?),
   latest_status_source='direct',direct_status_changed_at=?,declined_reason=CASE WHEN ?='declined' THEN ? ELSE NULL END,updated_at=?
   WHERE id=? AND EXISTS(SELECT 1 FROM request_status_updates WHERE id=?)`)
   .bind(input.status,input.internalStatusId??null,id,input.now,input.status,input.body,input.now,request.id,id),
  db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at)
   SELECT ?,'operator',?,'request.status_changed','request',?,?,?,? WHERE EXISTS(SELECT 1 FROM request_status_updates WHERE id=?)`)
   .bind(createRequestId(),input.operatorId,request.id,input.now,input.now,input.now,id),
  db.prepare(`SELECT public_status AS status,body,pinned,internal_status_id AS internalStatusId,public_eta AS publicEta FROM request_status_updates
   WHERE request_id=? AND action_key=?`).bind(request.id,key),
  db.prepare(`SELECT ${requestStatusExpression} AS status,r.public_eta AS publicEta,r.internal_status_id AS internalStatusId
   FROM requests r JOIN boards b ON b.id=r.board_id WHERE r.id=? AND b.visibility='public' AND r.moderation_state='approved'
    AND r.published_at IS NOT NULL AND r.withdrawn_at IS NULL AND r.merged_into_request_id IS NULL`).bind(request.id),
 ])
 if(results[0].results.length)return
 const replay=results[3].results[0] as {status:string;body:string;pinned:number;internalStatusId:string|null;publicEta:string|null}|undefined
 if(replay){
  if(replay.status===input.status&&replay.body===input.body&&replay.pinned===Number(input.pinned)&&replay.internalStatusId===(input.internalStatusId??null)&&(!etaSupplied||replay.publicEta===(input.publicEta??null)))return
  throw new RequestLifecycleError(409,'idempotency_conflict','This publication action was already used for a different update.')
 }
 const current=results[4].results[0] as {status:string;publicEta:string|null;internalStatusId:string|null}|undefined
 if(current&&current.status===input.status&&current.internalStatusId===(input.internalStatusId??null)&&(!etaSupplied||current.publicEta===(input.publicEta??null)))return
 throw new RequestLifecycleError(404,'not_found','The published request changed before the update.')
}
