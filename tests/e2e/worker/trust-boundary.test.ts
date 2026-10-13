import { applyD1Migrations } from 'cloudflare:test'
import { env, exports } from 'cloudflare:workers'
import { beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'
import { createPennyApp } from '../../../src/core/app/worker'
import { isLocalViteModulePath } from '../../../src/core/app/public-paths'
import { createDatabaseConnection } from '../../../src/core/platform/database'
import { AuthRepository } from '../../../src/core/features/auth/repository'
import { OPERATOR_SESSION_COOKIE, hashOperatorSessionToken } from '../../../src/core/features/auth/session'
import type { AppBindings } from '../../../src/core/shared/bindings'

const OPERATOR_ID = '01J00000000000000000000001'
const SESSION_ID = '01J00000000000000000000002'
const OPERATOR_EMAIL = 'owner@penny.invalid'
const SESSION_TOKEN = 'real-d1-backed-worker-test-session'

beforeAll(async () => {
  await applyD1Migrations(env.DB, inject('migrations'))
})

beforeEach(async () => {
  await env.DB.exec('DELETE FROM operator_sessions; DELETE FROM operators;')
})

async function request(pathname: string, init?: RequestInit): Promise<Response> {
  return exports.default.fetch(new Request(`https://penny.test${pathname}`, init))
}

async function createRealOperatorSession(): Promise<Headers> {
  const now = new Date().toISOString()
  const repository = new AuthRepository(createDatabaseConnection(env.DB))
  await repository.createOperator({
    id: OPERATOR_ID,
    email: OPERATOR_EMAIL,
    displayName: 'Penny Owner',
    now,
  })
  await repository.createSession({
    id: SESSION_ID,
    operatorId: OPERATOR_ID,
    tokenHash: await hashOperatorSessionToken(SESSION_TOKEN),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    now,
  })

  return new Headers({ Cookie: `${OPERATOR_SESSION_COOKIE}=${SESSION_TOKEN}` })
}

describe('Worker trust boundary', () => {
  it('admits only the pnpm-scoped Vite client runtime needed by local development', () => {
    expect(isLocalViteModulePath('/node_modules/.pnpm/vite@8.2.2_@types+node@24.13.3_tsx@4.23.13/node_modules/vite/dist/client/env.mjs')).toBe(true)
    expect(isLocalViteModulePath('/node_modules/.pnpm/vite@8.2.2/node_modules/vite/dist/client/client.mjs')).toBe(true)
    expect(isLocalViteModulePath('/node_modules/.pnpm/react@19.2.0/node_modules/react/index.js')).toBe(false)
    expect(isLocalViteModulePath('/node_modules/.pnpm/vite@8.2.2/node_modules/vite/dist/node/index.js')).toBe(false)
  })

  it('checks D1, R2, and Queue bindings before reporting healthy', async () => {
    const response = await request('/health')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ status: 'ok', ok: true, deployment: expect.any(Object) })
  })

  it('returns unavailable when a required R2 binding is absent', async () => {
    const app = createPennyApp()
    const incompleteBindings = { ...env, FILES: undefined } as unknown as AppBindings
    const response = await app.fetch(new Request('https://penny.test/health'), incompleteBindings)

    expect(response.status).toBe(503)
  })

  it('[REQ-001] serves the configured public portal without server configuration', async () => {
    const response = await request('/portal/feedback', { headers: { Accept: 'text/html' } })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('What should we improve?')
    expect(body).toContain('No published feedback yet')
    expect(body).toContain('<script')
    expect(body).not.toContain(OPERATOR_EMAIL)
  })

  it('does not expose removed prototype, undeclared source, or unknown paths', async () => {
    const responses = await Promise.all([
      request('/prototype-v2/overview.html'),
      request('/server/worker.ts'),
      request('/unlisted-path'),
      request('/api/not-implemented'),
    ])

    expect(responses.map((response) => response.status)).toEqual([404, 404, 404, 404])
  })

  it('redirects unauthenticated browser requests for the operator workspace to sign-in', async () => {
    const response = await request('/app', { headers: { Accept: 'text/html' }, redirect: 'manual' })

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/signin')
  })

  it('rejects unauthenticated session API requests', async () => {
    const response = await request('/api/auth/session')

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ authenticated: false })
  })

  it('serves /app and the session API only for an allow-listed D1-backed session', async () => {
    const headers = await createRealOperatorSession()
    const [workspace, session] = await Promise.all([
      request('/app', { headers }),
      request('/api/auth/session', { headers }),
    ])

    expect(workspace.status).toBe(200)
    const html = await workspace.text()
    expect(html).toContain('Operator workspace')
    expect(html).toContain('Overview')
    expect(html).toContain('<script')
    expect(session.status).toBe(200)
    await expect(session.json()).resolves.toEqual({
      authenticated: true,
      operator: {
        id: OPERATOR_ID,
        email: OPERATOR_EMAIL,
        displayName: 'Penny Owner',
      },
    })
  })

  it('fails closed when typed startup configuration is invalid', async () => {
    const app = createPennyApp({
      runtimeConfiguration: {
        operatorAllowlist: ['owner@penny.invalid'],
        workspaceTimezone: 'not/a-timezone',
        publicOriginAllowlist: ['http://localhost:5173'],
      },
    })
    // The emitted workspace timezone overrides the server configuration. Make
    // the effective binding invalid too so this request reaches its refusal.
    const response = await app.fetch(new Request('https://penny.test/health'), { ...env, WORKSPACE_TIMEZONE: 'not/a-timezone' })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'service_unavailable',
      message: 'Penny could not complete the requested operation.',
    })
  })

  it('fails closed when required production environment values are absent', async () => {
    const app = createPennyApp()
    const productionBindings = { ...env, PENNY_ENVIRONMENT: 'production' } as AppBindings
    const response = await app.fetch(new Request('https://penny.test/health'), productionBindings)

    expect(response.status).toBe(503)
  })
})
