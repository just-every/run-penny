import { drizzle } from 'drizzle-orm/d1'
import type { DatabaseConnection } from '../../platform/database'
import { accounts, operators, requesterAccountLinks, requesterAddresses, requesters } from '../../shared/schema'
import type { PennySample } from '../sample-data/schema'

type Operator = PennySample['operators'][number]
type Account = PennySample['accounts'][number]
type Requester = PennySample['requesters'][number]

export class AccountsRepository {
  private readonly database

  constructor(connection: DatabaseConnection) {
    this.database = drizzle(connection.binding)
  }

  async insertOperators(records: Operator[], now: string): Promise<void> {
    if (records.length === 0) return
    await this.database.insert(operators).values(records.map((record) => ({ ...record, email: record.email.toLowerCase(), createdAt: now, updatedAt: now }))).onConflictDoNothing().run()
  }

  async insertAccounts(records: Account[], now: string): Promise<void> {
    if (records.length === 0) return
    await this.database.insert(accounts).values(records.map((record) => ({ ...record, createdAt: now, updatedAt: now }))).onConflictDoNothing().run()
  }

  async insertRequesters(records: Requester[], now: string): Promise<void> {
    if (records.length === 0) return
    await this.database.insert(requesters).values(records.map((record) => ({ id: record.id, displayName: record.displayName, blockedAt: null, createdAt: now, updatedAt: now }))).onConflictDoNothing().run()
    await this.database.insert(requesterAddresses).values(records.map((record) => ({ id: record.addressId, requesterId: record.id, email: record.email.toLowerCase(), verifiedAt: now, suppressedAt: null, createdAt: now, updatedAt: now }))).onConflictDoNothing().run()
    await this.database.insert(requesterAccountLinks).values(records.map((record) => ({ requesterId: record.id, accountId: record.accountId, createdAt: now }))).onConflictDoNothing().run()
  }
}
