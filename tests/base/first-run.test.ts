import { applyD1Migrations, reset } from 'cloudflare:test'
import { beforeEach, afterEach, vi, expect, inject, it } from 'vitest'
import { call, env, owner, finishFirstRun, mockMail, origin } from './support'
import { exports } from 'cloudflare:workers'
import {toJSONAsync} from 'seroval'
import {invited} from './operator-invitation'
import {proveFirstRunPortability} from './first-run-portability'
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
  const peerEmail = ['synthetic-penny-peer', 'example.test'].join('@')
  const peer = await invited(cookie, peerEmail)
  expect(await env.DB.prepare('SELECT role FROM oa_operators WHERE id=?').bind(peer.id).first('role')).toBe('member')
  for (const path of ['/app', '/app/overview', '/app/settings']) {
    const response = await call(path, undefined, { ...peer.cookie, ...html })
    expect(response.status, path).toBe(200)
    expect(await response.text()).not.toContain('<title>Finish setup</title>')
  }
  const accountName = 'synthetic-penny-peer-account'
  const actor = await env.DB.prepare('SELECT id FROM operators WHERE email=?').bind(peerEmail).first<string>('id')
  expect(actor).not.toBeNull()
  const created = await call('/api/operator/accounts', {name: accountName, internalOwnerId: actor}, peer.cookie)
  expect(created.status).toBe(201)
  const account = await created.json() as {slug: string}
  const accountPage = await call(`/app/customers/${account.slug}`, undefined, {...peer.cookie, ...html})
  expect(accountPage.status).toBe(200)
  expect(await accountPage.text()).toContain(accountName)
  const generated = new URL((inject('generatedTransport') as Record<string,string>).loadOperatorResources, origin)
  generated.searchParams.set('payload', JSON.stringify(await toJSONAsync({data: `/app/customers/${account.slug}`})))
  const generatedPath = generated.pathname + generated.search
  const rpcHeaders = {'x-tsr-serverFn': 'true', Accept: 'application/json', 'Sec-Fetch-Site': 'same-origin'}
  const admitted = await call(generatedPath, undefined, {...peer.cookie, ...rpcHeaders})
  expect(admitted.status).toBe(200)
  const resources = await admitted.text()
  expect(resources).toContain(accountName)
  expect(resources).not.toContain('isSerializedRedirect')
  const ownerNavigation = await call(generatedPath, undefined, {...cookie, ...rpcHeaders})
  expect(await ownerNavigation.json()).toMatchObject({isSerializedRedirect: true, href: '/setup', reloadDocument: true})
  const peerSetup = await call('/setup', undefined, {...peer.cookie, ...html})
  expect(peerSetup.status).toBe(303)
  expect(location(peerSetup).pathname).toBe('/app')
  const setupState = async () => (await env.DB.batch([
    env.DB.prepare('SELECT * FROM oa_first_run'),
    env.DB.prepare('SELECT * FROM penny_mail_identity'),
    env.DB.prepare('SELECT * FROM penny_workspace_clock'),
  ])).map(result => result.results)
  const beforePeerPost = await setupState()
  const peerPost = await finishFirstRun(peer.cookie)
  expect(peerPost.status).toBe(403)
  expect(await peerPost.json()).toEqual({error: 'owner_required'})
  expect(await setupState()).toEqual(beforePeerPost)
  expect(await env.DB.prepare('SELECT * FROM oa_first_run').first()).toBeNull()
  expect((await call('/app/overview', undefined, {...cookie, ...html})).status).toBe(303)

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
  const completed = await env.DB.prepare('SELECT * FROM oa_first_run').first()
  const nativeOwner = await env.DB.prepare("SELECT id FROM oa_operators WHERE role='owner' AND status='active'").first<string>('id')
  expect(completed).toMatchObject({singleton: 1, completed_by: nativeOwner, completed_at: expect.any(Number)})
  expect((await finishFirstRun(cookie)).status).toBe(303)
  expect(await env.DB.prepare('SELECT * FROM oa_first_run').first()).toEqual(completed)
  await proveFirstRunPortability(cookie)
})
