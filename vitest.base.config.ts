import { fileURLToPath } from 'node:url'
import { readdir } from 'node:fs/promises'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'
import { generatedTransport } from './tests/migration/generated-transport.ts'
const migrations = await readD1Migrations(fileURLToPath(new URL('./migrations/core', import.meta.url)))
const fullMigrationNames = (await readdir(new URL('./migrations/core', import.meta.url))).filter(name=>name.endsWith('.sql')).sort()
export default defineConfig({
 resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},
 plugins:[cloudflareTest({wrangler:{configPath:'./dist/server/wrangler.json'},miniflare:{bindings:{
  PENNY_ENVIRONMENT:'test',APP_ORIGIN:'https://penny.test',AUTH_SECRET:'synthetic-base-auth-secret-for-worker-tests',SETUP_TOKEN:'synthetic-base-setup-token-for-worker-tests',
  // Historical notification fixtures use Brisbane clocks; production setup retains UTC.
  WORKSPACE_TIMEZONE:'Australia/Brisbane',
  OPERATOR_EMAIL:'owner@penny.invalid',MAIL_PROVIDER:'sendgrid',MAIL_FROM:'penny@example.test',SENDGRID_API_KEY:'synthetic-provider-test-key',
 }}})],
 test:{
  // Limit native Worker/D1 memory bursts on the shared build host; in-test races remain concurrent.
  maxWorkers:1,
  // Native Worker/D1 round trips take far longer than the 5 s default on a loaded shared host.
  testTimeout:60_000,hookTimeout:60_000,
  include:['tests/base/**/*.test.ts'],provide:{migrations,fullMigrationNames,generatedTransport:await generatedTransport()},
 },
})
