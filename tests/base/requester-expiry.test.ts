import { applyD1Migrations, reset } from 'cloudflare:test'
import { afterEach, beforeEach, expect, inject, it, vi } from 'vitest'
import { opaqueToken } from '@/core/features/auth/native-tokens'
import { call, env, messages, mockMail, owner, requester } from './support'
import { explicitConsentBoard } from './explicit-consent-board'

const day = 86_400_000
const start = Date.parse('2040-06-12T10:00:00.000Z')
const stamp = (time: number) => new Date(time).toISOString()
const email = (id: number) => `synthetic-penny-${id}${String.fromCharCode(64)}example.test`

beforeEach(async () => {
  await reset()
  await applyD1Migrations(env.DB, inject('migrations'))
  mockMail()
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

async function publicCall(path: string, body?: unknown, headers: Record<string, string> = {}, status = 200) {
  const response = await call(path, body, headers)
  expect(response.status, await response.clone().text()).toBe(status)
  expect(response.headers.has('Set-Cookie')).toBe(false)
  return response
}
async function issue(id: number, pendingToken?: string) {
  await publicCall('/api/public/identity/email', {
    email: email(id), displayName: `Synthetic Penny ${id}`, ...(pendingToken ? { pendingToken } : {}),
  }, {}, 202)
  const link = messages.findLast(message => message.to === email(id))!
  expect(link).toBeDefined()
  return new URLSearchParams(new URL(link.url).hash.slice(1)).get('token')!
}
async function verify(token: string) {
  const response = await publicCall('/api/public/identity/email/verify', { token })
  return response.json() as Promise<{ token: string; displayName: string; rejectedPendingActions: number }>
}
const sessions = async () => (await env.DB.prepare('SELECT * FROM native_requester_sessions ORDER BY id').all()).results
const rows = async (table: string) => (await env.DB.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results
async function custody() {
  const tables = ['requests', 'request_content_submissions', 'request_submission_keys',
    'evidence_items', 'evidence_versions', 'request_evidence_links', 'request_evidence_contributions',
    'request_votes', 'request_vote_contributions', 'request_follows', 'request_follow_contributions',
    'request_comments', 'requester_update_permissions', 'notification_events', 'notification_intents',
    'notification_outbox', 'notification_outbox_attempts']
  return Object.fromEntries(await Promise.all(tables.map(async table => [table, await rows(table)])))
}

it('[REQ-023] emailed links consume once; requester use renews thirty-day idle sessions and expired credentials change nothing', async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(start)
  const firstLink = await issue(1), active = await verify(firstLink)
  const idle = await verify(await issue(2)), unusedLink = await issue(3)
  const first = await sessions()
  expect(first).toHaveLength(2)
  for (const session of first) expect(session).toMatchObject({
    created_at: stamp(start), last_used_at: stamp(start), expires_at: stamp(start + 30 * day), revoked_at: null,
  })
  const refusal = async (path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const before = { sessions: await sessions(), addresses: await rows('requester_addresses'), product: await custody() }
    await publicCall(path, body, headers, 401)
    expect({ sessions: await sessions(), addresses: await rows('requester_addresses'), product: await custody() }).toEqual(before)
  }
  await refusal('/api/public/identity/email/verify', { token: firstLink })
  vi.setSystemTime(start + 30 * 60_000)
  await refusal('/api/public/identity/email/verify', { token: unusedLink })
  expect(await env.DB.prepare('SELECT count(*) FROM native_magic_links WHERE consumed_at IS NULL').first('count(*)')).toBe(1)

  vi.setSystemTime(start + 29 * day)
  expect(await (await publicCall('/api/public/identity/session', undefined, { Authorization: `Bearer ${active.token}` })).json()).toEqual({ displayName: active.displayName })
  const renewed = await sessions(), activeRow = renewed.find(row => row.last_used_at === stamp(start + 29 * day))!
  expect(activeRow).toBeDefined()
  expect(activeRow.expires_at).toBe(stamp(start + 59 * day))
  expect(renewed.find(row => row.id !== activeRow.id)).toEqual(first.find(row => row.id !== activeRow.id))

  vi.setSystemTime(start + 30 * day)
  await refusal('/api/public/identity/session', undefined, { Authorization: `Bearer ${idle.token}` })
  await publicCall('/api/public/identity/session', undefined, { Authorization: `Bearer ${active.token}` })
  expect((await sessions()).find(row => row.id === activeRow.id)).toMatchObject({
    last_used_at: stamp(start + 30 * day), expires_at: stamp(start + 60 * day),
  })
  vi.setSystemTime(start + 60 * day)
  await refusal('/api/public/identity/session', undefined, { Authorization: `Bearer ${active.token}` })
  await refusal('/api/public/requests/synthetic-penny-absent/vote', {}, { Authorization: `Bearer ${active.token}` })
})

it('[REQ-023] four held actions expire after twenty-four hours, are discarded on fresh verification and never replay on later reads or verification', async () => {
  const operator = await owner(), author = await requester('Synthetic Penny author')
  expect((await call('/api/operator/boards', { name: 'Synthetic Penny feedback', slug: 'synthetic-penny-feedback', visibility: 'public' }, operator)).status).toBe(201)
  await explicitConsentBoard('synthetic-penny-feedback', (path, method, body) => call(path, body, operator, method))
  const input = { title: 'Synthetic Penny existing request', description: 'A real published request for expiry checks', boardSlug: 'synthetic-penny-feedback', idempotencyKey: opaqueToken(), emailUpdates: false }
  const created = await publicCall('/api/public/requests', input, author, 201)
  const { slug } = await created.json() as { slug: string }
  expect((await call(`/api/operator/moderation/${slug}`, { verdict: 'approved', title: input.title, description: input.description, boardSlug: input.boardSlug, displayName: 'Synthetic Penny author' }, operator)).status).toBe(200)
  const detail = async () => (await publicCall(`/api/public/requests/${slug}`)).json()
  const published = await detail()
  expect(published).toMatchObject({ slug, voteCount: 1, comments: [] })
  const before = await custody(), mailBefore = messages.length
  expect(before.requests).toHaveLength(1); expect(before.evidence_items).toHaveLength(1)
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(start)
  const pendingToken = opaqueToken(), held = { 'X-Penny-Pending-Token': pendingToken }
  const heldInput = { ...input, title: 'Synthetic Penny expired submission', idempotencyKey: opaqueToken(), emailUpdates: true }
  for (const [path, body] of [
    ['/api/public/requests', heldInput],
    [`/api/public/requests/${slug}/vote`, { emailUpdates: true }],
    [`/api/public/requests/${slug}/follow`, {}],
    [`/api/public/requests/${slug}/comments`, { body: 'Synthetic Penny expired comment' }],
  ] as const) expect(await (await publicCall(path, body, held, 202)).json()).toEqual({ error: 'requester_identity_required', actionHeld: true })
  const pending = await rows('requester_pending_actions')
  expect(pending.map(row => row.action_type).sort()).toEqual(['comment', 'follow', 'submission', 'vote'])
  for (const row of pending) expect(row).toMatchObject({
    created_at: stamp(start), expires_at: stamp(start + day), claimed_at: null,
  })
  expect(await custody()).toEqual(before); expect(await detail()).toEqual(published)
  expect(messages).toHaveLength(mailBefore)
  const oldLink = await issue(4, pendingToken)
  expect(await custody()).toEqual(before)

  vi.setSystemTime(start + day - 1)
  expect(await rows('requester_pending_actions')).toEqual(pending)
  expect(await detail()).toEqual(published); expect(await custody()).toEqual(before)
  vi.setSystemTime(start + day)
  await publicCall('/api/public/identity/email/verify', { token: oldLink }, {}, 401)
  const freshLink = await issue(4, pendingToken), verified = await verify(freshLink)
  expect(verified.rejectedPendingActions).toBe(0)
  expect(await rows('requester_pending_actions')).toEqual([])
  expect(await custody()).toEqual(before); expect(await detail()).toEqual(published)
  const identity = { Authorization: `Bearer ${verified.token}` }
  await publicCall('/api/public/identity/session', undefined, identity)
  expect(await (await publicCall('/api/public/requester/activity', undefined, identity)).json()).toMatchObject({ requests: [], votes: [], follows: [], comments: [] })
  vi.setSystemTime(start + day + 60_000)
  expect((await verify(await issue(4, pendingToken))).rejectedPendingActions).toBe(0)
  await publicCall('/api/public/identity/email/verify', { token: freshLink }, {}, 401)
  expect(await rows('requester_pending_actions')).toEqual([])
  expect(await custody()).toEqual(before); expect(await detail()).toEqual(published)
  expect(messages).toHaveLength(mailBefore + 3)

  // A new explicit action remains usable after the expired actions were discarded.
  await publicCall(`/api/public/requests/${slug}/vote`, { emailUpdates: false }, identity, 204)
  expect(await detail()).toMatchObject({ slug, voteCount: 2, comments: [] })
  expect(await rows('requests')).toEqual(before.requests)
  expect(await rows('request_comments')).toEqual(before.request_comments)
  expect(await rows('request_follows')).toEqual(before.request_follows)
  expect(await rows('notification_outbox')).toEqual(before.notification_outbox)
})
