import type { DatabaseConnection } from '../../platform/database'
import { assertUnique } from '../../shared/ids'
import type { PennySample } from '../sample-data/schema'
import { ReleasesRepository } from './repository'

export async function importReleasesSample(database: DatabaseConnection, records: PennySample['releases'], roadmapItems: PennySample['roadmapItems'], now: string): Promise<void> {
  assertUnique(records.map((record) => record.id), 'sample release IDs')
  assertUnique(records.map((record) => record.slug), 'sample release slugs')
  assertUnique(records.map((record) => record.version.id), 'sample release version IDs')
  const decisionByRoadmapItemId = new Map<string, string>()
  for (const item of roadmapItems) {
    if (item.decisionId !== null) decisionByRoadmapItemId.set(item.id, item.decisionId)
  }
  for (const release of records) {
    assertUnique(release.targetRoadmapItemIds, `targets for release ${release.id}`)
    for (const roadmapItemId of release.targetRoadmapItemIds) {
      const decisionId = decisionByRoadmapItemId.get(roadmapItemId)
      if (decisionId === undefined) {
        throw new Error(`Release ${release.id} targets a roadmap item without a linked decision`)
      }
    }
  }
  await new ReleasesRepository(database).insertReleases(records, decisionByRoadmapItemId, now)
}
