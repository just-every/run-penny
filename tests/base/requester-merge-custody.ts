import { applyD1Migrations, reset } from 'cloudflare:test'
import { expect, inject, vi } from 'vitest'
import { call, env, mockMail, owner, requester } from './support'
import { explicitConsentBoard } from './explicit-consent-board'

type Row = Record<string, string | number | null>
const tables = [
  'requester_addresses', 'requests', 'request_comments', 'evidence_items',
  'request_content_submissions', 'request_votes', 'request_vote_contributions',
  'request_follows', 'request_follow_contributions', 'requester_update_permissions',
  'notification_events', 'notification_intents', 'notification_batches',
  'notification_attempts', 'notification_link_epochs', 'requester_identity_merges',
  'request_notification_mutes', 'requester_notification_preferences',
] as const
const sorted = (rows: Row[]) => rows.toSorted((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
async function records(table: string) {
  return (await env.DB.prepare(`SELECT * FROM ${table}`).all<Row>()).results
}
async function snapshot(): Promise<Record<string, Row[]>> {
  return Object.fromEntries(await Promise.all(tables.map(async table => [table, sorted(await records(table))])))
}
const stable = (rows: Row[]) => sorted(rows.map(({ updated_at: _updated, ...row }) => row))
async function accepted(response: Promise<Response>, status = 200) {
  const result = await response
  expect(result.status, await result.clone().text()).toBe(status)
  return result
}
/** Extends the existing identity-merge sanity journey without adding a registration. */
export async function proveRequesterMergeCustody() {
  vi.restoreAllMocks()
  await reset()
  await applyD1Migrations(env.DB, inject('migrations'))
  mockMail()
  const operator = await owner({ timezone: 'UTC' })
  const source = await requester('Synthetic Penny source'), target = await requester('Synthetic Penny survivor')
  const people = await records('requesters')
  const sourceId = people.find(row => row.display_name === 'Synthetic Penny source')!.id as string
  const targetId = people.find(row => row.display_name === 'Synthetic Penny survivor')!.id as string
  expect(sourceId).not.toBe(targetId)
  const addresses = await records('requester_addresses')
  expect(addresses).toHaveLength(2)
  expect(addresses.every(row => row.verified_at !== null)).toBe(true)
  expect(new Set(addresses.map(row => row.email)).size).toBe(2)
  await accepted(call('/api/operator/boards', { name: 'Merge custody', slug: 'merge-custody', visibility: 'public' }, operator), 201)
  await explicitConsentBoard('merge-custody', (path, method, body) => call(path, body, operator, method))
  async function submit(person: typeof source, title: string) {
    const response = await accepted(call('/api/public/requests', {
      title, description: `${title} original wording`, boardSlug: 'merge-custody', idempotencyKey: crypto.randomUUID(),
    }, person), 201)
    const { slug } = await response.json() as { slug: string }
    await accepted(call(`/api/operator/moderation/${slug}`, {
      verdict: 'approved', title, description: `${title} public wording`, boardSlug: 'merge-custody', displayName: title,
    }, operator))
    return slug
  }
  const sourceSlug = await submit(source, 'Source request'), targetSlug = await submit(target, 'Survivor request')
  const sharedSlug = await submit(source, 'Shared request')
  await accepted(call(`/api/public/requests/${sharedSlug}/vote`, {}, target), 204)
  for (const [person, slugs] of [[source, [sourceSlug, sharedSlug]], [target, [targetSlug, sharedSlug]]] as const) {
    for (const slug of slugs) await accepted(call(`/api/public/requests/${slug}/follow`, {}, person), 204)
  }
  for (const [person, slug, body] of [[source, targetSlug, 'Source comment'], [target, sourceSlug, 'Survivor comment']] as const) {
    const response = await accepted(call(`/api/public/requests/${slug}/comments`, { body }, person), 201)
    const { id } = await response.json() as { id: string }
    await accepted(call(`/api/operator/comments/${id}/moderate`, { verdict: 'approved', publicAuthorDisplayName: body }, operator))
  }
  // Existing provider suppression is input state, not authority conferred by the merge.
  const suppressedAt = '2026-10-01T09:00:00.000Z'
  await env.DB.prepare('UPDATE requester_addresses SET suppressed_at=? WHERE requester_id=?').bind(suppressedAt, sourceId).run()
  const before = await snapshot()
  expect(before.request_votes).toHaveLength(4)
  expect(before.request_follows).toHaveLength(4)
  expect(before.requester_update_permissions).toHaveLength(4)
  expect(before.requester_update_permissions.filter(row => row.suppressed_at === suppressedAt)).toHaveLength(2)
  expect(before.request_comments).toHaveLength(2)
  expect(before.notification_intents.length).toBeGreaterThan(0)
  const activity = async (person: typeof source) => {
    const response = await accepted(call('/api/public/requester/activity', undefined, person))
    return await response.json() as Record<'requests' | 'votes' | 'follows' | 'comments', Row[]>
  }
  const sourceActivity = await activity(source), targetActivity = await activity(target)
  expect(sourceActivity.requests).toHaveLength(2)
  expect(targetActivity.requests).toHaveLength(1)
  expect(sourceActivity.comments).toHaveLength(1)
  expect(targetActivity.comments).toHaveLength(1)
  const mergePath = `/api/operator/requesters/${sourceId}/merge`, input = { targetRequesterId: targetId }
  const untouched = async () => expect(await snapshot()).toEqual(before)
  await accepted(call(mergePath, input, source), 401)
  await untouched()
  await accepted(call(mergePath, { targetRequesterId: sourceId }, operator), 409)
  await untouched()
  // Refusal to record the attributed audit must roll back every custody transfer.
  await env.DB.exec("CREATE TRIGGER refuse_identity_merge_audit BEFORE INSERT ON audit_entries WHEN NEW.action='requester.merged' BEGIN SELECT RAISE(ABORT,'synthetic-penny-merge-audit-failure'); END;")
  await accepted(call(mergePath, input, operator), 503)
  await untouched()
  await env.DB.exec('DROP TRIGGER refuse_identity_merge_audit')
  const transport = vi.mocked(fetch).mock.calls.length
  await accepted(call(mergePath, input, operator))
  expect(vi.mocked(fetch).mock.calls).toHaveLength(transport)
  const after = await snapshot()
  const transfer = (rows: Row[], field = 'requester_id') => rows.map(row => ({ ...row, [field]: row[field] === sourceId ? targetId : row[field] }))
  for (const table of ['requester_addresses', 'request_comments', 'evidence_items', 'request_content_submissions', 'requester_update_permissions', 'notification_intents', 'notification_batches'] as const) {
    expect(stable(after[table]), table).toEqual(stable(transfer(before[table])))
  }
  expect(stable(after.requests)).toEqual(stable(transfer(before.requests, 'author_requester_id')))
  // Retain the survivor's existing shared contribution; transfer only distinct source contributions.
  for (const table of ['request_votes', 'request_vote_contributions', 'request_follows', 'request_follow_contributions'] as const) {
    const retained = before[table].filter(row => row.requester_id === targetId)
    const distinct = before[table].filter(row => row.requester_id === sourceId && !retained.some(other => other.request_id === row.request_id))
    expect(stable(after[table]), table).toEqual(stable([...retained, ...transfer(distinct)]))
    expect(after[table]).toHaveLength(3)
  }
  for (const table of ['notification_events', 'notification_attempts', 'notification_link_epochs', 'request_notification_mutes', 'requester_notification_preferences'] as const) {
    expect(after[table], table).toEqual(before[table])
  }
  for (const slug of [sourceSlug, targetSlug, sharedSlug]) {
    const response = await accepted(call(`/api/public/requests/${slug}`))
    expect(await response.json()).toMatchObject({ slug, voteCount: 1 })
  }
  const expectedActivity = {
    requests: sorted([...sourceActivity.requests, ...targetActivity.requests]),
    comments: sorted([...sourceActivity.comments, ...targetActivity.comments]),
    votes: sorted([...sourceActivity.votes, ...targetActivity.votes].filter((row, i, all) => all.findIndex(other => other.slug === row.slug) === i)),
    follows: sorted([...sourceActivity.follows, ...targetActivity.follows].filter((row, i, all) => all.findIndex(other => other.slug === row.slug) === i)),
  }
  // Both independently verified sessions now read the same exact union.
  for (const person of [source, target]) {
    const result = await activity(person)
    for (const key of ['requests', 'comments', 'votes', 'follows'] as const) expect(sorted(result[key]), key).toEqual(expectedActivity[key])
  }
  expect(after.requester_identity_merges).toHaveLength(1)
  const nativeOwner = (await records('oa_operators')).find(row => row.role === 'owner')!
  const actor = (await records('operators')).find(row => row.email === nativeOwner.email)!
  const merge = after.requester_identity_merges[0]
  expect(merge).toEqual({ id: expect.any(String), source_requester_id: sourceId, target_requester_id: targetId, actor_operator_id: actor.id, created_at: expect.any(String), updated_at: expect.any(String) })
  const audits = (await records('audit_entries')).filter(row => row.action === 'requester.merged')
  expect(audits).toHaveLength(1)
  expect(audits[0]).toMatchObject({ actor_type: 'operator', actor_id: actor.id, entity_type: 'requester', entity_id: sourceId, occurred_at: merge.created_at })
  expect(JSON.parse(String(audits[0].details_json))).toEqual({ survivorRequesterId: targetId })
  await accepted(call(mergePath, input, operator), 409)
  await accepted(call(`/api/operator/requesters/${targetId}/merge`, { targetRequesterId: sourceId }, operator), 409)
  expect(await snapshot()).toEqual(after)
  expect((await records('audit_entries')).filter(row => row.action === 'requester.merged')).toEqual(audits)
  expect(vi.mocked(fetch).mock.calls).toHaveLength(transport)
}
