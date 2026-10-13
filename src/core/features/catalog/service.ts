import type { DatabaseConnection } from '../../platform/database'
import { assertUnique } from '../../shared/ids'
import type { PennySample } from '../sample-data/schema'
import { CatalogRepository } from './repository'

export async function importCatalogSample(database: DatabaseConnection, sample: Pick<PennySample, 'boards' | 'tags'>, now: string): Promise<void> {
  assertUnique(sample.boards.map((board) => board.id), 'sample board IDs')
  assertUnique(sample.boards.map((board) => board.slug), 'sample board slugs')
  assertUnique(sample.boards.map((board) => String(board.position)), 'sample board positions')
  assertUnique(sample.tags.map((tag) => tag.id), 'sample tag IDs')
  assertUnique(sample.tags.map((tag) => tag.name.toLowerCase()), 'sample tag names')

  const repository = new CatalogRepository(database)
  await repository.insertBoards(sample.boards, now)
  await repository.insertTags(sample.tags, now)
}
