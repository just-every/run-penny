import assert from 'node:assert/strict'
import { access, readFile, stat, rename, symlink, link, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'
import { main } from '../../scripts/installer/owner-cli.mjs'
import { ownerFixture } from '../installer/owner-fixture.mjs'

const exists = path => access(path).then(() => true, () => false)
const bytes = (root, name) => readFile(join(root, '.rer/deploy', name))

test('[BASE-OPS-002 BASE-ACCESS-002] owner setup persists authority, all migrations and producer-only resources; repeat and health do not write', async t => {
  const { root, provider, env, options } = await ownerFixture(t)
  const first = await main(['deploy'], env, options)
  assert.equal(first.origin, 'https://penny-production.fixture-account.workers.dev')
  assert.deepEqual(first.created, ['d1:penny-production-db', 'r2:penny-production-files', 'queues:penny-production-jobs'])
  assert.equal(provider.state.queues[0].consumers.length, 0)
  assert.deepEqual(provider.state.schedules, [{ cron: '* * * * *' }])
  const db = provider.state.databases[0].db
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name='notification_intents'").get())
  assert.ok(db.prepare("SELECT name FROM pragma_table_info('notification_intents') WHERE name='restoration_hold_at'").get())
  db.exec("INSERT INTO boards(id,name,slug,visibility,position,created_at,updated_at) VALUES ('test-owner-data','Retained','retained','internal',0,'2026-10-09','2026-10-09')")
  const secrets = await bytes(root, 'production-secrets.json'), state = await bytes(root, 'production.json'), writes = provider.state.writes.length
  const values = JSON.parse(secrets)
  for (const key of ['AUTH_SECRET', 'SETUP_TOKEN']) {
    assert.ok(/^[a-f0-9]{64}$/.test(values[key]), 'Generated authority is valid')
    assert.ok(provider.state.secrets.some(item => item.name === key && item.value === values[key]), 'Declared native authority reaches only its secret binding')
    assert.ok(!state.includes(values[key]), 'The durable ledger contains no authority value')
  }
  assert.equal((await stat(join(root, '.rer/deploy/production-secrets.json'))).mode & 0o777, 0o600)
  const resume = { CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN }
  assert.equal((await main(['deploy'], resume, options)).changed, false)
  assert.equal((await main(['health'], resume, options)).ok, true)
  assert.equal(provider.state.writes.length, writes)
  assert.ok((await bytes(root, 'production-secrets.json')).equals(secrets), 'Repeat retains exact credential bytes')
  assert.ok((await bytes(root, 'production.json')).equals(state), 'Repeat retains exact deployment bytes')
  assert.equal(db.prepare("SELECT name FROM boards WHERE id='test-owner-data'").get().name, 'Retained')
})

test('[BASE-OPS-002] owner setup refuses missing, partial or conflicting inputs before storage or provider writes', async t => {
  const { root, provider, env, options } = await ownerFixture(t)
  for (const invalid of [{}, { CF_THROWAWAY_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID }, { ...env, OPERATOR_EMAIL: '' }, { ...env, MAIL_PROVIDER: 'sendgrid' }, { ...env, MAIL_FROM: 'sender@penny.invalid' }, { ...env, MAIL_PROVIDER: 'resend', SENDGRID_API_KEY: 'test-only-wrong-provider', RESEND_API_KEY: 'test-only-resend', MAIL_FROM: 'sender@penny.invalid' }, { ...env, CLOUDFLARE_ACCOUNT_ID: 'bad' }]) {
    await assert.rejects(main(['deploy'], invalid, options))
    assert.equal(await exists(join(root, '.rer')), false)
    assert.equal(provider.state.calls.length, 0)
  }
})

test('[BASE-OPS-002] interrupted owner provisioning resumes with one resource each and retained generated secrets', async t => {
  const { root, provider, env, options } = await ownerFixture(t)
  provider.fail('POST', /^\/r2\/buckets$/)
  await assert.rejects(main(['deploy'], env, options), /provider-http-500/)
  const secrets = await bytes(root, 'production-secrets.json')
  assert.equal(provider.state.databases.length, 1)
  assert.equal((await main(['deploy'], env, options)).ok, true)
  for (const [collection, path] of [['databases', '/d1/database'], ['buckets', '/r2/buckets'], ['queues', '/queues']]) {
    assert.equal(provider.state[collection].length, 1)
    assert.equal(provider.state.writes.filter(item => item.method === 'POST' && item.path === path).length, 1)
  }
  assert.ok((await bytes(root, 'production-secrets.json')).equals(secrets), 'Interrupted setup retains generated secrets')
})

test('[BASE-OPS-002] foreign collisions and uncertain resource creation never cause adoption or another create', async t => {
  for (const uncertain of [false, true]) await t.test(uncertain ? 'uncertain create' : 'foreign resource', async t => {
    const { provider, env, options } = await ownerFixture(t)
    if (uncertain) provider.fail('POST', /^\/d1\/database$/, { afterApply: true })
    else provider.foreign.d1('penny-production-db')
    await assert.rejects(main(['deploy'], env, options), uncertain ? /provider-transport-failed/ : /resource-name-collision/)
    const writes = provider.state.writes.length
    await assert.rejects(main(['deploy'], env, options), uncertain ? /uncertain-resource-create/ : /resource-name-collision/)
    assert.equal(provider.state.writes.length, writes)
    assert.equal(provider.state.databases.length, 1)
  })
})

test('[BASE-OPS-002] expected hostname, owner and configuration refuse drift', async t => {
  const { root, provider, env, options } = await ownerFixture(t)
  await assert.rejects(main(['deploy'], { ...env, PENNY_EXPECTED_ORIGIN: 'https://penny-production.other.workers.dev' }, options), /owner-origin-mismatch/)
  assert.equal(provider.state.writes.length, 0)
  await main(['deploy'], env, options)
  const writes = provider.state.writes.length
  await assert.rejects(main(['deploy'], { ...env, OPERATOR_EMAIL: 'other@penny.invalid' }, options), /saved-owner-identity-conflict/)
  await assert.rejects(main(['deploy'], { ...env, WORKSPACE_TIMEZONE: 'Pacific/Honolulu' }, options), /saved-owner-configuration-conflict/)
  await assert.rejects(main(['deploy', '--state', '../foreign.json'], env, options), /invalid-owner-command/)
  assert.equal(provider.state.writes.length, writes)
  assert.ok((await bytes(root, 'production.json')).length > 0)
})

test('[BASE-OPS-002 BASE-SECRET-002] owner credentials refuse symlink and hard-link custody hazards without provider calls', async t => {
  const { root, provider, env, options } = await ownerFixture(t)
  await main(['deploy'], env, options)
  const file = join(root, '.rer/deploy/production-secrets.json'), original = file + '.test-original'
  const bytesBefore = await readFile(file), calls = provider.state.calls.length
  await rename(file, original)
  for (const hazard of [symlink, link]) {
    await hazard(original, file)
    await assert.rejects(main(['deploy'], env, options), /(?:Unsafe|private|regular|link)/i)
    assert.equal(provider.state.calls.length, calls)
    assert.ok((await readFile(original)).equals(bytesBefore))
    await unlink(file)
  }
  await rename(original, file)
})

test('[BASE-OPS-002] owner-account identity cannot switch underneath an existing durable deployment', async t => {
  const { root, provider, env, options } = await ownerFixture(t)
  await main(['deploy'], env, options)
  const previous = await bytes(root, 'production.json'), writes = provider.state.writes.length
  const otherAccount = 'b'.repeat(32)
  assert.notEqual(otherAccount, env.CLOUDFLARE_ACCOUNT_ID)
  // Test-only second account metadata reaches the native ledger check instead
  // of failing earlier on absent fixture credentials or an unknown endpoint.
  const secondAccount = async (input, init) => {
    const url = new URL(input)
    url.pathname = url.pathname.replace('/accounts/' + otherAccount + '/', '/accounts/' + env.CLOUDFLARE_ACCOUNT_ID + '/')
    return provider.fetch(url, init)
  }
  await assert.rejects(main(['deploy'], { ...env, CLOUDFLARE_ACCOUNT_ID: otherAccount }, { ...options, fetch: secondAccount }), /owner-state-target-mismatch/)
  assert.equal(provider.state.writes.length, writes)
  assert.ok((await bytes(root, 'production.json')).equals(previous))
})

test('[REL-011 BASE-SECRET-002] selected provider callback credentials are persisted once and bound explicitly', async t => {
  for (const providerName of ['sendgrid', 'resend']) await t.test(providerName, async t => {
    const { root, provider, env, options } = await ownerFixture(t)
    const key = providerName === 'sendgrid' ? 'SENDGRID_API_KEY' : 'RESEND_API_KEY'
    const event = providerName === 'sendgrid' ? 'SENDGRID_EVENT_PUBLIC_KEY' : 'RESEND_WEBHOOK_SECRET'
    const selected = { ...env, MAIL_PROVIDER: providerName, MAIL_FROM: 'sender@penny.invalid', [key]: 'test-only-mail-key', [event]: 'test-only-callback-key' }
    await main(['deploy'], selected, options)
    const secretBytes = await bytes(root, 'production-secrets.json'), state = await bytes(root, 'production.json'), writes = provider.state.writes.length
    assert.equal(provider.state.secrets.find(item => item.name === event)?.value, selected[event])
    assert.ok(!state.includes(selected[event]))
    assert.equal((await main(['deploy'], { CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN }, options)).changed, false)
    assert.equal(provider.state.writes.length, writes)
    assert.ok((await bytes(root, 'production-secrets.json')).equals(secretBytes))
    await assert.rejects(main(['deploy'], { ...selected, [event]: 'test-only-other-callback' }, options), /saved-owner-configuration-conflict/)
  })
})
