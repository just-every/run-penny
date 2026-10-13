import { drizzle } from 'drizzle-orm/d1'
import type { DatabaseConnection } from '../../platform/database'
import { boards, tags } from '../../shared/schema'
import type { PennySample } from '../sample-data/schema'

export class CatalogRepository {
  private readonly database

  constructor(connection: DatabaseConnection) {
    this.database = drizzle(connection.binding)
  }

  async insertBoards(records: PennySample['boards'], now: string): Promise<void> {
    if (records.length === 0) return
    await this.database.insert(boards).values(records.map((record) => ({ ...record, archivedAt: null, createdAt: now, updatedAt: now }))).onConflictDoNothing().run()
  }

  async insertTags(records: PennySample['tags'], now: string): Promise<void> {
    if (records.length === 0) return
    await this.database.insert(tags).values(records.map((record) => ({ ...record, createdAt: now, updatedAt: now }))).onConflictDoNothing().run()
  }
}
