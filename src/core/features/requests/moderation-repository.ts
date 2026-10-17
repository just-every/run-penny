import { validateCategory } from '../categories/category-policy'
import type { DatabaseConnection } from '@/core/platform/database'
import { RequestLifecycleError } from './lifecycle-types'
import { rejectionNotice } from './rejection-notice'
import { activeModerationAuthor, commitModeration, currentModerationRequest, lastModeration, moderationClaim, requireRejectionReason, type VerdictInput } from './moderation-claim'

export async function moderateRequest(db: DatabaseConnection, input: VerdictInput & {
  readonly slug: string; readonly title?: string; readonly description?: string
  readonly publicAuthorDisplayName?: string; readonly boardSlug?: string; readonly categoryId?:string|null
}): Promise<void> {
  const query = `SELECT r.id,r.id AS requestId,r.title,r.description,r.board_id AS boardId,r.category_id AS categoryId,r.author_requester_id AS requesterId,
    r.published_at AS publishedAt,r.public_state AS publicState,r.public_author_display_name AS publicAuthorDisplayName,r.moderation_state AS moderationState,
    (SELECT id FROM request_content_submissions WHERE request_id=r.id AND moderation_state='awaiting_review' ORDER BY created_at DESC,rowid DESC LIMIT 1) AS submissionId,
    ${lastModeration('request','r.id')} AS lastVerdict
    FROM requests r WHERE r.slug=? AND ${currentModerationRequest('r')}`
  const request = await db.binding.prepare(query).bind(input.slug).first<{id:string;requestId:string;title:string;description:string;boardId:string;categoryId:string|null;requesterId:string|null;publicState:string;publishedAt:string|null;publicAuthorDisplayName:string|null;moderationState:string;submissionId:string|null;lastVerdict:string|null}>()
  if (!request) throw new RequestLifecycleError(404,'not_found','The request does not exist.')
  requireRejectionReason(input)
  if (request.moderationState===input.verdict && (input.verdict!=='approved'||request.publishedAt!==null)) throw new RequestLifecycleError(409,'moderation_conflict','This verdict has already been recorded.')
  const board = input.boardSlug ? await db.binding.prepare('SELECT id FROM boards WHERE slug=?').bind(input.boardSlug).first<{id:string}>() : null
  if (input.boardSlug && !board) throw new RequestLifecycleError(404,'board_not_found','The board does not exist.')
  const categoryId=input.categoryId!==undefined?input.categoryId:board&&board.id!==request.boardId?null:request.categoryId
  if(input.categoryId&&(input.categoryId!==request.categoryId||(board?.id??request.boardId)!==request.boardId))await validateCategory(db,board?.id??request.boardId,input.categoryId)
  const approved=input.verdict==='approved', name=input.publicAuthorDisplayName??request.publicAuthorDisplayName
  if (approved && request.requesterId!==null && !name) throw new RequestLifecycleError(400,'public_author_name_required','Approving a requester submission requires an approved public author name.')
  // Recheck the selected board as well as the full subject snapshot in the claim.
  const claimQuery = `${query} AND (? IS NULL OR EXISTS(SELECT 1 FROM boards WHERE id=? AND slug=?))`
  const claim = moderationClaim(db,'request',claimQuery,[input.slug,board?.id??null,board?.id??null,input.boardSlug??null],request,input)
  await commitModeration(db,claim,input,[
    db.binding.prepare(`UPDATE requests SET board_id=COALESCE(?,board_id),category_id=?,public_title=?,public_description=?,
      public_author_display_name=CASE WHEN ?='approved' THEN ? ELSE public_author_display_name END,
      approved_author_name=CASE WHEN ?='approved' THEN ? ELSE approved_author_name END,
      moderation_state=?,public_state=?,published_at=CASE WHEN ?='approved' THEN COALESCE(published_at,?) ELSE published_at END,updated_at=?
      WHERE id=? AND ${claim.gate}`)
      .bind(board?.id??null,categoryId,approved?(input.title??request.title):null,approved?(input.description??request.description):null,input.verdict,name,input.verdict,name,input.verdict,approved&&request.publicState==='unpublished'?'open':request.publicState,input.verdict,input.now,input.now,request.id,claim.id),
    db.binding.prepare(`UPDATE request_content_submissions SET moderation_state=?,rejection_reason=?,approved_at=?,updated_at=? WHERE id=? AND ${claim.gate}`)
      .bind(input.verdict,approved?null:input.reason,approved?input.now:null,input.now,request.submissionId,claim.id),
    ...rejectionNotice(db,input,'request',request.id,request.requesterId,claim.id),
  ])
}

