import { join } from 'node:path'
import { createRequire } from 'node:module'
import { PortabilityError } from '@runeditrun/rer/modules/portability'
import { platformMigrationDeclaration, platformMigrationPreflight } from '@runeditrun/rer/internal/cli/portability-migrations.mjs'
// Which runner migrates this installation's database. RER Platform's runner records each file it applies in
// rer_migrations, a ledger Wrangler cannot read: such a database is Platform's alone to migrate and must already hold
// every migration file of this checkout, matched by SHA-256 (Base's own preflight, as rer's local transfers run it).
// Reported over IPC: {platformLedger}, or {refused} with Base's symbolic code.
const root = process.cwd()
const { getPlatformProxy, unstable_splitSqlQuery } = createRequire(join(root, 'package.json'))('wrangler')
const proxy = await getPlatformProxy({ configPath: join(root, 'wrangler.jsonc'), persist: { path: join(root, '.wrangler/state/v3') }, remoteBindings: false })
let reply
try { reply = await platformMigrationPreflight(root, proxy.env.DB, 'DB', platformMigrationDeclaration(), unstable_splitSqlQuery) }
catch (error) { if (!(error instanceof PortabilityError)) throw error; reply = { refused: error.code } }
finally { await proxy.dispose() }
await new Promise(resolve => process.send(reply, resolve))
process.disconnect()
