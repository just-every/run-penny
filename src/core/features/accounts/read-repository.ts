import type { OperatorAccountCard, OperatorAccountDetail, OperatorDecisionListItem } from '@/core/shared/api/operator'
import type { DatabaseConnection } from '@/core/platform/database'
import { EvidenceReadRepository } from '@/core/features/evidence/read-repository'

export class AccountsReadRepository {
  private readonly connection: DatabaseConnection

  constructor(connection: DatabaseConnection) {
    this.connection = connection
  }

  async list(): Promise<readonly OperatorAccountCard[]> {
    const result = await this.connection.binding.prepare(`
      SELECT
        a.id AS id, a.slug AS slug, a.name AS name, a.revenue_cents AS revenueCents, a.renewal_date AS renewalDate, a.health AS health,
        owner.id AS ownerId, owner.display_name AS ownerName,
        (SELECT COUNT(*) FROM requester_account_links ral WHERE ral.account_id = a.id) AS requesterCount,
        (SELECT COUNT(*) FROM evidence_items e WHERE e.account_id = a.id) AS evidenceCount
      FROM accounts a LEFT JOIN operators owner ON owner.id = a.internal_owner_id
      ORDER BY a.name ASC
    `).all<{
      readonly id: string; readonly slug: string; readonly name: string; readonly revenueCents: number | null; readonly renewalDate: string | null; readonly health: string | null
      readonly ownerId: string | null; readonly ownerName: string | null; readonly requesterCount: number; readonly evidenceCount: number
    }>()
    return result.results.map((row) => ({
      id: row.id, slug: row.slug, name: row.name, revenueCents: row.revenueCents === null ? null : Number(row.revenueCents), renewalDate: row.renewalDate, health: row.health,
      owner: row.ownerId && row.ownerName ? { id: row.ownerId, displayName: row.ownerName } : null,
      requesterCount: Number(row.requesterCount), evidenceCount: Number(row.evidenceCount),
    }))
  }

  async find(slug: string): Promise<OperatorAccountDetail | null> {
    const account = (await this.list()).find((candidate) => candidate.slug === slug)
    if (!account) return null
    const requesters = await this.connection.binding.prepare(`
      SELECT
        requester.id AS id, requester.display_name AS displayName,
        (
          SELECT requester_address.email
          FROM requester_addresses requester_address
          WHERE requester_address.requester_id = requester.id
          ORDER BY
            CASE
              WHEN requester_address.verified_at IS NOT NULL AND requester_address.suppressed_at IS NULL THEN 0
              WHEN requester_address.suppressed_at IS NULL THEN 1
              ELSE 2
            END,
            requester_address.created_at ASC,
            requester_address.id ASC
          LIMIT 1
        ) AS email
      FROM requester_account_links ral
      INNER JOIN requesters requester ON requester.id = ral.requester_id
      WHERE ral.account_id = ? ORDER BY requester.display_name ASC
    `).bind(account.id).all<{ readonly id: string; readonly displayName: string; readonly email: string | null }>()
    const decisions = await this.connection.binding.prepare(`
      SELECT DISTINCT d.slug AS slug, d.title AS title, d.state AS state
      FROM decisions d JOIN candidate_bets cb ON cb.decision_id=d.id
      WHERE EXISTS(SELECT 1 FROM candidate_bet_account_links l WHERE l.candidate_bet_id=cb.id AND l.account_id=?)
      OR EXISTS(SELECT 1 FROM candidate_bet_evidence_links l JOIN evidence_items e ON e.id=l.evidence_id WHERE l.candidate_bet_id=cb.id AND e.account_id=?)
      ORDER BY d.title ASC
    `).bind(account.id,account.id).all<Pick<OperatorDecisionListItem, 'slug' | 'title' | 'state'>>()
    const requests=await this.connection.binding.prepare(`SELECT DISTINCT r.id,r.slug,r.title FROM requests r JOIN request_evidence_links l ON l.request_id=r.id JOIN evidence_items e ON e.id=l.evidence_id WHERE e.account_id=? ORDER BY r.title,r.id`).bind(account.id).all<{id:string;slug:string;title:string}>()
    return {
      ...account,
      requests:requests.results,
      requesters: requesters.results,
      evidence: await new EvidenceReadRepository(this.connection).list(undefined, slug),
      decisions: decisions.results,
    }
  }
}
