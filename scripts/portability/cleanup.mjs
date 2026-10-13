import { invalidateTransfersStatements, redactionStatements } from '../base-cli/modules/portability/journal.mjs'
import { toD1Sql } from '../base-cli/modules/erasure/fence.mjs'
export async function portabilityErasureStatements(db) {
  const installed = await db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='rer_portability_state'").first()
  return installed ? invalidateTransfersStatements(db) : []
}
/** Portability's restore checkpoint for rewritten rows, as import-kit statements: an archive
 * made before the erasure is refused whole once the later journal is supplied. */
export async function portabilityRedactionCheckpoint(db) {
  return (await redactionStatements(db)).map(toD1Sql)
}
