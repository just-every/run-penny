import { boundedIds } from '@/core/features/workspace/list-query'
import type { OperatorDecisionBrief, OperatorDecisionListItem, OperatorRoadmapCard } from '@/core/shared/api/operator'
import type { DatabaseConnection } from '@/core/platform/database'
import { readDecisionBets } from './read-bets'

export class DecisionsReadRepository {
  private readonly connection: DatabaseConnection

  constructor(connection: DatabaseConnection) {
    this.connection = connection
  }

  async list(ids?: readonly string[]): Promise<readonly OperatorDecisionListItem[]> {
    const result = await this.connection.binding.prepare(`
      SELECT
        d.id AS id, d.slug AS slug, d.title AS title, d.state AS state, d.review_at AS reviewAt,
        (SELECT action FROM audit_entries WHERE entity_type='decision' AND entity_id=d.id ORDER BY occurred_at DESC,id DESC LIMIT 1) AS lastAction,
        (SELECT occurred_at FROM audit_entries WHERE entity_type='decision' AND entity_id=d.id ORDER BY occurred_at DESC,id DESC LIMIT 1) AS lastActionAt,
        owner.id AS ownerId, owner.display_name AS ownerName,
        (SELECT COUNT(DISTINCT cbel.evidence_id) FROM candidate_bets cb INNER JOIN candidate_bet_evidence_links cbel ON cbel.candidate_bet_id = cb.id WHERE cb.decision_id = d.id) AS evidenceCount,
        (SELECT COUNT(*) FROM (SELECT e.account_id FROM candidate_bets cb JOIN candidate_bet_evidence_links l ON l.candidate_bet_id=cb.id JOIN evidence_items e ON e.id=l.evidence_id WHERE cb.decision_id=d.id AND e.account_id IS NOT NULL UNION SELECT a.account_id FROM candidate_bet_account_links a JOIN candidate_bets cb ON cb.id=a.candidate_bet_id WHERE cb.decision_id=d.id)) AS accountCount
      FROM decisions d LEFT JOIN operators owner ON owner.id = d.owner_operator_id
      ${boundedIds('d', ids)}
      ORDER BY CASE d.state WHEN 'ready' THEN 1 WHEN 'review_due' THEN 2 WHEN 'committed' THEN 3 ELSE 4 END, d.review_at ASC, d.title ASC
      LIMIT 25
    `).bind(...(ids ?? [])).all<{
      readonly id: string; readonly slug: string; readonly title: string; readonly state: OperatorDecisionListItem['state']; readonly reviewAt: string | null
      readonly lastAction:string|null;readonly lastActionAt:string|null;readonly ownerId: string | null; readonly ownerName: string | null; readonly evidenceCount: number; readonly accountCount: number
    }>()
    return result.results.map((row) => ({
      id: row.id, slug: row.slug, title: row.title, state: row.state, reviewAt: row.reviewAt,lastAction:row.lastAction,lastActionAt:row.lastActionAt,
      owner: row.ownerId && row.ownerName ? { id: row.ownerId, displayName: row.ownerName } : null,
      evidenceCount: Number(row.evidenceCount), accountCount: Number(row.accountCount),
    }))
  }

  async find(slug: string): Promise<OperatorDecisionBrief | null> {
    const record = await this.connection.binding.prepare('SELECT id FROM decisions WHERE slug=? LIMIT 1').bind(slug).first<{id:string}>()
    if (!record) return null
    const [summaries, detailResult, bets] = await Promise.all([
      this.list([record.id]),
      this.connection.binding.prepare(`
        SELECT d.question AS question, d.confidence AS confidence, d.rationale AS rationale,
          d.selected_candidate_bet_id AS selectedCandidateBetId,
          ri.slug AS roadmapSlug, ri.title AS roadmapTitle, ri.status AS roadmapStatus
        FROM decisions d LEFT JOIN roadmap_items ri ON ri.decision_id=d.id AND ri.candidate_bet_id=d.selected_candidate_bet_id
        WHERE d.id = ? LIMIT 1
      `).bind(record.id).all<{
        readonly question: string; readonly confidence: OperatorDecisionBrief['confidence']; readonly rationale: string | null; readonly selectedCandidateBetId: string | null
        readonly roadmapSlug: string | null; readonly roadmapTitle: string | null; readonly roadmapStatus: OperatorRoadmapCard['status'] | null
      }>(),
      readDecisionBets(this.connection, record.id),
    ])
    const summary = summaries[0], row = detailResult.results[0]
    if (!summary || !row) return null
    const { roadmapSlug, roadmapTitle, roadmapStatus, ...detail } = row
    const roadmapItem = roadmapSlug !== null ? { slug: roadmapSlug, title: roadmapTitle!, status: roadmapStatus! } : null
    return { ...summary, ...detail, bets, roadmapItem }
  }
}
