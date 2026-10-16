import type { DatabaseConnection } from '@/core/platform/database'
import { MutationError } from '@/core/app/operator-mutations'
import { counts, emptyCounts, requestDeliverySql, requestVersionCounts, requestVersionDeliverySql, type DeliveryCounts, type RequestVersionDeliveryRow } from '../releases/counts'
import { requestActions, requestAvailabilitySql, type RequestActions, type RequestAvailabilityRow } from './operator-availability'
import { requestContextRowsSql, type RequestContextRowName } from './request-context-rows'

export type RequestContext = Record<RequestContextRowName, Record<string, unknown>[]> & {
  requestId: string
  actions: RequestActions
  statusVersions: ReturnType<typeof requestVersionCounts>
  deliveryCounts: DeliveryCounts
}

function groupByRequest<T extends { requestId: string }>(rows: T[]) {
  const grouped = new Map<string, T[]>()
  for (const row of rows) {
    let group = grouped.get(row.requestId)
    if (!group) { group = []; grouped.set(row.requestId, group) }
    group.push(row)
  }
  return grouped
}

/** Read one visible list page in one D1 roundtrip. Missing slugs are omitted. */
export async function requestContexts(database: DatabaseConnection, slugs: string[]): Promise<Record<string, RequestContext>> {
  const selected = [...new Set(slugs)]
  if (selected.length === 0) return {}
  if (selected.length > 50) throw new MutationError(400, 'Request context is limited to one page of 50 requests.')
  const db = database.binding
  const placeholders = selected.map(() => '?').join(',')
  const requestIdsSql = `SELECT id FROM requests WHERE slug IN (${placeholders})`
  const rowQueries = Object.entries(requestContextRowsSql(requestIdsSql)) as [RequestContextRowName, string][]
  const results = await db.batch<Record<string, unknown>>([
    db.prepare(`${requestAvailabilitySql} WHERE r.slug IN (${placeholders})`).bind(...selected),
    ...rowQueries.map(([, sql]) => db.prepare(sql).bind(...selected)),
    db.prepare(requestVersionDeliverySql(requestIdsSql)).bind(...selected),
    db.prepare(requestDeliverySql(requestIdsSql)).bind(...selected),
  ])
  const requests = results[0].results as unknown as RequestAvailabilityRow[]
  const contextsById = new Map<string, RequestContext>()
  for (const request of requests) {
    contextsById.set(request.id, {
      requestId: request.id, actions: requestActions(request),
      statusVersions: [], deliveryCounts: emptyCounts(),
      voters: [], accounts: [], notes: [], comments: [], edits: [], attachments: [],
      commentEdits: [], appeals: [], uploads: [], votesByAccount: [],
    })
  }
  rowQueries.forEach(([name], index) => {
    for (const { contextRequestId, ...row } of results[index + 1].results) {
      contextsById.get(contextRequestId as string)?.[name].push(row)
    }
  })
  const versionRows = results[rowQueries.length + 1].results as unknown as RequestVersionDeliveryRow[]
  const deliveryRows = results[rowQueries.length + 2].results as unknown as { requestId: string; state: string; n: number }[]
  const versions = groupByRequest(versionRows)
  const deliveries = groupByRequest(deliveryRows)
  for (const [id, context] of contextsById) {
    context.statusVersions = requestVersionCounts(versions.get(id) ?? [])
    context.deliveryCounts = counts(deliveries.get(id) ?? [])
    for (const version of context.statusVersions) {
      for (const key of Object.keys(context.deliveryCounts) as (keyof DeliveryCounts)[]) context.deliveryCounts[key] += version.counts[key]
    }
  }
  return Object.fromEntries(requests.map(request => [request.slug, contextsById.get(request.id)!]))
}
