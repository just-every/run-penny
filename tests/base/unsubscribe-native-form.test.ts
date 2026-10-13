import { applyD1Migrations, reset } from 'cloudflare:test'
import { exports } from 'cloudflare:workers'
import { afterEach, beforeEach, expect, inject, it, vi } from 'vitest'
import { unsubscribeUrl } from '@/core/features/notifications/unsubscribe'
import { call, env, messages, origin } from './support'
import { graph, rows, runtime } from './notification-regression-fixture'

const endpoint = '/api/public/notifications/unsubscribe'
const nativeHeaders = { Origin: 'null', 'Sec-Fetch-Site': 'same-origin' }

beforeEach(async () => {
  await reset()
  await applyD1Migrations(env.DB, inject('migrations'))
})
afterEach(() => vi.restoreAllMocks())

function formPost(url: string, headers: Record<string, string>, body = '') {
  return exports.default.fetch(new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
    body,
  }))
}

async function preferenceHtml(response: Response, status: number, token?: string) {
  expect(response.status).toBe(status)
  expect(response.headers.get('Content-Type')).toContain('text/html')
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
  expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  expect(response.headers.get('Content-Security-Policy')).toContain("form-action 'self'")
  expect(response.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'")
  const body = await response.text()
  expect(body).toContain('<main>')
  expect(body).not.toContain('forbidden_origin')
  expect(body).not.toContain('invalid_unsubscribe_link')
  if (token) expect(body).not.toContain(token)
  return body
}

async function preferences() {
  return {
    global: await rows('requester_notification_preferences'),
    requests: await rows('request_notification_mutes'),
    follows: await rows('request_follows'),
  }
}

it.each(['all', 'request'])('[NOTIFY-002] native opaque-origin form validates and applies only its signed %s scope', async (scope) => {
  const g = await graph(2)
  const signedScope = scope === 'all' ? scope : g.requests[0].id
  const url = await unsubscribeUrl(runtime(), g.recipient, signedScope)
  const before = await preferences()
  const page = await preferenceHtml(await exports.default.fetch(new Request(url)), 200)
  expect(await preferences()).toEqual(before)
  const action = page.match(/<form method="post" action="([^"]+)"/)?.[1]
  expect(action).toBeDefined()
  const response = await formPost(new URL(action!, origin).href, {
    ...nativeHeaders, 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document', Accept: 'text/html',
  })
  const body = await preferenceHtml(response, 200, new URL(url).searchParams.get('token')!)
  expect(body).toContain('Unsubscribed')
  const after = await preferences()
  expect(after.follows).toEqual(before.follows)
  if (scope === 'all') {
    expect(after.global).toEqual([expect.objectContaining({ requester_id: g.recipient.requesterId, muted_at: expect.any(String) })])
    expect(after.requests).toEqual([])
  } else {
    expect(after.global).toEqual([])
    expect(after.requests).toEqual([expect.objectContaining({ requester_id: g.recipient.requesterId, request_id: signedScope })])
  }
  expect((await call('/api/public/requester/activity', undefined, g.person)).status).toBe(200)
})

it('[NOTIFY-002] same-origin opaque form cannot mutate without a valid recipient and scope capability', async () => {
  const g = await graph()
  const valid = new URL(await unsubscribeUrl(runtime(), g.recipient, 'all'))
  const token = valid.searchParams.get('token')!
  const [payload, signature] = token.split('.')
  const tampered = `${payload}.${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`
  const wrongRecipient = await unsubscribeUrl(runtime(), { ...g.recipient, requesterId: crypto.randomUUID() }, 'all')
  const wrongAddress = await unsubscribeUrl(runtime(), { ...g.recipient, addressId: crypto.randomUUID() }, 'all')
  const wrongEmail = await unsubscribeUrl(runtime(), { ...g.recipient, email: 'different@example.test' }, 'all')
  const missingScope = await unsubscribeUrl(runtime(), g.recipient, crypto.randomUUID())
  const before = await preferences()
  for (const url of [origin + endpoint, origin + endpoint + '?token=' + tampered, wrongRecipient, wrongAddress, wrongEmail, missingScope]) {
    const body = await preferenceHtml(await formPost(url, nativeHeaders), 400, new URL(url).searchParams.get('token') ?? undefined)
    expect(body).toContain('This email preference link is invalid or expired.')
    expect(await preferences()).toEqual(before)
  }
})

