import { activeModerationAuthor, currentModerationRequest } from './moderation-claim'
import type { DatabaseConnection } from '@/core/platform/database'
import { createRequestId } from './lifecycle-ids'
import { RequestLifecycleError } from './lifecycle-types'

const tables={request:'requests',request_edit:'request_content_submissions',comment:'request_comments',comment_edit:'request_comment_edits'} as const
export async function reviewAppeal(database:DatabaseConnection,id:string,operatorId:string,resolution:'reopen'|'dismiss',reason:string,now:string) {
  const db=database.binding
  const appeal=await db.prepare(`SELECT a.subject_type AS type,a.subject_id AS subjectId,a.request_id AS requestId,a.requester_id AS requesterId
    FROM request_moderation_appeals a JOIN requests r ON r.id=a.request_id
    WHERE a.id=? AND a.state='open' AND ${currentModerationRequest('r')} AND ${activeModerationAuthor('a.requester_id')}`)
    .bind(id).first<{type:keyof typeof tables;subjectId:string;requestId:string;requesterId:string}>()
  if(!appeal || !Object.hasOwn(tables,appeal.type))throw new RequestLifecycleError(409,'appeal_not_open','This appeal cannot be reviewed.')
  const table=tables[appeal.type],claim=createRequestId()
  const subjectRequest=appeal.type==='request'?'subject.id':appeal.type==='comment_edit'?'(SELECT request_id FROM request_comments WHERE id=subject.comment_id)':'subject.request_id'
  const subjectOwner=appeal.type==='request'?'subject.author_requester_id':'subject.requester_id'
  const gate='EXISTS(SELECT 1 FROM request_moderation_appeals WHERE id=? AND resolution_id=?)'
  const statements=[db.prepare(`UPDATE request_moderation_appeals SET state='reviewed',reviewed_by_operator_id=?,reviewed_at=?,updated_at=?,resolution=?,resolution_reason=?,resolution_id=?
    WHERE id=? AND state='open' AND request_id=? AND requester_id=? AND EXISTS(SELECT 1 FROM ${table} subject JOIN requests r ON r.id=${subjectRequest}
      WHERE subject.id=? AND subject.moderation_state='rejected' AND ${subjectOwner}=? AND r.id=? AND ${currentModerationRequest('r')} AND ${activeModerationAuthor(subjectOwner)}) RETURNING 1 AS affected`)
    .bind(operatorId,now,now,resolution,reason,claim,id,appeal.requestId,appeal.requesterId,appeal.subjectId,appeal.requesterId,appeal.requestId)]
  if(resolution==='reopen')statements.push(db.prepare(`UPDATE ${table} SET moderation_state='awaiting_review',updated_at=? WHERE id=? AND ${gate}`).bind(now,appeal.subjectId,id,claim))
  statements.push(db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,details_json,created_at,updated_at)
    SELECT ?,'operator',?,'request.appeal_reviewed','request',?,?,?,?,? WHERE ${gate}`)
    .bind(createRequestId(),operatorId,appeal.requestId,now,JSON.stringify({appealId:id,resolution,reason}),now,now,id,claim))
  const results=await db.batch(statements)
  if(results[0].results.length!==1)throw new RequestLifecycleError(409,'appeal_not_open','This appeal has already changed.')
}
