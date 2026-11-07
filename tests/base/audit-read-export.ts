import { applyD1Migrations, reset } from 'cloudflare:test'
import { expect, inject, vi } from 'vitest'
import { call, env, mockMail, owner, requester } from './support'
import { agentCapture, csvRows, invite, json, signIn } from './audit-fixture'

type Entry = Record<string, string | null>
type Page = { items: Entry[]; total: number; nextCursor: string | null }
const endpoint = '/api/operator/audit'
const columns = ['id', 'actor_type', 'actor_id', 'action', 'entity_type', 'entity_id', 'occurred_at', 'agent_id', 'agent_name', 'sponsor_native_id', 'prepared_by', 'approvers_json', 'door_operation_id']
const paths = [endpoint, endpoint + '/export.json', endpoint + '/export.csv']
const stamp = '2026-10-29T12:00:00.000Z'

export async function proveAuditReadExport() {
  await reset(); await applyD1Migrations(env.DB, inject('migrations')); vi.restoreAllMocks(); mockMail()
  const first = await owner(), peer = await invite(first, 1), member = await invite(first, 2)
  const initial = await json<{ operator: { id: string; email: string } }>(call('/api/auth/session', undefined, first))
  const peerActor = await json<{ operator: { id: string } }>(call('/api/auth/session', undefined, peer.cookie))
  // Custom role management is unbuilt: establish the native Admin fixture, then
  // sign in afresh because the role change revokes the prior session.
  await env.DB.prepare("UPDATE oa_operators SET role='admin' WHERE id=?").bind(peer.nativeId).run()
  const admin = await signIn(peer.email)
  const privateWording = 'synthetic-penny-private-customer-wording', commercial = '918273645', credential = 'synthetic-penny-credential-1'
  await json(call('/api/operator/boards', { name: 'Synthetic board', slug: 'synthetic-penny-1', visibility: 'public' }, first), 201)
  const request = await json<{ id: string; slug: string }>(call('/api/operator/requests', { title: 'Synthetic request', description: privateWording, boardSlug: 'synthetic-penny-1', evidenceIds: [] }, first), 201)
  await json(call(`/api/operator/requests/${request.slug}/moderate`, { verdict: 'approved' }, admin))
  const clock = { timezone: 'UTC', quietEnabled: false, quietStart: 20, quietEnd: 8 }
  for (const cookie of [first, admin, first, admin]) await json(call('/api/operator/settings/workspace-clock', clock, cookie, 'PUT'))
  const agent = await agentCapture(initial.operator.email)
  const agentRow = (await env.DB.prepare("SELECT * FROM audit_entries WHERE action='evidence.recorded' AND entity_id=?").bind(agent.evidenceId).first<Entry>())!
  expect(agentRow).toBeTruthy()
  expect(agentRow.agent_id).toBe(agent.id)
  expect(agentRow.sponsor_native_id).toBeTruthy()
  expect(agentRow.prepared_by).toBeTruthy()
  expect(agentRow.approvers_json).toBe('[]')
  expect(agentRow.door_operation_id).toBeTruthy()
  const csvName = '=synthetic-penny-1,"quoted"\r\nsecond line'
  await env.DB.prepare('UPDATE audit_entries SET details_json=?,agent_name=? WHERE id=?')
    .bind(JSON.stringify({ wording: privateWording, revenue: commercial, credential }), csvName, agentRow.id).run()
  // Known historical times include a tie and date boundaries, independent of
  // the wall clock. All events above were produced through native doors.
  const clocks = (await env.DB.prepare("SELECT id,actor_id FROM audit_entries WHERE action='workspace.clock_saved' ORDER BY rowid").all<Entry>()).results
  expect(clocks).toHaveLength(4)
  expect(clocks.map(row => row.actor_id)).toEqual([initial.operator.id, peerActor.operator.id, initial.operator.id, peerActor.operator.id])
  const dates = ['2026-10-28T12:00:00.000Z', stamp, stamp, '2026-10-30T12:00:00.000Z']
  for (let i = 0; i < clocks.length; i++) await env.DB.prepare('UPDATE audit_entries SET occurred_at=? WHERE id=?').bind(dates[i], clocks[i].id).run()
  const before = (await env.DB.prepare('SELECT * FROM audit_entries ORDER BY occurred_at DESC,id DESC').all<Entry>()).results
  const projected = before.map(row => Object.fromEntries(columns.map(key => [key, row[key]])))
  expect(projected.length).toBeGreaterThan(6)
  const expected = (filters: Record<string, string>) => projected.filter(row => (!filters.actor || row.actor_id === filters.actor) && (!filters.action || row.action === filters.action) && (!filters.subject || row.entity_id === filters.subject) && (!filters.subjectType || row.entity_type === filters.subjectType) && (!filters.from || row.occurred_at! >= filters.from) && (!filters.to || row.occurred_at! <= filters.to))
  const walk = async (path: string, filters: Record<string, string>, cookie = first) => {
    const result: Entry[] = []
    let cursor: string | null = null, pages = 0
    do {
      const search = new URLSearchParams({ ...filters, limit: '2', ...(cursor ? { cursor } : {}) })
      const response = await call(path + '?' + search, undefined, cookie)
      expect(response.status, await response.clone().text()).toBe(200)
      expect(response.headers.get('Cache-Control')).toBe('private, no-store')
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
      if (path.endsWith('.csv')) {
        expect(response.headers.get('Content-Type')).toContain('text/csv')
        expect(response.headers.get('Content-Disposition')).toContain('attachment;')
        const [header, ...rows] = csvRows(await response.text())
        expect(header).toEqual(columns)
        expect(Number(response.headers.get('X-Audit-Total'))).toBe(expected(filters).length)
        result.push(...rows.map(row => Object.fromEntries(header.map((key, index) => [key, row[index]]))))
        cursor = response.headers.get('X-Audit-Next-Cursor')
      } else {
        const page = await response.json() as Page
        expect(page.total).toBe(expected(filters).length)
        expect(page.items.length).toBeLessThanOrEqual(2)
        result.push(...page.items); cursor = page.nextCursor
      }
      expect(++pages).toBeLessThan(50)
    } while (cursor)
    expect(new Set(result.map(row => row.id)).size).toBe(result.length)
    return result
  }
  const cases: Record<string, string>[] = [{}, { actor: peerActor.operator.id }, { action: 'workspace.clock_saved' }, { subject: request.id }, { subjectType: 'settings' }, { from: stamp, to: stamp }, { actor: peerActor.operator.id, action: 'workspace.clock_saved', subject: 'workspace-clock', subjectType: 'settings', from: stamp, to: stamp }, { actor: 'synthetic-penny-missing' }]
  for (const filters of cases) {
    const wanted = expected(filters)
    expect(await walk(endpoint, filters)).toEqual(wanted)
    expect(await walk(paths[1], filters, admin)).toEqual(wanted)
    const csv = await walk(paths[2], filters)
    expect(csv).toEqual(wanted.map(row => Object.fromEntries(columns.map(key => [key, row[key] === null ? '' : key === 'agent_name' && row[key] === csvName ? "'" + csvName : row[key]]))))
    for (const payload of [JSON.stringify(wanted), JSON.stringify(csv)]) {
      for (const marker of [privateWording, commercial, credential, 'synthetic-penny-private-agent-wording', 'details_json', 'revenue', 'email']) expect(payload).not.toContain(marker)
    }
  }
  const bounded = await json<Page>(call(endpoint + '?limit=200', undefined, first))
  expect(bounded.items).toEqual(projected)
  expect(bounded.nextCursor).toBeNull()
  const offset = await json<Page>(call(endpoint + '?action=workspace.clock_saved&from=2026-10-29T14%3A00%3A00%2B02%3A00&to=2026-10-29T14%3A00%3A00%2B02%3A00', undefined, first))
  expect(offset.items.map(row => row.id)).toEqual(expected({ action: 'workspace.clock_saved', from: stamp, to: stamp }).map(row => row.id))
  expect((await env.DB.prepare('SELECT * FROM audit_entries ORDER BY occurred_at DESC,id DESC').all()).results).toEqual(before)
  const start = await json<Page>(call(endpoint + '?limit=1', undefined, first))
  expect(start.nextCursor).toBeTruthy()
  await json(call('/api/operator/settings/workspace-clock', clock, first, 'PUT'))
  const appended = await env.DB.prepare("SELECT id FROM audit_entries WHERE action='workspace.clock_saved' ORDER BY rowid DESC LIMIT 1").first<string>('id')
  // A later backdated append must not enter the established export traversal.
  await env.DB.prepare('UPDATE audit_entries SET occurred_at=? WHERE id=?').bind('2026-10-27T00:00:00.000Z', appended).run()
  const remaining = await json<Page>(call(paths[1] + '?' + new URLSearchParams({ cursor: start.nextCursor!, limit: '200' }), undefined, admin))
  expect([...start.items, ...remaining.items]).toEqual(projected)
  expect(remaining.total).toBe(projected.length)
  expect(remaining.nextCursor).toBeNull()
  const invalid = ['limit=0', 'limit=201', 'limit=1.5', 'cursor=invalid', 'actor=a&actor=b', 'unknown=x', 'from=not-a-date', 'from=2026-10-30T00:00:00Z&to=2026-10-28T00:00:00Z', 'action=x&' + new URLSearchParams({ cursor: start.nextCursor! })]
  for (const path of paths) for (const query of invalid) expect((await call(path + '?' + query, undefined, first)).status).toBe(400)
  const publicPerson = await requester('Synthetic requester')
  const custody = (await env.DB.prepare('SELECT * FROM audit_entries ORDER BY id').all()).results
  for (const path of paths) for (const [headers, status] of [[{}, 401], [publicPerson, 401], [member.cookie, 403], [peer.cookie, 401]] as const) {
    const refused = await call(path + '?' + new URLSearchParams({ cursor: start.nextCursor! }), undefined, headers)
    expect(refused.status).toBe(status)
    expect(await refused.text()).not.toContain(agentRow.id)
  }
  await call('/api/auth/sign-out', {}, admin)
  for (const path of paths) expect((await call(path, undefined, admin)).status).toBe(401)
  expect((await env.DB.prepare('SELECT * FROM audit_entries ORDER BY id').all()).results).toEqual(custody)
}