export async function moderateComment(db: DatabaseConnection, input: VerdictInput & {readonly commentId:string; readonly publicAuthorDisplayName?:string}): Promise<void> {
  const query = `SELECT comment.id,comment.request_id AS requestId,comment.requester_id AS requesterId,comment.operator_id AS operatorId,
    comment.public_author_display_name AS publicAuthorDisplayName,comment.moderation_state AS moderationState,comment.body,comment.historical_private AS historicalPrivate,
    r.author_requester_id AS requestAuthorId,${lastModeration('comment','comment.id')} AS lastVerdict
    FROM request_comments comment JOIN requests r ON r.id=comment.request_id
    WHERE comment.id=? AND ${currentModerationRequest('r')} AND ${activeModerationAuthor('comment.requester_id')}`
  const comment = await db.binding.prepare(query).bind(input.commentId).first<{id:string;requestId:string;requesterId:string|null;operatorId:string|null;publicAuthorDisplayName:string|null;moderationState:string;body:string;requestAuthorId:string|null;lastVerdict:string|null;historicalPrivate:number}>()
  if (!comment) throw new RequestLifecycleError(404,'not_found','The comment does not exist.')
  if(input.verdict==='approved'&&comment.historicalPrivate)throw new RequestLifecycleError(409,'historical_comment_private','This imported internal or private comment cannot be published.')
  requireRejectionReason(input)
  if (comment.moderationState===input.verdict) throw new RequestLifecycleError(409,'moderation_conflict','This verdict has already been recorded.')
  const name=input.publicAuthorDisplayName??comment.publicAuthorDisplayName
  if(input.verdict==='approved'&&!name) throw new RequestLifecycleError(400,'public_author_name_required','Approving a comment requires an approved public author name.')
  const claim = moderationClaim(db,'comment',query,[input.commentId],comment,input)
  await commitModeration(db,claim,input,[
    db.binding.prepare(`UPDATE request_comments SET body=COALESCE(?,body),moderation_state=?,rejection_reason=?,published_at=?,
      public_author_display_name=CASE WHEN ?='approved' THEN ? ELSE public_author_display_name END,
      public_author_kind=CASE WHEN ?='approved' THEN ? ELSE public_author_kind END,updated_at=? WHERE id=? AND ${claim.gate}`)
      .bind(input.body??null,input.verdict,input.verdict==='rejected'?input.reason:null,input.verdict==='approved'?input.now:null,input.verdict,name,input.verdict,comment.requesterId===null?'operator':'requester',input.now,comment.id,claim.id),
    ...rejectionNotice(db,input,'comment',comment.id,comment.requesterId,claim.id),
  ])
}

export async function moderateAttachment(db: DatabaseConnection, input: VerdictInput & {readonly attachmentId:string}): Promise<void> {
  requireRejectionReason(input)
  const query = `SELECT attachment.id,attachment.request_id AS requestId,attachment.public_state AS publicState,
    r.author_requester_id AS requesterId,${lastModeration('attachment','attachment.id')} AS lastVerdict
    FROM attachments attachment JOIN requests r ON r.id=attachment.request_id WHERE attachment.id=? AND ${currentModerationRequest('r')}`
  const attachment = await db.binding.prepare(query).bind(input.attachmentId).first<{id:string;requestId:string;publicState:string;requesterId:string|null;lastVerdict:string|null}>()
  if (!attachment) throw new RequestLifecycleError(404,'not_found','The request attachment does not exist.')
  const state=input.verdict==='approved'?'published':'rejected'
  if (attachment.publicState===state) throw new RequestLifecycleError(409,'moderation_conflict','This verdict has already been recorded.')
  const claim = moderationClaim(db,'attachment',query,[input.attachmentId],attachment,input)
  await commitModeration(db,claim,input,[db.binding.prepare(`UPDATE attachments SET public_state=?,rejection_reason=?,updated_at=? WHERE id=? AND ${claim.gate}`)
    .bind(state,input.verdict==='rejected'?input.reason:null,input.now,attachment.id,claim.id)])
}
