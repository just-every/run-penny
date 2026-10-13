import type { OperatorAccountCard, OperatorAccountDetail } from '@/core/shared/api/operator'
import type { DatabaseConnection } from '@/core/platform/database'
import { EvidenceReadRepository } from '@/core/features/evidence/read-repository'
import { listIds } from '@/core/features/workspace/list-repository'
import { PAGE_SIZE } from '@/core/features/workspace/list-query'

/** Bounded account previews share the same relationships as their View all lists. */
export async function readAccountContext(database: DatabaseConnection, account: OperatorAccountCard): Promise<Pick<OperatorAccountDetail, 'requests' | 'requesters' | 'decisions' | 'evidence' | 'linkedRequestCount' | 'linkedDecisionCount'>> {
  const [requests, requesters, decisions, evidence] = await Promise.all([
    listIds(database, 'requests', { account: account.id, sort: 'name' }),
    listIds(database, 'requesters', { account: account.id, sort: 'name' }),
    listIds(database, 'decisions', { account: account.id, sort: 'name' }),
    new EvidenceReadRepository(database).list(undefined, account.slug),
  ])
  const placeholders = (ids: readonly string[]) => ids.length ? ids.map(() => '?').join(',') : 'NULL'
  const [requestRows, requesterRows, decisionRows] = await Promise.all([
    database.binding.prepare(`SELECT id,slug,title FROM requests WHERE id IN (${placeholders(requests.ids)}) LIMIT ?`).bind(...requests.ids, PAGE_SIZE).all<OperatorAccountDetail['requests'][number]>(),
    database.binding.prepare(`
      SELECT requester.id AS id, requester.display_name AS displayName,
        (SELECT address.email FROM requester_addresses address WHERE address.requester_id=requester.id
          ORDER BY CASE WHEN address.verified_at IS NOT NULL AND address.suppressed_at IS NULL THEN 0
            WHEN address.suppressed_at IS NULL THEN 1 ELSE 2 END, address.created_at ASC, address.id ASC LIMIT 1) AS email
      FROM requesters requester WHERE requester.id IN (${placeholders(requesters.ids)}) LIMIT ?
    `).bind(...requesters.ids, PAGE_SIZE).all<OperatorAccountDetail['requesters'][number]>(),
    database.binding.prepare(`SELECT id,slug,title,state FROM decisions WHERE id IN (${placeholders(decisions.ids)}) LIMIT ?`).bind(...decisions.ids, PAGE_SIZE).all<OperatorAccountDetail['decisions'][number] & { id: string }>(),
  ])
  const order = <T extends { id: string }>(rows: readonly T[], ids: readonly string[]) => ids.flatMap(id => {
    const row = rows.find(row => row.id === id)
    return row ? [row] : []
  })
  return {
    requests: order(requestRows.results, requests.ids),
    requesters: order(requesterRows.results, requesters.ids),
    decisions: order(decisionRows.results, decisions.ids),
    evidence,
    linkedRequestCount: requests.total,
    linkedDecisionCount: decisions.total,
  }
}
