import type { DatabaseConnection } from '@/core/platform/database'
import { RequestLifecycleError } from './lifecycle-types'
import { rejectionNotice } from './rejection-notice'
import { activeModerationAuthor, commitModeration, currentModerationRequest, lastModeration, moderationClaim, requireRejectionReason, type VerdictInput } from './moderation-claim'

export async function moderateCommentEdit(db: DatabaseConnection, input: VerdictInput & { readonly editId: string }): Promise<void> {
  const query = `SELECT edit.id,edit.body,comment.id AS commentId,comment.request_id AS requestId,
    comment.requester_id AS requesterId,comment.moderation_state AS commentState,comment.body AS previousBody,
    r.author_requester_id AS requestAuthorId,${lastModeration('comment_edit','edit.id')} AS lastVerdict,
    ${lastModeration('comment','comment.id')} AS commentVerdict
    FROM request_comment_edits edit JOIN request_comments comment ON comment.id=edit.comment_id JOIN requests r ON r.id=comment.request_id
    WHERE edit.id=? AND edit.moderation_state='awaiting_review' AND edit.requester_id=comment.requester_id
    AND ${currentModerationRequest('r')} AND ${activeModerationAuthor('comment.requester_id')}`
  const edit = await db.binding.prepare(query).bind(input.editId).first<{id:string;body:string;commentId:string;requestId:string;requesterId:string;commentState:string;previousBody:string;requestAuthorId:string|null;lastVerdict:string|null;commentVerdict:string|null}>()
  if (!edit) throw new RequestLifecycleError(404,'not_found','The comment edit does not exist.')
  requireRejectionReason(input)
  const claim = moderationClaim(db,'comment_edit',query,[input.editId],edit,input)
  const statements = [
    db.binding.prepare(`UPDATE request_comment_edits SET moderation_state=?,rejection_reason=?,approved_at=?,updated_at=? WHERE id=? AND ${claim.gate}`)
      .bind(input.verdict,input.verdict==='rejected'?input.reason:null,input.verdict==='approved'?input.now:null,input.now,edit.id,claim.id),
    ...rejectionNotice(db,input,'comment_edit',edit.id,edit.requesterId,claim.id),
  ]
  if (input.verdict==='approved') statements.push(db.binding.prepare(`UPDATE request_comments SET body=?,edited_at=?,updated_at=? WHERE id=? AND ${claim.gate}`)
    .bind(input.body??edit.body,input.now,input.now,edit.commentId,claim.id))
  await commitModeration(db,claim,input,statements,true)
}

export async function moderateRequestEdit(db: DatabaseConnection, input: VerdictInput & { readonly editId: string }): Promise<void> {
  const query = `SELECT edit.id,edit.requester_id AS requesterId,edit.request_id AS requestId,edit.title,edit.description,
    edit.proposed_solution AS proposedSolution,edit.impact_statement AS impactStatement,
    r.moderation_state AS requestState,r.public_title AS previousTitle,r.public_description AS previousDescription,
    ${lastModeration('request_edit','edit.id')} AS lastVerdict,${lastModeration('request','r.id')} AS requestVerdict
    FROM request_content_submissions edit JOIN requests r ON r.id=edit.request_id
    WHERE edit.id=? AND edit.is_initial=0 AND edit.moderation_state='awaiting_review' AND edit.requester_id=r.author_requester_id
    AND r.published_at IS NOT NULL AND ${currentModerationRequest('r')} AND ${activeModerationAuthor('edit.requester_id')}`
  const edit = await db.binding.prepare(query).bind(input.editId).first<{id:string;requesterId:string;requestId:string;title:string;description:string;proposedSolution:string|null;impactStatement:string|null;requestState:string;previousTitle:string|null;previousDescription:string|null;lastVerdict:string|null;requestVerdict:string|null}>()
  if (!edit) throw new RequestLifecycleError(404,'not_found','The request edit does not exist.')
  requireRejectionReason(input)
  const claim = moderationClaim(db,'request_edit',query,[input.editId],edit,input)
  const statements = [
    db.binding.prepare(`UPDATE request_content_submissions SET moderation_state=?,rejection_reason=?,approved_at=?,updated_at=? WHERE id=? AND ${claim.gate}`)
      .bind(input.verdict,input.verdict==='rejected'?input.reason:null,input.verdict==='approved'?input.now:null,input.now,edit.id,claim.id),
    ...rejectionNotice(db,input,'request_edit',edit.id,edit.requesterId,claim.id),
  ]
  if (input.verdict==='approved') statements.push(db.binding.prepare(`UPDATE requests SET title=?,description=?,proposed_solution=?,impact_statement=?,public_title=?,public_description=?,moderation_state='approved',updated_at=? WHERE id=? AND ${claim.gate}`)
    .bind(edit.title,edit.description,edit.proposedSolution,edit.impactStatement,edit.title,edit.description,input.now,edit.requestId,claim.id))
  await commitModeration(db,claim,input,statements,true)
}
