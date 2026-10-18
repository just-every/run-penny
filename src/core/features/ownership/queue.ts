import { NativeError } from '../auth/native-tokens'
import { createUlid } from '@/core/shared/ulid'
import type { AwaitingComment, OwnedEvidence, OwnedRequest, OwnershipQueue } from './types'

// Retained history keeps its owner, but withdrawn, merged and archived requests
// do not represent pending work. Comments on a completed request can still need
// an answer, so its comments remain until handled or moderation rejects them.
const currentRequest = `r.withdrawn_at IS NULL AND r.merged_into_request_id IS NULL AND b.archived_at IS NULL
 AND (r.author_requester_id IS NULL OR EXISTS(SELECT 1 FROM requesters author WHERE author.id=r.author_requester_id AND author.blocked_at IS NULL))`
const requestFrom = `FROM penny_request_owners a JOIN requests r ON r.id=a.request_id JOIN boards b ON b.id=r.board_id`
const requestWhere = `a.operator_id=? AND ${currentRequest} AND r.moderation_state!='rejected'
 AND (SELECT status FROM penny_request_status WHERE request_id=r.id) NOT IN ('shipped','declined','withdrawn')`
const evidenceFrom = 'FROM penny_evidence_owners a JOIN evidence_items e ON e.id=a.evidence_id'
const evidenceWhere = `a.operator_id=? AND e.review_state='unreviewed' AND NOT EXISTS(SELECT 1 FROM penny_evidence_snoozes z WHERE z.evidence_id=e.id AND z.until_at>strftime('%Y-%m-%dT%H:%M:%fZ','now'))`
const commentFrom = `${requestFrom} JOIN request_comments c ON c.request_id=r.id JOIN requesters customer ON customer.id=c.requester_id`
const pendingCommentEdit = `EXISTS(SELECT 1 FROM request_comment_edits edit WHERE edit.comment_id=c.id AND edit.moderation_state='awaiting_review')`
const commentNeedsReview = `(c.moderation_state='awaiting_review' OR ${pendingCommentEdit})`
const commentWhere = `a.operator_id=? AND ${currentRequest} AND r.moderation_state!='rejected' AND customer.blocked_at IS NULL AND c.moderation_state!='rejected'
 AND (${commentNeedsReview} OR NOT EXISTS(SELECT 1 FROM penny_comment_receipts receipt
 WHERE receipt.comment_id=c.id AND receipt.operator_id=a.operator_id AND receipt.comment_updated_at=c.updated_at))`

export async function ownQueue(db: D1Database, actor: string, page: number): Promise<OwnershipQueue> {
 const pageSize = 25, offset = (page - 1) * pageSize
 const results = await db.batch([
  db.prepare(`SELECT r.id,r.slug,r.title,b.name AS boardName,r.moderation_state AS moderationState ${requestFrom} WHERE ${requestWhere} ORDER BY a.updated_at,r.id LIMIT ? OFFSET ?`).bind(actor, pageSize, offset),
  db.prepare(`SELECT e.id,(SELECT wording FROM evidence_versions WHERE evidence_id=e.id ORDER BY version_number DESC LIMIT 1) AS wording,e.source_type AS sourceType,e.source_label AS sourceLabel ${evidenceFrom} WHERE ${evidenceWhere} ORDER BY e.created_at,e.id LIMIT ? OFFSET ?`).bind(actor, pageSize, offset),
  db.prepare(`SELECT c.id,r.id AS requestId,r.slug,r.title,c.body,CASE WHEN ${commentNeedsReview} THEN 'awaiting_review' ELSE c.moderation_state END AS moderationState,c.updated_at AS updatedAt ${commentFrom} WHERE ${commentWhere} ORDER BY c.created_at,c.id LIMIT ? OFFSET ?`).bind(actor, pageSize, offset),
  db.prepare(`SELECT count(*) AS total ${requestFrom} WHERE ${requestWhere}`).bind(actor),
  db.prepare(`SELECT count(*) AS total ${evidenceFrom} WHERE ${evidenceWhere}`).bind(actor),
  db.prepare(`SELECT count(*) AS total ${commentFrom} WHERE ${commentWhere}`).bind(actor),
 ])
 const count = (index: number) => Number((results[index].results[0] as { total: number }).total)
 return { requests: results[0].results as unknown as OwnedRequest[], evidence: results[1].results as unknown as OwnedEvidence[], comments: results[2].results as unknown as AwaitingComment[], totals: { requests: count(3), evidence: count(4), comments: count(5) }, page, pageSize }
}

export async function acknowledgeComment(db: D1Database, actor: string, id: string, updatedAt: string) {
 const guard = crypto.randomUUID(), now = new Date().toISOString()
 try {
  await db.batch([
   db.prepare(`INSERT INTO penny_ownership_guards(id,allowed) VALUES (?,EXISTS(SELECT 1 ${commentFrom}
    WHERE a.operator_id=? AND ${currentRequest} AND r.moderation_state!='rejected' AND c.id=? AND c.updated_at=? AND c.moderation_state='approved' AND NOT ${pendingCommentEdit} AND customer.blocked_at IS NULL))`).bind(guard, actor, id, updatedAt),
   db.prepare(`INSERT INTO penny_comment_receipts(comment_id,operator_id,comment_updated_at,acknowledged_at) VALUES(?,?,?,?)
    ON CONFLICT(comment_id,operator_id) DO UPDATE SET comment_updated_at=excluded.comment_updated_at,acknowledged_at=excluded.acknowledged_at`).bind(id, actor, updatedAt, now),
   db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at)
    VALUES(?,'operator',?,'ownership.comment_handled','request_comment',?,?,?,?)`).bind(createUlid(), actor, id, now, now, now),
   db.prepare('DELETE FROM penny_ownership_guards WHERE id=?').bind(guard),
  ])
 } catch (error) {
  if (String(error).includes('penny_ownership_admitted')) throw new NativeError('ownership_comment_changed', 409, 'Review this comment first, or refresh if its owner or contents changed.')
  throw error
 }
}
