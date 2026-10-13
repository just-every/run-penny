import type { DatabaseConnection } from '@/core/platform/database'
import { createRequestId } from './lifecycle-ids'
import { RequestLifecycleError } from './lifecycle-types'

export async function mergeRequesterIdentities(connection: DatabaseConnection, sourceRequesterId: string, targetRequesterId: string, operatorId: string, now: string): Promise<void> {
  if (sourceRequesterId === targetRequesterId) throw new RequestLifecycleError(409, 'identity_merge_cycle', 'A requester identity cannot merge into itself.')
  const people = await connection.binding.prepare(`SELECT id FROM requesters WHERE id IN (?, ?)`).bind(sourceRequesterId, targetRequesterId).all<{ id: string }>()
  if (people.results.length !== 2) throw new RequestLifecycleError(404, 'not_found', 'One of the requester identities does not exist.')
  const mergeId = createRequestId()
  try {
    await connection.binding.batch([
      // Both endpoints must still be active in the same transaction that
      // transfers their addresses, sessions and contributions. Never revive a
      // retired endpoint or rewrite its historical merge edge.
      connection.binding.prepare(`INSERT INTO requester_write_guards(id,permitted)
        VALUES(?,CASE WHEN (SELECT COUNT(*) FROM requesters WHERE id IN (?,?))=2
          AND NOT EXISTS(SELECT 1 FROM requester_identity_merges WHERE source_requester_id IN (?,?))
          THEN 1 ELSE 0 END)`).bind(mergeId,sourceRequesterId,targetRequesterId,sourceRequesterId,targetRequesterId),
    connection.binding.prepare(`
      INSERT INTO requester_identity_merges (id, source_requester_id, target_requester_id, actor_operator_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(mergeId, sourceRequesterId, targetRequesterId, operatorId, now, now),
    connection.binding.prepare(`INSERT OR IGNORE INTO requester_account_links (requester_id, account_id, created_at) SELECT ?, account_id, created_at FROM requester_account_links WHERE requester_id = ?`).bind(targetRequesterId, sourceRequesterId),
    connection.binding.prepare(`INSERT OR IGNORE INTO request_votes (request_id, requester_id, created_at, updated_at) SELECT request_id, ?, created_at, updated_at FROM request_votes WHERE requester_id = ?`).bind(targetRequesterId, sourceRequesterId),
    connection.binding.prepare(`INSERT OR IGNORE INTO request_follows (request_id, requester_id, permission_granted_at, muted_at, created_at, updated_at) SELECT request_id, ?, permission_granted_at, muted_at, created_at, updated_at FROM request_follows WHERE requester_id = ?`).bind(targetRequesterId, sourceRequesterId),
    ...(['request_vote_contributions','request_follow_contributions'] as const).flatMap(table=>[
      connection.binding.prepare(`INSERT OR IGNORE INTO ${table} SELECT request_id,?,${table==='request_vote_contributions'?'created_at,updated_at':'permission_granted_at,muted_at,created_at,updated_at'} FROM ${table} WHERE requester_id=?`).bind(targetRequesterId,sourceRequesterId),
      connection.binding.prepare(`DELETE FROM ${table} WHERE requester_id=?`).bind(sourceRequesterId),
    ]),
    connection.binding.prepare(`DELETE FROM requester_account_links WHERE requester_id = ?`).bind(sourceRequesterId),
    connection.binding.prepare(`DELETE FROM request_votes WHERE requester_id = ?`).bind(sourceRequesterId),
    connection.binding.prepare(`DELETE FROM request_follows WHERE requester_id = ?`).bind(sourceRequesterId),
    connection.binding.prepare(`UPDATE requester_addresses SET requester_id = ?, updated_at = ? WHERE requester_id = ?`).bind(targetRequesterId, now, sourceRequesterId),
    connection.binding.prepare('UPDATE notification_intents SET requester_id=?,updated_at=? WHERE requester_id=?').bind(targetRequesterId,now,sourceRequesterId),
    connection.binding.prepare('UPDATE notification_batches SET requester_id=?,updated_at=? WHERE requester_id=?').bind(targetRequesterId,now,sourceRequesterId),
    connection.binding.prepare(`UPDATE native_requester_sessions SET requester_id = ?, updated_at = ? WHERE requester_id = ?`).bind(targetRequesterId, now, sourceRequesterId),
    connection.binding.prepare(`UPDATE requests SET author_requester_id = ?, updated_at = ? WHERE author_requester_id = ?`).bind(targetRequesterId, now, sourceRequesterId),
    connection.binding.prepare(`UPDATE evidence_items SET requester_id = ?, updated_at = ? WHERE requester_id = ?`).bind(targetRequesterId, now, sourceRequesterId),
    connection.binding.prepare(`UPDATE request_comments SET requester_id = ?, updated_at = ? WHERE requester_id = ?`).bind(targetRequesterId, now, sourceRequesterId),
    connection.binding.prepare(`UPDATE request_content_submissions SET requester_id = ?, updated_at = ? WHERE requester_id = ?`).bind(targetRequesterId, now, sourceRequesterId),
    connection.binding.prepare(`UPDATE request_comment_edits SET requester_id = ?, updated_at = ? WHERE requester_id = ?`).bind(targetRequesterId, now, sourceRequesterId),
    connection.binding.prepare(`UPDATE request_moderation_appeals SET requester_id = ?, updated_at = ? WHERE requester_id = ?`).bind(targetRequesterId, now, sourceRequesterId),
    connection.binding.prepare(`UPDATE requester_update_permissions SET requester_id = ?, updated_at = ? WHERE requester_id = ?`).bind(targetRequesterId, now, sourceRequesterId),
    connection.binding.prepare(`INSERT INTO requester_notification_preferences(requester_id,muted_at,created_at,updated_at)
      SELECT ?,muted_at,created_at,? FROM requester_notification_preferences WHERE requester_id=? AND muted_at IS NOT NULL
      ON CONFLICT(requester_id) DO UPDATE SET muted_at=COALESCE(requester_notification_preferences.muted_at,excluded.muted_at),updated_at=excluded.updated_at`)
      .bind(targetRequesterId,now,sourceRequesterId),
    connection.binding.prepare(`INSERT OR IGNORE INTO request_notification_mutes(requester_id,request_id,created_at,updated_at)
      SELECT ?,request_id,created_at,? FROM request_notification_mutes WHERE requester_id=?`).bind(targetRequesterId,now,sourceRequesterId),
    connection.binding.prepare(`
      INSERT INTO audit_entries (id, actor_type, actor_id, action, entity_type, entity_id, occurred_at, details_json, created_at, updated_at)
      VALUES (?, 'operator', ?, 'requester.merged', 'requester', ?, ?, ?, ?, ?)
    `).bind(createRequestId(), operatorId, sourceRequesterId, now, JSON.stringify({ survivorRequesterId: targetRequesterId }), now, now),
      connection.binding.prepare('DELETE FROM requester_write_guards WHERE id=?').bind(mergeId),
    ])
  } catch (error) {
    if (String(error).includes('identity_merge_notification_active')) {
      throw new RequestLifecycleError(409, 'identity_merge_notification_active', 'A notification is sending for one of these identities. Retry the merge after its delivery settles.')
    }
    if (String(error).includes('requester_write_admitted')) {
      throw new RequestLifecycleError(409, 'identity_merge_changed', 'One of these identities has already merged. Select its current survivor before merging.')
    }
    throw error
  }
}
