import { boundedIds } from '@/core/features/workspace/list-query'
import type { OperatorDecisionListItem, OperatorRoadmapCard } from '@/core/shared/api/operator'
import type { DatabaseConnection } from '@/core/platform/database'

export class RoadmapReadRepository {
  private readonly connection: DatabaseConnection

  constructor(connection: DatabaseConnection) {
    this.connection = connection
  }

  async list(ids?: readonly string[]): Promise<readonly OperatorRoadmapCard[]> {
    const result = await this.connection.binding.prepare(`
      SELECT
        ri.id AS id, ri.slug AS slug, ri.title AS title, ri.summary AS summary, ri.status AS status,
        ri.target_window AS targetWindow, ri.delivery_notes AS deliveryNotes, ri.confidence AS confidence,
        owner.id AS ownerId, owner.display_name AS ownerName,
        d.slug AS decisionSlug, d.title AS decisionTitle, d.state AS decisionState, CASE WHEN d.selected_candidate_bet_id=ri.candidate_bet_id THEN 'selected' WHEN d.selected_candidate_bet_id IS NOT NULL AND ri.candidate_bet_id IS NOT NULL THEN 'declined' END AS decisionDisposition,
        (SELECT COUNT(*) FROM (SELECT evidence_id FROM candidate_bet_evidence_links WHERE candidate_bet_id=ri.candidate_bet_id UNION SELECT evidence_id FROM roadmap_evidence_links WHERE roadmap_item_id=ri.id)) AS evidenceCount,
        CASE WHEN rp.roadmap_item_id IS NULL OR ri.status='dropped' THEN NULL WHEN ri.status = 'exploring' THEN 'under_review' ELSE ri.status END AS publicStatus
      FROM roadmap_items ri
      LEFT JOIN operators owner ON owner.id = ri.owner_operator_id
      LEFT JOIN decisions d ON d.id = ri.decision_id
      LEFT JOIN roadmap_publications rp ON rp.roadmap_item_id = ri.id AND rp.withdrawn_at IS NULL AND (rp.board_id IS NULL OR EXISTS(SELECT 1 FROM boards pb WHERE pb.id=rp.board_id AND pb.visibility='public' AND pb.archived_at IS NULL))
      ${boundedIds('ri', ids)}
      ORDER BY CASE ri.status WHEN 'exploring' THEN 1 WHEN 'planned' THEN 2 WHEN 'in_progress' THEN 3 WHEN 'shipped' THEN 4 ELSE 5 END, ri.title ASC
      LIMIT 25
    `).bind(...(ids ?? [])).all<{
      readonly id: string; readonly slug: string; readonly title: string; readonly summary: string; readonly status: OperatorRoadmapCard['status']
      readonly targetWindow: string | null; readonly deliveryNotes: string | null; readonly confidence: OperatorRoadmapCard['confidence']
      readonly ownerId: string | null; readonly ownerName: string | null; readonly decisionSlug: string | null; readonly decisionTitle: string | null; readonly decisionState: OperatorDecisionListItem['state'] | null
      readonly decisionDisposition:'selected'|'declined'|null; readonly evidenceCount: number; readonly publicStatus: OperatorRoadmapCard['publicStatus']
    }>()
    return result.results.map((row) => ({
      id: row.id, slug: row.slug, title: row.title, summary: row.summary, status: row.status,
      targetWindow: row.targetWindow, deliveryNotes: row.deliveryNotes, confidence: row.confidence,
      owner: row.ownerId && row.ownerName ? { id: row.ownerId, displayName: row.ownerName } : null,
      decision: row.decisionSlug && row.decisionTitle && row.decisionState ? { slug: row.decisionSlug, title: row.decisionTitle, state: row.decisionState } : null,
      decisionDisposition:row.decisionDisposition,evidenceCount: Number(row.evidenceCount), publicStatus: row.publicStatus,
    }))
  }
}
