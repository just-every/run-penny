import {applyD1Migrations,reset} from 'cloudflare:test'
import {afterEach,beforeEach,expect,inject,it,vi} from 'vitest'
import {call,env,mockMail,owner} from './support'

beforeEach(async () => {await reset(); await applyD1Migrations(env.DB, inject('migrations')); mockMail()})
afterEach(() => vi.restoreAllMocks())
const html = {Accept: 'text/html'}
const setupFact = () => env.DB.prepare('SELECT * FROM oa_first_run').first()

it('[OPS-005] migration 0027 completes an active native owner installation while preserving its owner and sessions on upgrade and repeat', async () => {
  const migrations = inject('migrations'), boundary = migrations.findIndex(migration => migration.name.startsWith('0027_'))
  expect(boundary).toBeGreaterThan(0)
  await reset()
  await applyD1Migrations(env.DB, migrations.slice(0, boundary))
  const cookie = await owner({finishSetup: false})
  expect((await call('/api/auth/session', undefined, cookie)).status).toBe(200)
  const snapshot = async () => (await env.DB.batch<Record<string, string | number | null>>([
    env.DB.prepare('SELECT * FROM oa_operators ORDER BY id'),
    env.DB.prepare('SELECT * FROM oa_sessions ORDER BY id'),
    env.DB.prepare('SELECT * FROM oa_bootstrap'),
  ])).map(result => result.results)
  const before = await snapshot()
  expect(before[0]).toEqual([expect.objectContaining({role: 'owner', status: 'active'})])
  expect(before[1]).toHaveLength(1)
  expect(await env.DB.prepare("SELECT name FROM sqlite_master WHERE name='oa_first_run'").first()).toBeNull()
  await applyD1Migrations(env.DB, [migrations[boundary]])
  expect(await snapshot()).toEqual(before)
  const completed = await setupFact()
  expect(completed).toEqual({singleton: 1, completed_by: before[0][0].id, completed_at: expect.any(Number)})
  await applyD1Migrations(env.DB, [migrations[boundary]])
  expect(await snapshot()).toEqual(before)
  expect(await setupFact()).toEqual(completed)
  expect((await call('/api/auth/session', undefined, cookie)).status).toBe(200)
  const setup = await call('/setup', undefined, {...cookie, ...html})
  expect(setup.status).toBe(303)
  expect(setup.headers.get('Location')).toBe('/app')
})
