import { fileURLToPath } from 'node:url'
import { unstable_splitSqlQuery as split } from 'wrangler'
import { migrationReplay } from '@runeditrun/rer/modules/portability/migration-history'
import { appliedMigrations, platformMigrationDeclaration } from '@runeditrun/rer/portability-migrations'
const root = fileURLToPath(new URL('../../', import.meta.url))
/** Base's replay of this installation's applied migrations, in its ledger's order
 * (Wrangler's d1_migrations or RER Platform's rer_migrations), from this checkout's
 * files, never the archive's SQL. Base places an older archive in that history,
 * refuses a later migration that rewrites restorable rows, and vouches for rows the
 * migrations themselves seed. An applied migration this checkout does not ship is refused by rer. */
export async function restoreMigrations(db, policy) {
  const declaration = platformMigrationDeclaration()
  return migrationReplay(await appliedMigrations(root, db, 'DB', declaration, split), policy, declaration)
}
