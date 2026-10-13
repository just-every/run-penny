import { and, eq, gt, isNull } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import type { DatabaseConnection } from '@/core/platform/database'
import { operators, operatorSessions } from '@/core/shared/schema'

export interface AuthenticatedOperatorRecord {
  readonly operatorId: string
  readonly email: string
  readonly displayName: string
  readonly sessionId: string
}

export interface NewOperatorRecord {
  readonly id: string
  readonly email: string
  readonly displayName: string
  readonly now: string
}

export interface NewOperatorSessionRecord {
  readonly id: string
  readonly operatorId: string
  readonly tokenHash: string
  readonly expiresAt: string
  readonly now: string
}

export class AuthRepository {
  private readonly connection: DatabaseConnection

  constructor(connection: DatabaseConnection) {
    this.connection = connection
  }

  async findActiveOperatorSession(tokenHash: string, now: string): Promise<AuthenticatedOperatorRecord | null> {
    const database = drizzle(this.connection.binding)
    const [session] = await database
      .select({
        operatorId: operators.id,
        email: operators.email,
        displayName: operators.displayName,
        sessionId: operatorSessions.id,
      })
      .from(operatorSessions)
      .innerJoin(operators, eq(operatorSessions.operatorId, operators.id))
      .where(and(
        eq(operatorSessions.tokenHash, tokenHash),
        isNull(operatorSessions.revokedAt),
        gt(operatorSessions.expiresAt, now),
      ))
      .limit(1)

    return session ?? null
  }

  async recordSessionUse(sessionId: string, now: string): Promise<void> {
    await drizzle(this.connection.binding)
      .update(operatorSessions)
      .set({ lastUsedAt: now, updatedAt: now })
      .where(eq(operatorSessions.id, sessionId))
  }

  async createOperator(record: NewOperatorRecord): Promise<void> {
    await drizzle(this.connection.binding).insert(operators).values({
      id: record.id,
      email: record.email,
      displayName: record.displayName,
      createdAt: record.now,
      updatedAt: record.now,
    })
  }

  async createSession(record: NewOperatorSessionRecord): Promise<void> {
    await drizzle(this.connection.binding).insert(operatorSessions).values({
      id: record.id,
      operatorId: record.operatorId,
      tokenHash: record.tokenHash,
      expiresAt: record.expiresAt,
      lastUsedAt: record.now,
      createdAt: record.now,
      updatedAt: record.now,
    })
  }
}
