import { boundedIds } from '@/core/features/workspace/list-query'
import { readAccountContext } from './read-context'
import type { OperatorAccountCard, OperatorAccountDetail } from '@/core/shared/api/operator'
import type { DatabaseConnection } from '@/core/platform/database'

export class AccountsReadRepository {
  private readonly connection: DatabaseConnection

  constructor(connection: DatabaseConnection) {
    this.connection = connection
  }

  async list(ids?: readonly string[]): Promise<readonly OperatorAccountCard[]> {
    const result = await this.connection.binding.prepare(`
      SELECT
        a.id AS id, a.slug AS slug, a.name AS name, a.revenue_cents AS revenueCents, a.renewal_date AS renewalDate, a.health AS health,
        owner.id AS ownerId, owner.display_name AS ownerName,
        (SELECT COUNT(*) FROM requester_account_links ral WHERE ral.account_id = a.id) AS requesterCount,
        (SELECT COUNT(*) FROM evidence_items e WHERE e.account_id = a.id) AS evidenceCount
      FROM accounts a LEFT JOIN operators owner ON owner.id = a.internal_owner_id
      ${boundedIds('a', ids)}
      ORDER BY a.name ASC
      LIMIT 25
    `).bind(...(ids ?? [])).all<{
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
    const record = await this.connection.binding.prepare('SELECT id FROM accounts WHERE slug=? LIMIT 1').bind(slug).first<{id:string}>()
    const account = record ? (await this.list([record.id]))[0] : undefined
    if (!account) return null
    return { ...account, ...await readAccountContext(this.connection, account) }
  }
}
