import type { DatabaseConnection } from '../../platform/database'
import { assertUnique } from '../../shared/ids'
import type { PennySample } from '../sample-data/schema'
import { RoadmapRepository } from './repository'

export async function importRoadmapSample(
  database: DatabaseConnection,
  records: PennySample['roadmapItems'],
  publications: PennySample['roadmapPublications'],
  mappings: PennySample['roadmapRequestMappings'],
  now: string,
): Promise<void> {
  assertUnique(records.map((record) => record.id), 'sample roadmap item IDs')
  assertUnique(records.map((record) => record.slug), 'sample roadmap item slugs')
  assertUnique(records.map((record) => record.transition.id), 'sample roadmap transition IDs')
  assertUnique(publications.map((record) => record.id), 'sample roadmap publication IDs')
  assertUnique(publications.map((record) => record.roadmapItemId), 'sample roadmap publication item IDs')
  assertUnique(mappings.map((record) => record.requestId), 'sample roadmap mapping request IDs')
  assertUnique(mappings.map((record) => `${record.roadmapItemId}:${record.requestId}`), 'sample roadmap mappings')

  const repository = new RoadmapRepository(database)
  await repository.insertRoadmapItems(records, now)
  await repository.insertPublicProjections(publications, mappings, now)
}
