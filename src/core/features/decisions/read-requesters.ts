import type { OperatorDecisionBrief } from '@/core/shared/api/operator'
import { recipientSelection } from '../releases/recipients'

/** Reuse the live release audience rules without creating a snapshot or permission. */
export async function readDecisionRequesters(db: D1Database, decisionId: string): Promise<OperatorDecisionBrief['eligibleRequesters']> {
  const audience = recipientSelection(`SELECT m.request_id FROM roadmap_request_mappings m
    JOIN roadmap_items item ON item.id=m.roadmap_item_id
    WHERE item.decision_id=? AND m.approved_at IS NOT NULL AND m.withdrawn_at IS NULL`)
  const result = await db.prepare(`WITH eligible AS (${audience})
    SELECT DISTINCT person.id, person.display_name AS displayName
    FROM eligible JOIN requesters person ON person.id=eligible.requester_id
    ORDER BY person.display_name, person.id`).bind(decisionId).all<{id: string; displayName: string}>()
  return result.results
}
