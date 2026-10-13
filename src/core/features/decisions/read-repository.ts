import { observedTimeOrderSql } from '../evidence/observed-time'
import type { OperatorDecisionBrief, OperatorDecisionListItem, OperatorRoadmapCard } from '@/core/shared/api/operator'
import type { DatabaseConnection } from '@/core/platform/database'
import { evidenceReadSelect, mapEvidenceRead, type EvidenceReadRow } from '@/core/features/evidence/read-repository'

export class DecisionsReadRepository {
  private readonly connection: DatabaseConnection

  constructor(connection: DatabaseConnection) {
    this.connection = connection
  }

  async list(): Promise<readonly OperatorDecisionListItem[]> {
    const result = await this.connection.binding.prepare(`
      SELECT
        d.id AS id, d.slug AS slug, d.title AS title, d.state AS state, d.review_at AS reviewAt,
        (SELECT action FROM audit_entries WHERE entity_type='decision' AND entity_id=d.id ORDER BY occurred_at DESC,id DESC LIMIT 1) AS lastAction,
        (SELECT occurred_at FROM audit_entries WHERE entity_type='decision' AND entity_id=d.id ORDER BY occurred_at DESC,id DESC LIMIT 1) AS lastActionAt,
        owner.id AS ownerId, owner.display_name AS ownerName,
        (SELECT COUNT(DISTINCT cbel.evidence_id) FROM candidate_bets cb INNER JOIN candidate_bet_evidence_links cbel ON cbel.candidate_bet_id = cb.id WHERE cb.decision_id = d.id) AS evidenceCount,
        (SELECT COUNT(*) FROM (SELECT e.account_id FROM candidate_bets cb JOIN candidate_bet_evidence_links l ON l.candidate_bet_id=cb.id JOIN evidence_items e ON e.id=l.evidence_id WHERE cb.decision_id=d.id AND e.account_id IS NOT NULL UNION SELECT a.account_id FROM candidate_bet_account_links a JOIN candidate_bets cb ON cb.id=a.candidate_bet_id WHERE cb.decision_id=d.id)) AS accountCount
      FROM decisions d LEFT JOIN operators owner ON owner.id = d.owner_operator_id
      ORDER BY CASE d.state WHEN 'ready' THEN 1 WHEN 'review_due' THEN 2 WHEN 'committed' THEN 3 ELSE 4 END, d.review_at ASC, d.title ASC
    `).all<{
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
    const summary = (await this.list()).find((decision) => decision.slug === slug)
    if (!summary) return null
    const detailResult = await this.connection.binding.prepare(`
      SELECT d.question AS question, d.confidence AS confidence, d.rationale AS rationale, d.selected_candidate_bet_id AS selectedCandidateBetId
      FROM decisions d WHERE d.id = ? LIMIT 1
    `).bind(summary.id).all<{
      readonly question: string; readonly confidence: OperatorDecisionBrief['confidence']; readonly rationale: string | null; readonly selectedCandidateBetId: string | null
    }>()
    const detail = detailResult.results[0]
    if (!detail) return null
    const bets = await this.connection.binding.prepare(`
      SELECT id, title, summary, urgency, delivery_shape AS deliveryShape, success_measure AS successMeasure, assumptions, counter_evidence AS counterEvidence
      FROM candidate_bets WHERE decision_id = ? ORDER BY id ASC
    `).bind(summary.id).all<{
      readonly id: string; readonly title: string; readonly summary: string; readonly urgency: string | null; readonly deliveryShape: string | null
      readonly successMeasure: string | null; readonly assumptions: string | null; readonly counterEvidence: string | null
    }>()
    const hydratedBets = await Promise.all(bets.results.map(async (bet) => {
      const accounts = await this.connection.binding.prepare(`
        SELECT a.id AS id, a.slug AS slug, a.name AS name, a.revenue_cents AS revenueCents, a.health AS health
        FROM accounts a WHERE a.id IN (SELECT e.account_id FROM evidence_items e JOIN candidate_bet_evidence_links l ON l.evidence_id=e.id WHERE l.candidate_bet_id=? UNION SELECT account_id FROM candidate_bet_account_links WHERE candidate_bet_id=?) ORDER BY a.name ASC
      `).bind(bet.id,bet.id).all<{ readonly id: string; readonly slug: string; readonly name: string; readonly revenueCents: number | null; readonly health: string | null }>()
      const evidence = await this.connection.binding.prepare(`
        SELECT evidence.*, cbel.stance AS stance
        FROM (${evidenceReadSelect}) evidence
        INNER JOIN candidate_bet_evidence_links cbel ON cbel.evidence_id = evidence.id
        WHERE cbel.candidate_bet_id = ?
        ORDER BY ${observedTimeOrderSql('evidence.observedAt')}, evidence.id ASC
      `).bind(bet.id).all<EvidenceReadRow & { readonly stance: 'supporting' | 'contradicting' }>()
      const counts = await this.connection.binding.prepare(`
        SELECT stance, COUNT(*) AS count FROM candidate_bet_evidence_links WHERE candidate_bet_id = ? GROUP BY stance
      `).bind(bet.id).all<{ readonly stance: 'supporting' | 'contradicting'; readonly count: number }>()
      return {
        ...bet,
        accounts: accounts.results.map((account) => ({ ...account, revenueCents: account.revenueCents === null ? null : Number(account.revenueCents) })),
        evidence: evidence.results.map((row) => ({ ...mapEvidenceRead(row), stance: row.stance })),
        metrics: {
          supportingCount: Number(counts.results.find((count) => count.stance === 'supporting')?.count ?? 0),
          contradictingCount: Number(counts.results.find((count) => count.stance === 'contradicting')?.count ?? 0),
          affectedAccountCount: accounts.results.length,
          affectedRequesterCount:new Set(evidence.results.map(e=>e.requesterId).filter(Boolean)).size,
          latestSupportAt:evidence.results.find(e=>e.stance==='supporting')?.observedAt??null,
        },
      }
    }))
    const roadmap = await this.connection.binding.prepare(`
      SELECT ri.slug AS slug, ri.title AS title, ri.status AS status
      FROM roadmap_items ri WHERE ri.decision_id = ? AND ri.candidate_bet_id = ? LIMIT 1
    `).bind(summary.id, detail.selectedCandidateBetId).all<Pick<OperatorRoadmapCard, 'slug' | 'title' | 'status'>>()
    return { ...summary, ...detail, bets: hydratedBets, roadmapItem: roadmap.results[0] ?? null }
  }
}
