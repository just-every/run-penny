import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = fileURLToPath(new URL('../../', import.meta.url))

test('[BASE-SECRET-002] hosted runtime checks and doctors refuse missing or mismatched provider inputs without disclosing values', () => {
 for (const provider of ['sendgrid', 'resend']) {
  const key = provider === 'sendgrid' ? 'SENDGRID_API_KEY' : 'RESEND_API_KEY'
  const otherKey = provider === 'sendgrid' ? 'RESEND_API_KEY' : 'SENDGRID_API_KEY'
  const env = { APP_ORIGIN: 'https://penny.fixture.invalid', PENNY_ENVIRONMENT: 'production',
   OPERATOR_EMAIL: 'fixture-owner@example.invalid', MAIL_PROVIDER: provider, MAIL_FROM: 'fixture-sender@example.invalid',
   AUTH_SECRET: 'fixture-auth-'.repeat(4), [key]: 'fixture-selected-key' }
  for (const verb of ['check', 'doctor']) {
   for (const [changes, ready, missingKey] of [
    [{}, true],
    [{ [key]: undefined }, false, key],
    [{ [key]: undefined, [otherKey]: 'fixture-other-key' }, false, key],
    [{ MAIL_PROVIDER: provider === 'sendgrid' ? 'resend' : 'sendgrid', [otherKey]: 'fixture-other-key' }, false],
    [{ MAIL_FROM: undefined }, false],
    [{ AUTH_SECRET: 'fixture-short-secret' }, false],
   ]) {
    const cli = spawnSync(process.execPath, ['scripts/penny-operations.mjs', verb, '--profile', `runtime-${provider}`],
     { cwd: root, env: { ...env, ...changes }, encoding: 'utf8' })
    assert.equal(cli.status, ready ? 0 : 1, cli.stderr)
    const result = JSON.parse(cli.stdout)
    assert.equal(result.ok, ready)
    if (missingKey) {
     assert(result.loops.some(loop => loop.missingEnvironment.includes(missingKey)))
     assert(cli.stderr.includes(missingKey))
    }
    for (const value of [env[key], env.AUTH_SECRET, 'fixture-other-key', 'fixture-short-secret']) {
     assert.equal((cli.stdout + cli.stderr).includes(value), false, 'Both output streams suppress credentials')
    }
   }
  }
 }
})