const rejectedHeaders: [string, Record<string, string>][] = [
  ['foreign origin with same-origin metadata', { Origin: 'https://foreign.test', 'Sec-Fetch-Site': 'same-origin' }],
  ['sibling origin with same-site metadata', { Origin: 'https://other.penny.test', 'Sec-Fetch-Site': 'same-site' }],
  ['opaque origin with cross-site metadata', { Origin: 'null', 'Sec-Fetch-Site': 'cross-site' }],
  ['opaque origin with same-site metadata', { Origin: 'null', 'Sec-Fetch-Site': 'same-site' }],
  ['opaque origin without metadata', { Origin: 'null' }],
  ['opaque origin with none metadata', { Origin: 'null', 'Sec-Fetch-Site': 'none' }],
  ['same origin with cross-site metadata', { Origin: origin, 'Sec-Fetch-Site': 'cross-site' }],
  ['missing origin with cross-site metadata', { 'Sec-Fetch-Site': 'cross-site' }],
]
it.each(rejectedHeaders)('[NOTIFY-002 BASE-ACCESS-001] signed unsubscribe still rejects %s without mutation', async (_, headers) => {
  const g = await graph()
  const url = await unsubscribeUrl(runtime(), g.recipient, 'all')
  const before = await preferences()
  const body = await preferenceHtml(await formPost(url, headers), 403, new URL(url).searchParams.get('token')!)
  expect(body).toContain('Your email preferences have not changed.')
  expect(await preferences()).toEqual(before)
})

it('[BASE-ACCESS-001 REQ-023 NOTIFY-002] opaque-origin exception leaves operator, auth, identity and requester mutations forbidden', async () => {
  const g = await graph()
  const before = await preferences()
  const initialBoards = await rows('boards')
  const sent = messages.length
  for (const [path, body, authorization, method] of [
    ['/api/operator/boards', { name: 'Forbidden', slug: 'forbidden', visibility: 'public' }, g.operator, 'POST'],
    ['/api/auth/sign-out', {}, g.operator, 'POST'],
    ['/api/auth/magic-link', { email: 'owner@penny.invalid' }, {}, 'POST'],
    ['/api/public/identity/email', { email: 'other@example.test', displayName: 'Other' }, {}, 'POST'],
    ['/api/public/requester/notifications', { muted: true }, g.person, 'PATCH'],
  ] as const) {
    const response = await call(path, body, { ...authorization, ...nativeHeaders }, method)
    expect(response.status).toBe(403)
    expect(response.headers.get('Content-Type')).toContain('application/json')
    expect(await response.json()).toEqual({ error: 'forbidden_origin' })
  }
  expect(await rows('boards')).toEqual(initialBoards)
  expect(await preferences()).toEqual(before)
  expect(messages).toHaveLength(sent)
  expect((await call('/api/operator/moderation', undefined, g.operator)).status).toBe(200)
})

it('[BASE-ACCESS-001 NOTIFY-002] opaque-origin exception requires the exact unsubscribe path and POST method', async () => {
  const g = await graph()
  const url = new URL(await unsubscribeUrl(runtime(), g.recipient, 'all'))
  const before = await preferences()
  for (const [path, method] of [[endpoint + '/', 'POST'], [endpoint + '/other', 'POST'], [endpoint, 'PATCH'], [endpoint, 'PUT'], [endpoint, 'DELETE']]) {
    const response = await exports.default.fetch(new Request(origin + path + url.search, { method, headers: nativeHeaders }))
    expect(response.status).toBe(403)
    expect(response.headers.get('Content-Type')).toContain('application/json')
    expect(await response.json()).toEqual({ error: 'forbidden_origin' })
    expect(await preferences()).toEqual(before)
  }
})

it('[NOTIFY-002] provider one-click POST with no Origin or Fetch Metadata stays sessionless and idempotent', async () => {
  const g = await graph()
  const url = await unsubscribeUrl(runtime(), g.recipient, 'all')
  const follows = await rows('request_follows')
  for (let attempt = 0; attempt < 2; attempt++) {
    const body = await preferenceHtml(await formPost(url, {}, 'List-Unsubscribe=One-Click'), 200)
    expect(body).toContain('All requester email is muted.')
  }
  expect(await rows('requester_notification_preferences')).toEqual([
    expect.objectContaining({ requester_id: g.recipient.requesterId, muted_at: expect.any(String) }),
  ])
  expect(await rows('request_notification_mutes')).toHaveLength(0)
  expect(await rows('request_follows')).toEqual(follows)
})
