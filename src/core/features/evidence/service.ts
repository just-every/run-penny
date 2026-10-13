import type { DatabaseConnection } from '../../platform/database'
import { assertUnique } from '../../shared/ids'
import type { PennySample } from '../sample-data/schema'
import { EvidenceRepository } from './repository'

export async function importEvidenceSample(database: DatabaseConnection, records: PennySample['evidence'], now: string): Promise<void> {
  assertUnique(records.map((record) => record.id), 'sample evidence IDs')
  assertUnique(records.map((record) => record.versionId), 'sample evidence version IDs')
  for (const record of records) {
    assertUnique(record.tagIds, `tags for evidence ${record.id}`)
    if (record.reviewState === 'reviewed' && record.reviewReason === null) {
      throw new Error(`Reviewed evidence ${record.id} needs a review reason`)
    }
  }
  await new EvidenceRepository(database).insertEvidence(records, now)
}
