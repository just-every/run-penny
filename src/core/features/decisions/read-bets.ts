import type { DatabaseConnection } from '@/core/platform/database'
import type { OperatorDecisionBrief } from '@/core/shared/api/operator'
import { evidenceReadSelect, mapEvidenceRead, type EvidenceReadRow } from '../evidence/read-repository'
import { observedTimeOrderSql } from '../evidence/observed-time'

type Bet = Omit<OperatorDecisionBrief['bets'][number], 'accounts' | 'evidence' | 'metrics'>
type Account = OperatorDecisionBrief['bets'][number]['accounts'][number] & { candidateBetId: string }
type Evidence = EvidenceReadRow & { candidateBetId: string; stance: 'supporting' | 'contradicting' }
type Count = { candidateBetId: string; stance: 'supporting' | 'contradicting'; count: number }

/** Read each relationship once for the whole brief, retaining counts of links
 * even when incomplete evidence has no version to join into its projection. */
export async function readDecisionBets(database: DatabaseConnection, decisionId: string): Promise<OperatorDecisionBrief['bets']> {
  const db = database.binding
  const [bets, accounts, evidence, counts] = await Promise.all([
    db.prepare(`SELECT id, title, summary, urgency, delivery_shape AS deliveryShape,
      success_measure AS successMeasure, assumptions, counter_evidence AS counterEvidence
      FROM candidate_bets WHERE decision_id = ? ORDER BY id ASC`).bind(decisionId).all<Bet>(),
    db.prepare(`SELECT links.candidateBetId, a.id, a.slug, a.name, a.revenue_cents AS revenueCents, a.health
      FROM (
        SELECT cb.id AS candidateBetId, e.account_id AS accountId
        FROM candidate_bets cb JOIN candidate_bet_evidence_links l ON l.candidate_bet_id=cb.id
        JOIN evidence_items e ON e.id=l.evidence_id WHERE cb.decision_id=?
        UNION
        SELECT cb.id AS candidateBetId, l.account_id AS accountId
        FROM candidate_bets cb JOIN candidate_bet_account_links l ON l.candidate_bet_id=cb.id
        WHERE cb.decision_id=?
      ) links JOIN accounts a ON a.id=links.accountId
      ORDER BY a.name ASC`).bind(decisionId, decisionId).all<Account>(),
    db.prepare(`SELECT evidence.*, cbel.candidate_bet_id AS candidateBetId, cbel.stance
      FROM (${evidenceReadSelect}) evidence
      JOIN candidate_bet_evidence_links cbel ON cbel.evidence_id=evidence.id
      JOIN candidate_bets cb ON cb.id=cbel.candidate_bet_id
      WHERE cb.decision_id=?
      ORDER BY ${observedTimeOrderSql('evidence.observedAt')}, evidence.id ASC`).bind(decisionId).all<Evidence>(),
    db.prepare(`SELECT l.candidate_bet_id AS candidateBetId, l.stance, COUNT(*) AS count
      FROM candidate_bet_evidence_links l JOIN candidate_bets cb ON cb.id=l.candidate_bet_id
      WHERE cb.decision_id=? GROUP BY l.candidate_bet_id, l.stance`).bind(decisionId).all<Count>(),
  ])
  const accountsByBet = groupByBet(accounts.results), evidenceByBet = groupByBet(evidence.results), countsByBet = groupByBet(counts.results)
  return bets.results.map(bet => {
    const accounts = accountsByBet.get(bet.id) ?? [], evidence = evidenceByBet.get(bet.id) ?? [], counts = countsByBet.get(bet.id) ?? []
    return {
      ...bet,
      accounts: accounts.map(({ candidateBetId: _, ...account }) => ({ ...account, revenueCents: account.revenueCents === null ? null : Number(account.revenueCents) })),
      evidence: evidence.map(row => ({ ...mapEvidenceRead(row), stance: row.stance })),
      metrics: {
        supportingCount: Number(counts.find(count => count.stance === 'supporting')?.count ?? 0),
        contradictingCount: Number(counts.find(count => count.stance === 'contradicting')?.count ?? 0),
        affectedAccountCount: accounts.length,
        affectedRequesterCount: new Set(evidence.map(row => row.requesterId).filter(Boolean)).size,
        latestSupportAt: evidence.find(row => row.stance === 'supporting')?.observedAt ?? null,
      },
    }
  })
}

function groupByBet<T extends { candidateBetId: string }>(rows: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const group = groups.get(row.candidateBetId)
    if (group) group.push(row)
    else groups.set(row.candidateBetId, [row])
  }
  return groups
}
