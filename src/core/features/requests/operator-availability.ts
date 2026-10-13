import type { DatabaseConnection } from '@/core/platform/database'
import { currentModerationRequest } from './moderation-claim'

export type ModerationAvailability = 'current' | 'withdrawn' | 'merged' | 'inactive_author'
export interface RequestActions {
  moderation: boolean
  publish: boolean
  reverseDecline: boolean
  merge: boolean
  unmerge: boolean
}

/** History uses the same eligibility rule as the queue and moderation writes. */
export const moderationAvailabilitySql = (alias: string) => `CASE
  WHEN ${currentModerationRequest(alias)} THEN 'current'
  WHEN ${alias}.withdrawn_at IS NOT NULL THEN 'withdrawn'
  WHEN ${alias}.merged_into_request_id IS NOT NULL THEN 'merged'
  ELSE 'inactive_author' END`

export async function requestAvailability(database: DatabaseConnection, slug: string) {
  const row = await database.binding.prepare(`SELECT r.id,
    ${moderationAvailabilitySql('r')} AS moderationAvailability,
    (b.visibility='public' AND r.moderation_state='approved' AND r.published_at IS NOT NULL
      AND r.withdrawn_at IS NULL AND r.merged_into_request_id IS NULL) AS canPublish,
    (r.public_state='declined' AND EXISTS(SELECT 1 FROM request_status_updates u WHERE u.id=(
      SELECT id FROM request_status_updates WHERE request_id=r.id AND public_status='declined'
      AND previous_public_state!='declined' ORDER BY published_at DESC,id DESC LIMIT 1)
      AND u.previous_public_state IS NOT NULL)) AS canReverseDecline,
    (r.merged_into_request_id IS NULL) AS canMerge,
    EXISTS(SELECT 1 FROM request_merges m WHERE m.source_request_id=r.id AND m.unmerged_at IS NULL) AS canUnmerge
    FROM requests r JOIN boards b ON b.id=r.board_id WHERE r.slug=?`).bind(slug).first<{
      id: string; moderationAvailability: ModerationAvailability
      canPublish: number; canReverseDecline: number; canMerge: number; canUnmerge: number
    }>()
  if (!row) return null
  return { id: row.id, actions: {
    moderation: row.moderationAvailability === 'current', publish: Boolean(row.canPublish),
    reverseDecline: Boolean(row.canReverseDecline), merge: Boolean(row.canMerge), unmerge: Boolean(row.canUnmerge),
  } satisfies RequestActions }
}
