import { predecessorAuth } from './tests/predecessor-plugin.ts'
import { generatedTransport } from './tests/migration/generated-transport.ts'
import { fileURLToPath } from 'node:url'
import { readdir } from 'node:fs/promises'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

const migrationDirectory = fileURLToPath(new URL('./migrations/core', import.meta.url))
const fullMigrationNames = (await readdir(migrationDirectory)).filter(name=>name.endsWith('.sql')).sort()
// Historical routes retain their older auth dispatcher, while every current
// migration is installed so product triggers have their real native prerequisites.
const migrations = await readD1Migrations(migrationDirectory)

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    predecessorAuth(),
    cloudflareTest({
      wrangler: { configPath: './dist/server/wrangler.json' },
      // This historical fixture supplies its own D1-backed identity transport.
      // The emitted production default must not select hosted startup admission
      // before those assertions run. Production refusal cases opt in explicitly.
      miniflare: { bindings: { PENNY_ENVIRONMENT: 'test' } },
    }),
  ],
  test: {
    // Native Worker/D1 round trips take far longer than the 5 s default on a loaded shared host.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    include: ['tests/e2e/worker/**/*.test.ts'],
    setupFiles: ['./tests/predecessor-setup.ts'],
    provide: { migrations, fullMigrationNames, generatedTransport: await generatedTransport() },
  },
})
