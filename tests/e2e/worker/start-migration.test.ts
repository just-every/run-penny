import { applyD1Migrations } from 'cloudflare:test'
import { env, exports } from 'cloudflare:workers'
import { beforeAll, describe, expect, inject, it } from 'vitest'
import { fromCrossJSON } from 'seroval'
import { importPennySample } from '../../../src/core/features/sample-data/service'
import { createDatabaseConnection } from '../../../src/core/platform/database'
import { hashOperatorSessionToken } from '../../../src/core/features/auth/session'
import sample from '../../../sample-data/penny.v1.json'

const privateMarkers = ['priya.s@example.test', 'Northstar Health', 'revenueCents', 'decision-scim-q4', 'tokenHash', 'operatorAllowlist']
const documentPaths = ['/app', '/app/overview', '/app/feedback', '/app/decisions', '/app/decisions/decision-scim-q4', '/app/roadmap', '/app/releases', '/app/releases/release-scim-provisioning', '/app/customers', '/app/customers/northstar-health', '/app/no-such-page']
const apiPaths = ['/api/operator/overview', '/api/operator/no-such-api', '/api/auth/session']
const wire = () => inject('generatedTransport')
const request = (path: string, headers: Record<string, string> = {}) => exports.default.fetch(new Request(`https://penny.test${path}`, { headers, redirect: 'manual' }))
const sessionCookie = (state: string) => state === 'missing' ? '' : `penny_operator_session=migration-${state}`
const rpcHeaders = (state: string) => ({ Cookie: sessionCookie(state), Origin: 'https://penny.test', 'Sec-Fetch-Site': 'same-origin', 'x-tsr-serverFn': 'true', Accept: 'application/json' })

