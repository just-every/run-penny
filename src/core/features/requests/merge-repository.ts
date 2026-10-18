import { captureMergeNotice, activateMergeNoticeStatements } from './merge-notices'
import { projectContributions } from './contributions'
import type { DatabaseConnection } from '@/core/platform/database'
import { createRequestId } from './lifecycle-ids'
import { RequestLifecycleError } from './lifecycle-types'

export class RequestMergeRepository {
  private readonly connection: DatabaseConnection

  constructor(connection: DatabaseConnection) {
    this.connection = connection
  }

  async merge(sourceSlug: string, targetSlug: string, operatorId: string, now: string, notifySubscribers=false): Promise<void> {
    const source = await this.findUnmergedRequest(sourceSlug)
    if (!source) throw new RequestLifecycleError(404, 'source_not_found', 'The duplicate request does not exist.')
    const target = await this.resolveCanonical(targetSlug)
    if (!target) throw new RequestLifecycleError(404, 'target_not_found', 'The canonical request does not exist.')
    if (source.id === target.id) throw new RequestLifecycleError(409, 'merge_cycle', 'A request cannot merge into itself.')
    const visibility=await this.connection.binding.prepare('SELECT COUNT(DISTINCT b.visibility) AS count FROM requests r JOIN boards b ON b.id=r.board_id WHERE r.id IN (?,?)').bind(source.id,target.id).first<{count:number}>()
    if(visibility?.count!==1)throw new RequestLifecycleError(409,'merge_visibility_mismatch','Move requests to boards with the same visibility before merging.')
    const mergeId = createRequestId()
    await this.connection.binding.batch([
      this.connection.binding.prepare(`
        INSERT INTO request_merges (id, source_request_id, target_request_id, actor_operator_id, merged_at, unmerged_at, unmerged_by_operator_id, created_at, updated_at)
        VALUES (?, (SELECT id FROM requests WHERE id=? AND merged_into_request_id IS NULL),
          (SELECT t.id FROM requests t JOIN boards tb ON tb.id=t.board_id JOIN requests s ON s.id=? JOIN boards sb ON sb.id=s.board_id WHERE t.id=? AND t.merged_into_request_id IS NULL AND tb.visibility=sb.visibility), ?, ?, NULL, NULL, ?, ?)
      `).bind(mergeId, source.id, source.id, target.id, operatorId, now, now, now),
      ...captureMergeNotice(this.connection.binding,mergeId,source.id,target.id,notifySubscribers,now),
      this.connection.binding.prepare(`
        INSERT INTO request_merge_evidence_transfers (merge_id, evidence_id, target_was_linked, created_at)
        SELECT ?, source_link.evidence_id,
          CASE WHEN EXISTS(SELECT 1 FROM request_evidence_links target_link WHERE target_link.request_id = ? AND target_link.evidence_id = source_link.evidence_id) THEN 1 ELSE 0 END,
          ?
        FROM request_evidence_links source_link WHERE source_link.request_id = ?
      `).bind(mergeId, target.id, now, source.id),
      this.connection.binding.prepare(`
        INSERT INTO request_merge_vote_transfers (merge_id, requester_id, target_had_vote, source_created_at, source_updated_at, created_at)
        SELECT ?, source_vote.requester_id,
          CASE WHEN EXISTS(SELECT 1 FROM request_votes target_vote WHERE target_vote.request_id = ? AND target_vote.requester_id = source_vote.requester_id) THEN 1 ELSE 0 END,
          source_vote.created_at, source_vote.updated_at, ?
        FROM request_votes source_vote WHERE source_vote.request_id = ?
      `).bind(mergeId, target.id, now, source.id),
      this.connection.binding.prepare(`
        INSERT INTO request_merge_follow_transfers (merge_id, requester_id, target_had_follow, source_permission_granted_at, source_muted_at, source_created_at, source_updated_at, created_at)
        SELECT ?, source_follow.requester_id,
          CASE WHEN EXISTS(SELECT 1 FROM request_follows target_follow WHERE target_follow.request_id = ? AND target_follow.requester_id = source_follow.requester_id) THEN 1 ELSE 0 END,
          source_follow.permission_granted_at, source_follow.muted_at, source_follow.created_at, source_follow.updated_at, ?
        FROM request_follows source_follow WHERE source_follow.request_id = ?
      `).bind(mergeId, target.id, now, source.id),
      this.connection.binding.prepare(`
        INSERT INTO request_merge_comment_transfers (merge_id, comment_id, created_at)
        SELECT ?, id, ? FROM request_comments WHERE request_id = ?
      `).bind(mergeId, now, source.id),
      this.connection.binding.prepare(`
        INSERT INTO request_merge_attachment_transfers (merge_id, attachment_id, created_at)
        SELECT ?, id, ? FROM attachments WHERE request_id = ? AND public_state = 'published'
      `).bind(mergeId, now, source.id),
      this.connection.binding.prepare(`INSERT OR IGNORE INTO request_tag_assignments (request_id, tag_id, created_at) SELECT ?, tag_id, ? FROM request_tag_assignments WHERE request_id = ?`).bind(target.id, now, source.id),
      this.connection.binding.prepare(`UPDATE requests SET merged_into_request_id = ?, merged_at = ?, updated_at = ? WHERE id = ?`).bind(target.id, now, now, source.id),
      ...projectContributions(this.connection, [target.id]),
      ...activateMergeNoticeStatements(this.connection.binding,now),
      this.connection.binding.prepare(`
        INSERT INTO audit_entries (id, actor_type, actor_id, action, entity_type, entity_id, occurred_at, details_json, created_at, updated_at)
        VALUES (?, 'operator', ?, 'request.merged', 'request', ?, ?, json_object('canonicalRequestId',?,'notifySubscribers',?,'noticeRecipients',(SELECT COUNT(*) FROM penny_merge_notice_recipients WHERE merge_id=?)), ?, ?)
      `).bind(createRequestId(), operatorId, source.id, now, target.id,notifySubscribers?1:0,mergeId, now, now),
    ])
  }

