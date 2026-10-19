import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { unstable_splitSqlQuery as split } from 'wrangler'
import { PortabilityError } from '@runeditrun/rer/modules/portability'
import { migrationReplay } from '@runeditrun/rer/modules/portability/migration-history'
import { appliedMigrations } from '@runeditrun/rer/internal/modules/portability/bridge.mjs'
const directory = new URL('../../migrations/core/', import.meta.url)
/** Base's replay of this installation's applied migrations, in its ledger's order
 * (Wrangler's d1_migrations or RER Platform's rer_migrations), from this checkout's
 * files, never the archive's SQL. Base places an older archive in that history,
 * refuses a later migration that rewrites restorable rows, and vouches for rows the
 * migrations themselves seed. */
export async function restoreMigrations(db, policy) {
  const plan = await Promise.all(((await appliedMigrations(db)) ?? []).map(async name => {
    // An applied migration this checkout does not ship cannot be replayed.
    if (!/^[\w.-]+\.sql$/.test(name)) throw new PortabilityError('schema_mismatch:migration_history', 409)
    const bytes = await readFile(new URL(name, directory)).catch(error => { if (error.code === 'ENOENT') throw new PortabilityError('schema_mismatch:migration_history', 409); throw error })
    return { name, statements: split(bytes.toString('utf8')), sha256: createHash('sha256').update(bytes).digest('hex') }
  }))
  return migrationReplay(plan, policy)
}
