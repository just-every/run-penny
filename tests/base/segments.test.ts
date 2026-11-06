import { applyD1Migrations, reset } from 'cloudflare:test'
import { afterEach, beforeEach, expect, inject, it, vi } from 'vitest'
import { call, env, messages, owner } from './support'
import { graph } from './notification-regression-fixture'
import type { Archive, ErasureJournal } from '@/core/features/data/archive'
import type { SavedSegment } from '@/core/features/segments/repository'

type Cookie = { Cookie: string }
type Segment = SavedSegment & { accountIds: string[] }
const rule = (value: string) => ({ attribute: 'internalOwnerId', operator: 'equals', value })
async function json<T>(path: string, cookie: Cookie, body?: unknown, method?: string, status = 200): Promise<T> {
 const response = await call(path, body, cookie, method)
 expect(response.status, await response.clone().text()).toBe(status)
 if (path.startsWith('/api/operator/segments')) expect(response.headers.get('Cache-Control')).toBe('no-store')
 return response.json() as Promise<T>
}
async function fixture() {
 const g = await graph(), actor = (await env.DB.prepare('SELECT id FROM operators').first<string>('id'))!
 const email = ['synthetic-penny-peer', 'example.test'].join('@')
 expect((await call('/api/operator/settings/operators', { email }, g.operator)).status).toBe(202)
 const token = new URL(messages.findLast(message => message.to === email)!.url).searchParams.get('token')
 const confirmed = await call('/auth/confirm', { token })
 expect(confirmed.status).toBe(303)
 const peer = { Cookie: confirmed.headers.get('Set-Cookie')!.split(';')[0] }
 expect((await call('/api/auth/session', undefined, peer)).status).toBe(200)
 const peerId = (await env.DB.prepare('SELECT id FROM operators WHERE email=?').bind(email).first<string>('id'))!
 const nativeId = (await env.DB.prepare('SELECT id FROM oa_operators WHERE email=?').bind(email).first<string>('id'))!
 const accounts = []
 for (const [name, internalOwnerId] of [['synthetic-penny-changing-account', actor], ['synthetic-penny-control-account', peerId]]) {
  accounts.push(await json<{ id: string; slug: string }>('/api/operator/accounts', g.operator, { name, internalOwnerId }, 'POST', 201))
 }
 return { ...g, actor, peer, peerId, nativeId, accounts }
}
const savedState = async () => (await env.DB.batch([
 env.DB.prepare('SELECT * FROM penny_segments ORDER BY id'),
 env.DB.prepare('SELECT * FROM accounts ORDER BY id'),
 env.DB.prepare("SELECT * FROM audit_entries WHERE entity_type IN ('segment','account') ORDER BY id"),
])).map(result => result.results)

beforeEach(async () => { await reset(); await applyD1Migrations(env.DB, inject('migrations').filter(m => m.name < '0110')) })
afterEach(() => vi.restoreAllMocks())

