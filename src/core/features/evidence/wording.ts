import {redactCaptured,redactionFence} from '../redaction/settings'
import { MutationError } from '@/core/app/operator-mutations'
import { createUlid } from '@/core/shared/ulid'
import { exists } from '../decisions/write-support'
export async function evidenceVersions(db:D1Database,id:string){
 await exists(db,'evidence_items',id)
 return (await db.prepare('SELECT id,version_number AS versionNumber,wording,edited_by_operator_id AS editedByOperatorId,created_at AS createdAt FROM evidence_versions WHERE evidence_id=? ORDER BY version_number DESC').bind(id).all()).results
}
export async function editEvidenceWording(db:D1Database,id:string,wording:string,expectedVersionId:string,actor:string,now:string){
 await exists(db,'evidence_items',id)
 const captured=await redactCaptured(db,{wording},['wording']),fence=redactionFence(db,captured.revision);wording=captured.input.wording
 const versionId=createUlid()
 const results=await db.batch([
  db.prepare(`INSERT INTO evidence_versions(id,evidence_id,version_number,wording,edited_by_operator_id,created_at,updated_at)
   SELECT ?,evidence_id,version_number+1,?,?,?,? FROM evidence_versions
   WHERE id=? AND evidence_id=? AND version_number=(SELECT MAX(version_number) FROM evidence_versions WHERE evidence_id=?) RETURNING 1 AS affected`).bind(versionId,wording,actor,now,now,expectedVersionId,id,id),
  fence.before,fence.after,
  db.prepare('UPDATE evidence_items SET updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM evidence_versions WHERE id=?)').bind(now,id,versionId),
  db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,details_json,occurred_at,created_at,updated_at) SELECT ?,'operator',?,'evidence.wording_edited','evidence',?,json_object('versionId',?),?,?,? WHERE EXISTS(SELECT 1 FROM evidence_versions WHERE id=?)`).bind(createUlid(),actor,id,versionId,now,now,now,versionId),
 ])
 if(results[0].results.length!==1)throw new MutationError(409,'Evidence wording changed. Refresh its versions before saving.')
 return {id,versionId}
}
