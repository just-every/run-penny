import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'
import { main } from '../../scripts/installer/owner-cli.mjs'
import { ownerFixture } from '../installer/owner-fixture.mjs'

test('a named preview installs beside production with independent authority, data, repeat and health', async t => {
  const { root, provider, env, options } = await ownerFixture(t)
  const saved = name => readFile(join(root, '.rer/deploy', name))
  // This valid name would collide with production's legacy credentials if
  // every state/secret/declaration shared a flat namespace.
  const environment = 'production-secrets'
  for (const invalid of ['../production', 'production--copy', 'a'.repeat(33)]) {
    await assert.rejects(main(['deploy', '--environment', invalid], env, options), /invalid-owner-environment/)
    assert.equal(provider.state.calls.length, 0)
  }
  const production = await main(['deploy'], env, options)
  const before = await Promise.all(['production.json', 'production-secrets.json', 'production-declaration.json'].map(saved))
  const preview = await main(['deploy', '--environment', environment], {
    ...env, OPERATOR_EMAIL: 'reviewer@penny.invalid',
    PENNY_EXPECTED_ORIGIN: `https://penny-${environment}.fixture-account.workers.dev`,
  }, options)
  assert.notEqual(preview.origin, production.origin)
  assert.notEqual(preview.state, production.state)
  for (const kind of ['d1', 'r2', 'queues']) {
    const productionResource = production.created.find(name => name.startsWith(`${kind}:`))
    const previewResource = preview.created.find(name => name.startsWith(`${kind}:`))
    assert.ok(productionResource && previewResource)
    assert.notEqual(previewResource, productionResource)
  }
  const credentials = JSON.parse(await readFile(join(root, preview.credentialFile)))
  const productionCredentials = JSON.parse(before[1])
  for (const key of ['AUTH_SECRET', 'SETUP_TOKEN']) assert.notEqual(credentials[key], productionCredentials[key])
  assert.equal((await stat(join(root, preview.credentialFile))).mode & 0o777, 0o600)
  const previewState = JSON.parse(await readFile(preview.state))
  assert.equal(previewState.environment, environment)
  const bindings = worker => Object.fromEntries(provider.state.workers.get(worker).settings.bindings.filter(binding => binding.type === 'plain_text').map(binding => [binding.name, binding.text]))
  assert.equal(bindings(preview.worker).PENNY_ENVIRONMENT, 'preview')
  assert.equal(bindings(production.worker).PENNY_ENVIRONMENT, 'production')
  const productionDb = provider.state.databases.find(row => row.name === production.created.find(name => name.startsWith('d1:')).slice(3)).db
  const previewDb = provider.state.databases.find(row => row.name === preview.created.find(name => name.startsWith('d1:')).slice(3)).db
  productionDb.exec("INSERT INTO boards(id,name,slug,visibility,position,created_at,updated_at) VALUES ('retained','Production','production','internal',0,'2026-10-11','2026-10-11')")
  assert.equal(previewDb.prepare("SELECT count(*) AS n FROM boards WHERE id='retained'").get().n, 0)
  const resume = { CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN }
  const writes = provider.state.writes.length
  assert.equal((await main(['deploy', '--environment', environment], resume, options)).changed, false)
  for (const args of [[], ['--environment', environment], ['--', '--environment', environment]]) assert.equal((await main(['health', ...args], resume, options)).ok, true)
  await assert.rejects(main(['health', '--environment', environment, '--state', '.rer/deploy/production.json'], resume, options), /invalid-owner-command/)
  assert.equal(provider.state.writes.length, writes)
  for (const [index, name] of ['production.json', 'production-secrets.json', 'production-declaration.json'].entries()) assert.ok((await saved(name)).equals(before[index]))
  assert.equal(productionDb.prepare("SELECT name FROM boards WHERE id='retained'").get().name, 'Production')
})