it('[SEG-006] saved native owner rules follow exact current account membership and refuse unauthorized or invalid saves without public exposure', async () => {
 const g = await fixture()
 // Upgrade the populated previous head and compare every prior cell, including authority.
 const tables = (await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name!='d1_migrations' ORDER BY name").all<{ name: string }>()).results
 const previous = await Promise.all(tables.map(async table => ({ name: table.name, columns: (await env.DB.prepare(`PRAGMA table_info("${table.name}")`).all<{ name: string }>()).results.map(column => `"${column.name}"`) })))
 const priorRows = async () => (await env.DB.batch(previous.map(table => env.DB.prepare(`SELECT ${table.columns.join(',')} FROM "${table.name}" ORDER BY rowid`)))).map(result => result.results)
 const ledger = async () => (await env.DB.prepare('SELECT * FROM d1_migrations ORDER BY id').all()).results
 const ledgerBefore = await ledger()
 const before = await priorRows()
 await applyD1Migrations(env.DB, inject('migrations')); expect(await priorRows()).toEqual(before)
 const upgradedLedger = await ledger()
 expect(upgradedLedger.slice(0, ledgerBefore.length)).toEqual(ledgerBefore)
 expect(upgradedLedger.slice(ledgerBefore.length).map(row => row.name)).toEqual(['0110_saved_segments.sql'])
 await applyD1Migrations(env.DB, inject('migrations')); expect(await priorRows()).toEqual(before)
 expect(await ledger()).toEqual(upgradedLedger)

 const definition = { name: 'synthetic-penny-private-segment', rule: rule(g.peerId) }
 const saved = await json<{ id: string }>('/api/operator/segments', g.operator, definition, 'POST', 201), path = `/api/operator/segments/${saved.id}`
 const read = () => json<Segment>(path, g.operator)
 expect(await read()).toEqual({ id: saved.id, ...definition, accountIds: [g.accounts[1].id] })
 expect(await json('/api/operator/segments', g.peer)).toEqual([{ id: saved.id, ...definition }])
 // Both reads follow a completed native PATCH immediately, with an unaffected member.
 for (const [internalOwnerId, expected] of [[g.peerId, g.accounts.map(account => account.id).sort()], [g.actor, [g.accounts[1].id]]] as const) {
  const changedAt = Date.now()
  await json(`/api/operator/accounts/${g.accounts[0].id}`, g.operator, { name: 'synthetic-penny-changing-account', internalOwnerId }, 'PATCH')
  expect((await read()).accountIds).toEqual(expected)
  expect(Date.now() - changedAt).toBeLessThan(5 * 60 * 1000)
 }
 const edited = { name: 'synthetic-penny-renamed-segment', rule: rule(g.actor) }
 await json(path, g.peer, edited, 'PATCH')
 expect(await read()).toEqual({ id: saved.id, ...edited, accountIds: [g.accounts[0].id] })
 expect(await json('/api/operator/segments', g.operator)).toEqual([{ id: saved.id, ...edited }])
 // An audit failure must roll the saved definition back, including its name.
 const baseline = await savedState()
 await env.DB.exec("CREATE TRIGGER refuse_segment_audit BEFORE INSERT ON audit_entries WHEN NEW.entity_type='segment' BEGIN SELECT RAISE(ABORT,'no audit'); END")
 try { expect((await call(path, definition, g.operator, 'PATCH')).status).toBe(503) }
 finally { await env.DB.exec('DROP TRIGGER refuse_segment_audit') }
 expect(await savedState()).toEqual(baseline)
 const invalid = [
  { ...definition, name: ' ' }, { ...definition, entity: 'requesters' },
  { ...definition, rule: { ...definition.rule, attribute: 'revenueCents' } },
  { ...definition, rule: { ...definition.rule, operator: 'contains' } },
  { ...definition, rule: { ...definition.rule, value: null } },
  { ...definition, rule: { ...definition.rule, value: 'not-an-identity' } },
  { ...definition, rule: { ...definition.rule, scope: 'all' } },
 ]
 for (const input of invalid) {
  expect((await call('/api/operator/segments', input, g.operator)).status).toBe(400)
  expect((await call(path, input, g.operator, 'PATCH')).status).toBe(400)
 }
 const absent = '01J00000000000000000000000'
 expect((await call('/api/operator/segments', { ...definition, rule: rule(absent) }, g.operator)).status).toBe(422)
 expect((await call(`/api/operator/segments/${absent}`, undefined, g.operator)).status).toBe(404)
 expect((await call('/api/operator/segments/invalid', undefined, g.operator)).status).toBe(400)
 for (const headers of [{}, g.person]) {
  for (const door of ['/api/operator/segments', path]) {
   const refused = await call(door, undefined, headers)
   expect(refused.status).toBe(401)
   const text = await refused.text()
   for (const value of [saved.id, definition.name, edited.name, g.peerId]) expect(text).not.toContain(value)
  }
  expect((await call('/api/operator/segments', definition, headers)).status).toBe(401)
  expect((await call(path, definition, headers, 'PATCH')).status).toBe(401)
 }
 for (const Origin of ['https://foreign.test', '']) {
  expect((await call('/api/operator/segments', definition, { ...g.operator, Origin })).status).toBe(403)
  expect((await call(path, definition, { ...g.operator, Origin }, 'PATCH')).status).toBe(403)
 }
 expect((await call('/api/auth/sign-out', {}, g.peer)).status).toBe(204)
 for (const door of ['/api/operator/segments', path]) {
  const refused = await call(door, undefined, g.peer)
  expect(refused.status).toBe(401)
  const text = await refused.text()
  for (const value of [saved.id, definition.name, edited.name, g.peerId]) expect(text).not.toContain(value)
 }
 expect((await call('/api/operator/segments', definition, g.peer)).status).toBe(401)
 expect((await call(path, definition, g.peer, 'PATCH')).status).toBe(401)
 expect(await savedState()).toEqual(baseline)
 // A populated approved request linked to a matching account stays customer-safe.
 await env.DB.prepare('INSERT INTO requester_account_links(requester_id,account_id,created_at) VALUES(?,?,?)').bind(g.recipient.requesterId, g.accounts[0].id, new Date().toISOString()).run()
 for (const url of ['/api/public/requests', `/api/public/requests/${g.requests[0].slug}`, '/portal/feedback', `/portal/feedback/${g.requests[0].slug}`]) {
  const response = await call(url); expect(response.status).toBe(200)
  const text = await response.text(); expect(text).toContain('Public request 0')
  for (const privateValue of [definition.name, edited.name, 'synthetic-penny-changing-account', saved.id, g.actor, g.peerId, '"internalOwnerId"', '"internal_owner_id"', '"accountIds"', '"rule"']) expect(text).not.toContain(privateValue)
 }
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})

it('[SEG-006 DATA-001 DATA-003] native archives restore rules and membership while operator erasure removes targeted rules and fences replay', async () => {
 await applyD1Migrations(env.DB, inject('migrations'))
 const g = await fixture()
 const targeted = await json<{ id: string }>('/api/operator/segments', g.operator, { name: 'synthetic-penny-targeted-rule', rule: rule(g.peerId) }, 'POST', 201)
 const retained = await json<{ id: string }>('/api/operator/segments', g.peer, { name: 'synthetic-penny-retained-rule', rule: rule(g.actor) }, 'POST', 201)
 expect((await call(`/api/operator/settings/operators/${g.nativeId}`, {}, g.operator, 'DELETE')).status).toBe(200)
 expect((await call(`/api/operator/segments/${targeted.id}`, undefined, g.peer)).status).toBe(401)
 const source = await json<{ archive: Archive; journal: ErasureJournal }>('/api/operator/data/export', g.operator)
 expect(source.archive.tables.penny_segments).toHaveLength(2)
 expect(source.archive.tables.penny_segments.find(row => row.id === targeted.id)).toMatchObject({ internal_owner_id: g.peerId, created_by_operator_id: g.actor })
 expect(source.archive.tables.penny_segments.find(row => row.id === retained.id)).toMatchObject({ internal_owner_id: g.actor, created_by_operator_id: g.peerId })
 expect(source.archive.tables.oa_sessions).toBeUndefined()
 expect(JSON.stringify(source)).not.toContain(g.peer.Cookie.split('=')[1])
 const expected = await json<Segment>(`/api/operator/segments/${targeted.id}`, g.operator)
 await reset(); await applyD1Migrations(env.DB, inject('migrations'))
 const destination = await owner()
 await json('/api/operator/data/import', destination, source)
 expect(await json(`/api/operator/segments/${targeted.id}`, destination)).toEqual(expected)
 expect((await call(`/api/operator/segments/${targeted.id}`, undefined, g.operator)).status).toBe(401)
 expect((await call(`/api/operator/segments/${retained.id}`, undefined, g.peer)).status).toBe(401)
 const again = await json<{ archive: Archive; journal: ErasureJournal }>('/api/operator/data/export', destination)
 expect(again.archive.tables.penny_segments).toEqual(source.archive.tables.penny_segments)
 expect(again.archive.tables.accounts).toEqual(source.archive.tables.accounts)
 const control = await json<Segment>(`/api/operator/segments/${retained.id}`, destination)
 const root = { table: 'operators', id: g.peerId }
 const preview = await json<{ planHash: string; counts: Record<string, number>; blockedCopies: unknown[] }>('/api/operator/data/erasure/preview', destination, root)
 expect(preview.counts.penny_segments).toBe(1); expect(preview.blockedCopies).toEqual([])
 const completed = await json<{ status: string }>('/api/operator/data/erasure', destination, { ...root, planHash: preview.planHash })
 expect(completed.status).toBe('complete')
 expect((await call(`/api/operator/segments/${targeted.id}`, undefined, destination)).status).toBe(404)
 expect(await json(`/api/operator/segments/${retained.id}`, destination)).toEqual(control)
 expect((await env.DB.prepare('SELECT * FROM accounts ORDER BY id').all()).results).toEqual(source.archive.tables.accounts)
 expect(await env.DB.prepare('SELECT display_name FROM operators WHERE id=?').bind(g.peerId).first('display_name')).toBe('Erased operator')
 expect(await env.DB.prepare('SELECT created_by_operator_id FROM penny_segments WHERE id=?').bind(retained.id).first('created_by_operator_id')).toBe(g.peerId)
 expect(await env.DB.prepare("SELECT entity_id FROM audit_entries WHERE action='segment.created' AND entity_id=?").bind(targeted.id).first()).toBeNull()
 const after = await savedState()
 const definition = { name: 'synthetic-penny-refused-resurrection', rule: rule(g.peerId) }
 expect((await call('/api/operator/segments', definition, destination)).status).toBe(422)
 expect((await call(`/api/operator/segments/${retained.id}`, definition, destination, 'PATCH')).status).toBe(422)
 const journal = await json<ErasureJournal>('/api/operator/data/journal', destination)
 expect(journal.tombstones.some(row => row.table_name === 'penny_segments')).toBe(true)
 const replay = await call('/api/operator/data/import', { archive: source.archive, journal }, destination)
 expect(replay.status).toBe(409); expect(await replay.json()).toEqual({ error: 'stale_archive' })
 expect(await savedState()).toEqual(after)
 const erased = await json<{ archive: Archive }>('/api/operator/data/export', destination)
 expect(erased.archive.tables.penny_segments.map(row => row.id)).toEqual([retained.id])
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})