beforeAll(async () => {
  await applyD1Migrations(env.DB, inject('migrations'))
  await importPennySample(createDatabaseConnection(env.DB), sample)
  const now = new Date().toISOString()
  await env.DB.prepare('INSERT INTO operators (id,email,display_name,created_at,updated_at) VALUES (?,?,?,?,?)').bind('migration-operator', 'owner@penny.invalid', 'Migration operator', now, now).run()
  for (const state of ['valid', 'expired', 'revoked']) {
    await env.DB.prepare('INSERT INTO operator_sessions (id,operator_id,token_hash,expires_at,last_used_at,revoked_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
      .bind(`migration-${state}`, 'migration-operator', await hashOperatorSessionToken(`migration-${state}`), new Date(Date.now() + (state === 'expired' ? -3600000 : 3600000)).toISOString(), now, state === 'revoked' ? now : null, now, now).run()
  }
})

describe('TanStack Start migration', () => {
  it('[BASE-ACCESS-002] independently authenticates documents, Hono APIs and every private generated function', async () => {
    for (const state of ['missing', 'expired', 'revoked']) {
      for (const path of documentPaths) {
        const response = await request(path, { Accept: 'text/html', Cookie: sessionCookie(state), 'Sec-Fetch-Mode': 'navigate' })
        expect(response.status, `${state} ${path}`).toBe(302)
        expect(response.headers.get('Location')).toBe('/signin')
        expect(await response.text()).toBe('')
      }
      for (const path of apiPaths) {
        const response = await request(path, { Cookie: sessionCookie(state) })
        expect(response.status, `${state} ${path}`).toBe(401)
        expect(await response.json()).toEqual({ authenticated: false })
      }
      const rpc = await request(wire().loadOperatorResources, rpcHeaders(state))
      const body = await rpc.text()
      expect(rpc.status).toBe(200)
      expect(rpc.headers.get('content-type')).toContain('application/json')
      expect(JSON.parse(body)).toMatchObject({ isSerializedRedirect: true, to: '/signin' })
      for (const marker of privateMarkers) expect(body).not.toContain(marker)
    }
    for (const path of documentPaths) {
      const response = await request(path, { Accept: 'text/html', Cookie: sessionCookie('valid'), 'Sec-Fetch-Mode': 'navigate' })
      expect(response.status, path).toBe(path.endsWith('no-such-page') ? 404 : 200)
      const html = await response.text()
      expect(html).toContain('Operator workspace')
      expect(html).toContain('<script')
      if (path === '/app/customers/northstar-health') expect(html).toContain('priya.s@example.test')
      if (path === '/app/decisions/decision-scim-q4') expect(html).toContain('Evidence and alternatives')
      if (path === '/app/releases/release-scim-provisioning') expect(html).toContain('Requester outcome')
    }
    expect((await request('/api/operator/no-such-api', { Cookie: sessionCookie('valid') })).status).toBe(404)
    expect((await request('/api/operator/overview', { Cookie: sessionCookie('valid') })).status).toBe(200)
    const rpc = await request(wire().loadOperatorResources, rpcHeaders('valid'))
    expect(rpc.status).toBe(200)
    expect(rpc.headers.get('x-tss-serialized')).toBe('true')
    expect(rpc.headers.get('content-type')).toContain('application/json')
    const decoded = fromCrossJSON(await rpc.json() as Parameters<typeof fromCrossJSON>[0], {})
    expect(decoded).toMatchObject({ result: { '/api/operator/accounts/northstar-health': { status: 200, data: { revenueCents: 7200000 } } } })
  })

  it('[DATA-002] excludes native query details from an RPC session-validation failure', async () => {
    await env.DB.exec('ALTER TABLE operator_sessions RENAME TO unavailable_operator_sessions')
    try {
      const response = await request(wire().loadOperatorResources, rpcHeaders('valid'))
      const body = await response.text()
      expect(body).toContain('Penny could not validate the operator session.')
      for (const marker of [...privateMarkers, 'token_hash', 'select ', 'migration-browser', 'Failed query']) expect(body).not.toContain(marker)
    } finally {
      await env.DB.exec('ALTER TABLE unavailable_operator_sessions RENAME TO operator_sessions')
    }
  })

  it('[DATA-002] returns live projected D1 content in first HTML and public RPC without private fields', async () => {
    for (const path of ['/portal/feedback', '/portal/feedback/scim-provisioning', '/portal/roadmap', '/portal/updates']) {
      const response = await request(path)
      expect(response.status).toBe(200)
      const html = await response.text()
      expect(html).toContain(path === '/portal/updates' ? 'There are no updates yet.' : 'SCIM provisioning')
      for (const marker of privateMarkers) expect(html).not.toContain(marker)
    }
    await env.DB.prepare("UPDATE requests SET public_title = 'Live title after build' WHERE slug = 'scim-provisioning'").run()
    for (const path of ['/portal/feedback', '/portal/feedback/scim-provisioning']) expect(await (await request(path)).text()).toContain('Live title after build')
    const rpc = await request(wire().loadPublicResources, rpcHeaders('missing'))
    expect(rpc.headers.get('x-tss-serialized')).toBe('true')
    const body = await rpc.text()
    expect(body).toContain('Live title after build')
    for (const marker of privateMarkers) expect(body).not.toContain(marker)
  })

  it('[BASE-ACCESS-003] rejects foreign Origin and unknown document/asset/host surfaces', async () => {
    const foreign = await request(wire().loadOperatorResources, { ...rpcHeaders('valid'), Origin: 'https://foreign.test' })
    expect(foreign.status).toBe(403)
    expect(await foreign.text()).toBe('Forbidden')
    for (const path of ['/not-a-document', '/assets/missing.js', '/@vite/client', '/src/routes/__root.tsx', '/portal/no-such-page']) {
      for (const mode of ['navigate', 'cors']) expect((await request(path, { 'Sec-Fetch-Mode': mode })).status, path).toBe(404)
    }
    expect((await exports.default.fetch(new Request('https://foreign.test/'))).status).toBe(404)
  })
})
