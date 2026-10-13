import type { DatabaseConnection } from '../../platform/database'
import { assertUnique } from '../../shared/ids'
import type { PennySample } from '../sample-data/schema'
import { DecisionsRepository } from './repository'

export async function importDecisionsSample(database: DatabaseConnection, records: PennySample['decisions'], now: string): Promise<void> {
  assertUnique(records.map((record) => record.id), 'sample decision IDs')
  assertUnique(records.map((record) => record.slug), 'sample decision slugs')
  for (const record of records) {
    assertUnique(record.bets.map((bet) => bet.id), `candidate bet IDs for decision ${record.id}`)
    if (record.selectedCandidateBetId !== null && !record.bets.some((bet) => bet.id === record.selectedCandidateBetId)) {
      throw new Error(`Decision ${record.id} selects a candidate bet outside its brief`)
    }
    if (record.revision !== null && !record.bets.some((bet) => bet.id === record.revision?.selectedCandidateBetId)) {
      throw new Error(`Decision revision ${record.revision.id} selects a candidate bet outside its brief`)
    }
    for (const bet of record.bets) {
      assertUnique(bet.accountIds, `accounts for candidate bet ${bet.id}`)
      assertUnique(bet.evidenceLinks.map((link) => link.evidenceId), `evidence for candidate bet ${bet.id}`)
    }
  }
  await new DecisionsRepository(database).insertDecisions(records, now)
}
