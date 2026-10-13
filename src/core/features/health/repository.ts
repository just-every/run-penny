import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import type { DatabaseConnection } from '@/core/platform/database'

export class HealthRepository {
  private readonly connection: DatabaseConnection

  constructor(connection: DatabaseConnection) {
    this.connection = connection
  }

  async verifyDatabaseConnection(): Promise<void> {
    await drizzle(this.connection.binding).run(sql`select 1`)
  }
}
