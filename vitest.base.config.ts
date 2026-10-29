import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'
import { generatedTransport } from './tests/migration/generated-transport.ts'
const migrations = await readD1Migrations(fileURLToPath(new URL('./migrations/core', import.meta.url)))
const fullMigrationNames = (await readdir(new URL('./migrations/core', import.meta.url))).filter(name=>name.endsWith('.sql')).sort()
// What RER Platform records in rer_migrations when it installs this revision: each file's name and SHA-256 of its bytes.
const platformLedger = await Promise.all(fullMigrationNames.map(async name=>({name,sha256:createHash('sha256').update(await readFile(new URL('./migrations/core/'+name, import.meta.url))).digest('hex')})))
// The same built Worker and bindings, with Queue delivery controlled explicitly
// by cloudflare:test instead of racing fixtures' historical mail clocks.
// Producers stay; the real consumer does not start unless PENNY_TEST_QUEUE_CONSUMERS=1.
const workerConfig = JSON.parse(await readFile(new URL('./dist/server/wrangler.json', import.meta.url), 'utf8'))
// Native tests provide this paid RPC port in their existing per-flow fixtures.
// Never attach the production provider service to a disposable test Worker.
workerConfig.services = (workerConfig.services ?? []).filter((service:{binding:string}) => service.binding !== 'PENNY_LEARNING_EGRESS')
if (workerConfig.queues && process.env.PENNY_TEST_QUEUE_CONSUMERS !== '1') workerConfig.queues.consumers = []
await writeFile(new URL('./dist/server/wrangler.test.json', import.meta.url), JSON.stringify(workerConfig))
export default defineConfig({
 resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},
 plugins:[cloudflareTest({wrangler:{configPath:'./dist/server/wrangler.test.json'},miniflare:{bindings:{
  PENNY_ENVIRONMENT:'test',APP_ORIGIN:'https://penny.test',AUTH_SECRET:'synthetic-base-auth-secret-for-worker-tests',SETUP_TOKEN:'synthetic-base-setup-token-for-worker-tests',
  // Historical notification fixtures use Brisbane clocks; production setup retains UTC.
  WORKSPACE_TIMEZONE:'Australia/Brisbane',
  OPERATOR_EMAIL:'owner@penny.invalid',MAIL_PROVIDER:'sendgrid',MAIL_FROM:'penny@example.test',MAIL_API_KEY:'synthetic-provider-test-key',
 }}})],
 test:{
  // Limit native Worker/D1 memory bursts on the shared build host; in-test races remain concurrent.
  maxWorkers:1,
  // Native Worker/D1 round trips take far longer than the 5 s default on a loaded shared host.
  testTimeout:60_000,hookTimeout:60_000,
  include:['tests/base/**/*.test.ts'],provide:{migrations,fullMigrationNames,platformLedger,generatedTransport:await generatedTransport()},
 },
})