  async unmerge(sourceSlug: string, operatorId: string, now: string): Promise<void> {
    const merge = await this.connection.binding.prepare(`
      SELECT merge_row.id AS id, merge_row.source_request_id AS sourceId, merge_row.target_request_id AS targetId
      FROM request_merges merge_row
      INNER JOIN requests source ON source.id = merge_row.source_request_id
      WHERE source.slug = ? AND merge_row.unmerged_at IS NULL LIMIT 1
    `).bind(sourceSlug).first<{ id: string; sourceId: string; targetId: string }>()
    if (!merge) throw new RequestLifecycleError(409, 'not_merged', 'The request is not actively merged.')
    await this.connection.binding.batch([
      this.connection.binding.prepare(`UPDATE request_merges SET unmerged_at = ?, unmerged_by_operator_id = ?, updated_at = ? WHERE id = ?`).bind(now, operatorId, now, merge.id),
      this.connection.binding.prepare(`UPDATE requests SET merged_into_request_id = NULL, merged_at = NULL, updated_at = ? WHERE id = ?`).bind(now, merge.sourceId),
      ...projectContributions(this.connection, [merge.sourceId, merge.targetId]),
      this.connection.binding.prepare(`
        INSERT INTO audit_entries (id, actor_type, actor_id, action, entity_type, entity_id, occurred_at, details_json, created_at, updated_at)
        VALUES (?, 'operator', ?, 'request.unmerged', 'request', ?, ?, ?, ?, ?)
      `).bind(createRequestId(), operatorId, merge.sourceId, now, JSON.stringify({ mergeId: merge.id }), now, now),
    ])
  }

  private async findUnmergedRequest(slug: string): Promise<{ id: string } | null> {
    return this.connection.binding.prepare(`SELECT id FROM requests WHERE slug = ? AND merged_into_request_id IS NULL LIMIT 1`).bind(slug).first<{ id: string }>()
  }

  private async resolveCanonical(slug: string): Promise<{ id: string } | null> {
    let current = await this.connection.binding.prepare(`SELECT id, merged_into_request_id AS mergedIntoRequestId FROM requests WHERE slug = ? LIMIT 1`).bind(slug).first<{ id: string; mergedIntoRequestId: string | null }>()
    const seen = new Set<string>()
    while (current?.mergedIntoRequestId) {
      if (seen.has(current.id)) throw new RequestLifecycleError(409, 'merge_cycle', 'The merge history contains a cycle.')
      seen.add(current.id)
      current = await this.connection.binding.prepare(`SELECT id, merged_into_request_id AS mergedIntoRequestId FROM requests WHERE id = ? LIMIT 1`).bind(current.mergedIntoRequestId).first<{ id: string; mergedIntoRequestId: string | null }>()
    }
    return current ? { id: current.id } : null
  }
}
