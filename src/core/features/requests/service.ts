import type { DatabaseConnection } from '../../platform/database'
import { assertUnique } from '../../shared/ids'
import type { PennySample } from '../sample-data/schema'
import { RequestsRepository } from './repository'

export async function importRequestsSample(database: DatabaseConnection, records: PennySample['requests'], now: string): Promise<void> {
  assertUnique(records.map((record) => record.id), 'sample request IDs')
  assertUnique(records.map((record) => record.slug), 'sample request slugs')
  for (const record of records) {
    assertUnique(record.evidenceIds, `evidence links for request ${record.id}`)
    assertUnique(record.tagIds, `tags for request ${record.id}`)
    assertUnique(record.voterIds, `voters for request ${record.id}`)
    assertUnique(record.followerIds, `followers for request ${record.id}`)
    assertUnique(record.comments.map((comment) => comment.id), `comments for request ${record.id}`)
    if (record.publicState === 'declined' && record.declinedReason === null) {
      throw new Error(`Declined request ${record.id} needs a public reason`)
    }
  }
  await new RequestsRepository(database).insertRequests(records, now)
}
