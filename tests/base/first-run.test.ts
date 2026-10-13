import { applyD1Migrations, reset } from 'cloudflare:test'
import { beforeEach, afterEach, vi, expect, inject, it } from 'vitest'
import { call, env, owner, finishFirstRun, mockMail, origin } from './support'
import { exports } from 'cloudflare:workers'
beforeEach(async () => { await reset(); await applyD1Migrations(env.DB, inject('migrations')); mockMail() })
afterEach(() => vi.restoreAllMocks())
const html = { Accept: 'text/html' }
const location = (response: Response) => new URL(response.headers.get('Location')!, origin)

it('[FIRST-RUN] an owner whose setup is unfinished is sent to /setup from every app document, finishes there and then reaches the app', async () => {
  const signedOut = await call('/setup', undefined, html)
  expect(signedOut.status).toBe(303)
  expect(location(signedOut).pathname + location(signedOut).search).toBe('/signin?returnTo=%2Fsetup')

  const cookie = await owner({ finishSetup: false })
  for (const path of ['/app', '/app/overview', '/app/settings']) {
    const response = await call(path, undefined, { ...cookie, ...html })
    expect(response.status, path).toBe(303)
    expect(location(response).pathname).toBe('/setup')
  }
  const page = await call('/setup', undefined, { ...cookie, ...html })
  expect(page.status).toBe(200)
  expect(await page.text()).toContain('Finish setup')
  // Private APIs are not documents and keep their own authority checks.
  expect((await call('/api/operator/moderation', undefined, cookie)).status).toBe(200)

  const form = (headers: Record<string, string>, body = 'confirm=yes') => exports.default.fetch(new Request(origin + '/setup', { method: 'POST', redirect: 'manual', headers: { Host: 'penny.test', ...headers, 'Content-Type': 'application/x-www-form-urlencoded' }, body }))
  expect((await form({ ...cookie, Origin: 'https://evil.test' })).status).toBe(403)
  expect((await form({ Origin: origin })).status).toBe(401)
  expect((await form({ ...cookie, Origin: origin }, 'confirm=no')).status).toBe(400)
  expect((await call('/app/overview', undefined, { ...cookie, ...html })).status).toBe(303)

  const finished = await finishFirstRun(cookie)
  expect(finished.status).toBe(303)
  expect(location(finished).pathname).toBe('/app')
  expect((await call('/app/overview', undefined, { ...cookie, ...html })).status).toBe(200)
  const later = await call('/setup', undefined, { ...cookie, ...html })
  expect(later.status).toBe(303)
  expect(location(later).pathname).toBe('/app')
  expect((await env.DB.prepare('SELECT COUNT(*) n FROM oa_first_run').first<{ n: number }>())!.n).toBe(1)
})
