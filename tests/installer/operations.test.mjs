import { fileURLToPath as __rerTestEntryPath } from 'node:url';
const __rerTestEntry = __rerTestEntryPath(import.meta.resolve('@runeditrun/rer/internal/global/rer.mjs'));
const __rerTestEntryArgs = args => args[1] === 'dev' && !args.some(arg => ['--foreground', '--detach', '--stop', '--help'].includes(arg)) ? [...args, '--foreground'] : args;
import assert from 'node:assert/strict'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('../../', import.meta.url))
const env = { CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), CLOUDFLARE_API_TOKEN: 'test-only-owner-token', OPERATOR_EMAIL: 'owner@penny.invalid', MAIL_PROVIDER: 'sendgrid', MAIL_FROM: 'sender@penny.invalid', SENDGRID_API_KEY: 'test-only-sendgrid', AUTH_SECRET: 'test-only-auth-authority-'.repeat(3), APP_ORIGIN: 'https://penny.fixture.invalid', PENNY_ENVIRONMENT: 'production' }

function inspectProfile(root, profile, values) {
  const cli = spawnSync(process.execPath, ['scripts/penny-operations.mjs', 'check', '--profile', profile],
    { cwd: root, env: values, encoding: 'utf8' })
  const result = JSON.parse(cli.stdout)
  assert.equal(cli.status, result.ok ? 0 : 1, cli.stderr)
  for (const [name, value] of Object.entries(values)) {
    if (value && /(?:KEY|TOKEN|SECRET)$/.test(name)) assert.equal((cli.stdout + cli.stderr).includes(value), false, 'Both output streams suppress credentials')
  }
  return result
}

test('[BASE-SECRET-002] hosted runtime profiles require a credential-free HTTPS origin and explicit runtime mode', async () => {
  for (const bad of [{ APP_ORIGIN: undefined }, { APP_ORIGIN: 'http://127.0.0.1:8787' }, { APP_ORIGIN: 'https://test-only-user:test-only-password@penny.fixture.invalid' }, { APP_ORIGIN: 'https://penny.fixture.invalid/#test-only-fragment' }, { PENNY_ENVIRONMENT: undefined }, { PENNY_ENVIRONMENT: 'local' }]) {
    const result = await inspectProfile(root, 'runtime-sendgrid', { ...env, ...bad })
    assert.equal(result.ok, false)
    assert.ok(!JSON.stringify(result).includes('test-only-password'))
  }
  assert.equal((await inspectProfile(root, 'runtime-sendgrid', { ...env, PENNY_ENVIRONMENT: 'preview' })).ok, true)
  assert.equal((await inspectProfile(root, 'owner-later', { ...env, MAIL_PROVIDER: 'later', SENDGRID_API_KEY: undefined })).ok, false, 'Later mail refuses a partial sender configuration')
})

test('[BASE-OPS-002 BASE-SECRET-002] selected offline profiles require only their actual provider and refuse partial or wrong selection', async () => {
  assert.equal((await inspectProfile(root, 'local', {})).ok, true)
  const missing = await inspectProfile(root, 'owner-sendgrid', {})
  assert.ok(missing.missingEnvironment.length > 0)
  assert.equal((await inspectProfile(root, 'owner-sendgrid', env)).ok, true)
  assert.equal((await inspectProfile(root, 'runtime-sendgrid', env)).ok, true)
  assert.equal((await inspectProfile(root, 'owner-resend', {...env,MAIL_PROVIDER:'resend',SENDGRID_API_KEY:undefined,RESEND_API_KEY:'test-only-resend'})).ok, true)
  assert.equal((await inspectProfile(root, 'owner-later', {...env,MAIL_PROVIDER:'later',SENDGRID_API_KEY:undefined,MAIL_FROM:undefined})).ok, true)
  for (const provider of ['sendgrid', 'resend']) {
    const key = provider === 'sendgrid' ? 'SENDGRID_API_KEY' : 'RESEND_API_KEY'
    const otherKey = provider === 'sendgrid' ? 'RESEND_API_KEY' : 'SENDGRID_API_KEY'
    const selected = {...env, MAIL_PROVIDER: provider, SENDGRID_API_KEY: undefined, [key]: 'test-only-selected-key'}
    for (const bad of [{[key]:undefined},{MAIL_FROM:''},{MAIL_PROVIDER:provider === 'sendgrid' ? 'resend' : 'sendgrid'},
      {[otherKey]:'test-only-conflict'},{CLOUDFLARE_API_TOKEN:undefined},{CLOUDFLARE_ACCOUNT_ID:'invalid'},{OPERATOR_EMAIL:undefined}]) {
      assert.equal((await inspectProfile(root, `owner-${provider}`, {...selected, ...bad})).ok, false)
    }
  }
  const later = {...env, MAIL_PROVIDER:'later', SENDGRID_API_KEY:undefined, MAIL_FROM:undefined}
  for (const bad of [{MAIL_PROVIDER:undefined},{MAIL_PROVIDER:'sendgrid'},{MAIL_FROM:'sender@penny.invalid'},
    {SENDGRID_API_KEY:'test-only-conflict'},{RESEND_API_KEY:'test-only-conflict'},{CLOUDFLARE_API_TOKEN:undefined}]) {
    assert.equal((await inspectProfile(root, 'owner-later', {...later, ...bad})).ok, false)
  }
  const unknown = spawnSync(process.execPath, ['scripts/penny-operations.mjs','check','--profile','invented'], {cwd:root,env:{},encoding:'utf8'})
  assert.equal(unknown.status, 1)
  assert.equal(JSON.parse(unknown.stderr).ok, false)
})

test('[BASE-OPS-002] describe and structural checks work before dependencies or configuration in a genuine clone', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'penny-dependency-free-')), clone = join(directory, 'source')
  t.after(() => rm(directory, { recursive: true, force: true }))
  execFileSync('git', ['clone', '--quiet', '--no-local', '--depth', '1', '--', root, clone], { stdio: 'pipe' })
  await assert.rejects(readFile(join(clone, 'node_modules/.modules.yaml')), { code: 'ENOENT' })
  await assert.rejects(readFile(join(clone, '.dev.vars')), { code: 'ENOENT' })
  const cleanEnv = { PATH: process.env.PATH }
  for (const args of [__rerTestEntryArgs([__rerTestEntry,'check','--profile','first-party']), __rerTestEntryArgs([__rerTestEntry,'describe'])]) {
    const checked = spawnSync(process.execPath, args, {cwd:clone,env:cleanEnv,encoding:'utf8'})
    assert.equal(checked.status, 0, checked.stdout + checked.stderr)
  }
  const childEnv = { PATH: process.env.PATH, MAIL_PROVIDER: 'sendgrid' }
  assert.throws(() => execFileSync(process.execPath, ['scripts/penny-operations.mjs','check','--profile','owner-sendgrid'], { cwd: clone, env: childEnv, stdio: ['ignore','pipe','pipe'] }), error => {
    assert.equal(error.status, 1)
    const missing = JSON.parse(error.stdout.toString())
    assert.equal(missing.ok, false)
    for (const name of [...missing.missingEnvironment, ...missing.loops.flatMap(loop => loop.missingEnvironment)]) {
      assert.ok(error.stderr.toString().includes(name), 'Every missing input is named with its safe source')
      assert.ok(missing.environmentSources[name])
    }
    return true
  })
})
