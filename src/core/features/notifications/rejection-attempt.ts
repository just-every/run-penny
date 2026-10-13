import { createUlid } from '@/core/shared/ulid'
import { retryAt } from './attempt-policy'
export interface RejectionIntent {id:string;attemptCount:number;firstAttemptAt:string|null}
export type RejectionState='accepted'|'suppressed'|'unknown'|'failed'|'queued'
/** Audit has stable intent/attempt IDs and no address, reason or submitted text. */
export function rejectionAudit(db:D1Database,id:string,claim:string,at:string,state:string,reason:string|null){
 return db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,details_json,occurred_at,created_at,updated_at)
 SELECT ?,'system','moderation_rejection_mail','moderation.rejection_mail','notification',?,json_object('attemptId',?,'state',?,'reason',?),?,?,?
 WHERE EXISTS(SELECT 1 FROM notification_outbox WHERE id=? AND claim_id=?)`)
 .bind(createUlid(),id,claim,state,reason,at,at,at,id,claim)
}
export function settleRejection(db:D1Database,row:RejectionIntent,claim:string,clock:()=>number){
 return async(state:RejectionState,reason:string|null,receipt:string|null=null,attemptState:string=state,deferred=false)=>{
  const at=new Date(clock()).toISOString()
  await db.batch([
   rejectionAudit(db,row.id,claim,at,attemptState,reason),
   db.prepare("UPDATE notification_outbox_attempts SET state=?,failure_reason=?,provider_message_id=COALESCE(provider_message_id,?),updated_at=? WHERE id=? AND state='sending'").bind(attemptState,reason,receipt,at,claim),
   db.prepare(`UPDATE notification_outbox SET delivery_state=?,failure_reason=?,provider_message_id=COALESCE(provider_message_id,?),available_at=?,updated_at=?,
    claim_id=CASE WHEN ?='queued' THEN NULL ELSE claim_id END,attempt_count=attempt_count-?,accepted_at=CASE WHEN ?='accepted' THEN COALESCE(accepted_at,?) ELSE accepted_at END
    WHERE id=? AND claim_id=? AND delivery_state='queued'`).bind(state,reason,receipt,state==='queued'?retryAt(clock(),row.attemptCount):at,at,state,deferred?1:0,state,at,row.id,claim),
  ])
 }
}
export async function recoverRejections(db:D1Database,now:string,cutoff:string){
 await db.batch([
  db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,details_json,occurred_at,created_at,updated_at)
   SELECT lower(hex(randomblob(16))),'system','moderation_rejection_mail','moderation.rejection_mail','notification',n.id,
   json_object('attemptId',a.id,'state','unknown','reason','attempt_interrupted_review_required'),?,?,?
   FROM notification_outbox n JOIN notification_outbox_attempts a ON a.id=n.claim_id
   WHERE n.event_type='moderation_rejected' AND n.delivery_state IN('queued','unknown') AND a.state IN('sending','unknown') AND a.created_at<?
   AND NOT EXISTS(SELECT 1 FROM audit_entries audit WHERE audit.action='moderation.rejection_mail' AND audit.entity_id=n.id
    AND json_extract(audit.details_json,'$.attemptId')=a.id AND json_extract(audit.details_json,'$.state')='unknown')`).bind(now,now,now,cutoff),
  db.prepare(`UPDATE notification_outbox_attempts SET state='unknown',failure_reason='attempt_interrupted_review_required',updated_at=?
   WHERE state='sending' AND created_at<? AND outbox_id IN(SELECT id FROM notification_outbox WHERE event_type='moderation_rejected')`).bind(now,cutoff),
  db.prepare(`UPDATE notification_outbox SET delivery_state='unknown',failure_reason='attempt_interrupted_review_required',updated_at=?
   WHERE event_type='moderation_rejected' AND delivery_state='queued' AND claim_id IN(SELECT id FROM notification_outbox_attempts WHERE state='unknown')`).bind(now),
 ])
}
