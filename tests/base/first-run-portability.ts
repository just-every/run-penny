import {applyD1Migrations,reset} from 'cloudflare:test'
import {expect,inject} from 'vitest'
import {createPennyApi} from '../../src/core/app/api'
import type {exportArchive} from '../../src/core/features/data/archive'
import {call,env,finishFirstRun,origin} from './support'

const html = {Accept: 'text/html'}
const setupFact = () => env.DB.prepare('SELECT * FROM oa_first_run').first()

export async function proveFirstRunPortability(source: {Cookie: string}) {
  const completed = await setupFact()
  expect(completed).not.toBeNull()
  const wording = 'synthetic-penny-portable-evidence'
  const recorded = await call('/api/operator/evidence', {sourceType: 'interview', wording, observedAt: '2026-10-08T12:00:00.000Z'}, source)
  expect(recorded.status).toBe(201)
  const evidence = await recorded.json() as {id: string}
  const exported = await call('/api/operator/data/export', undefined, source)
  expect(exported.status).toBe(200)
  const bundle = await exported.json() as Awaited<ReturnType<typeof exportArchive>>
  expect(bundle.archive.tables.evidence_items).toEqual(expect.arrayContaining([expect.objectContaining({id: evidence.id})]))
  expect(bundle.archive.tables.evidence_versions).toEqual(expect.arrayContaining([expect.objectContaining({evidence_id: evidence.id, wording})]))
  expect(bundle.archive.tables).not.toHaveProperty('oa_first_run')
  expect(JSON.stringify(bundle)).not.toContain('oa_first_run')
  expect(Object.values(bundle.archive.tables).flat()).not.toContainEqual(completed)
  expect(bundle.archive.tables).not.toHaveProperty('oa_operators')

  await reset()
  await applyD1Migrations(env.DB, inject('migrations'))
  const destinationEmail = ['synthetic-penny-destination', 'example.test'].join('@')
  const claim = await createPennyApi().fetch(new Request(origin + '/auth/bootstrap', {
    method: 'POST', headers: {Origin: origin, 'Content-Type': 'application/json'},
    body: JSON.stringify({token: env.SETUP_TOKEN, displayName: 'Independent owner', returnTo: '/app'}),
  }), {...env, OPERATOR_EMAIL: destinationEmail})
  expect(claim.status).toBe(303)
  const destination = {Cookie: claim.headers.get('Set-Cookie')!.split(';')[0]}
  const destinationOwner = await env.DB.prepare("SELECT * FROM oa_operators WHERE role='owner'").first()
  expect(destinationOwner).toMatchObject({email: destinationEmail, status: 'active'})
  expect(destinationOwner!.id).not.toBe(completed!.completed_by)
  expect(await setupFact()).toBeNull()
  expect((await call('/api/auth/session', undefined, source)).status).toBe(401)
  const restored = await call('/api/operator/data/import', bundle, destination)
  expect(restored.status, await restored.clone().text()).toBe(200)
  expect(await restored.json()).toMatchObject({status: 'complete'})
  expect(await env.DB.prepare("SELECT * FROM oa_operators WHERE role='owner'").first()).toEqual(destinationOwner)
  expect(await setupFact()).toBeNull()
  const readback = await call(`/api/operator/evidence/${evidence.id}/versions`, undefined, destination)
  expect(readback.status).toBe(200)
  expect(await readback.text()).toContain(wording)
  const app = await call('/app/overview', undefined, {...destination, ...html})
  expect(app.status).toBe(303)
  expect(app.headers.get('Location')).toBe('/setup')
  const setup = await call('/setup', undefined, {...destination, ...html})
  expect(setup.status).toBe(200)
  expect(await setup.text()).toContain('Finish setup')
  expect((await finishFirstRun(destination)).status).toBe(303)
  expect(await setupFact()).toMatchObject({completed_by: destinationOwner!.id})
  expect((await call('/app/overview', undefined, {...destination, ...html})).status).toBe(200)
}
