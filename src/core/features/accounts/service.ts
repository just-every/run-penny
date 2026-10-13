import type { DatabaseConnection } from '../../platform/database'
import { assertUnique } from '../../shared/ids'
import type { PennySample } from '../sample-data/schema'
import { AccountsRepository } from './repository'

export async function importAccountsSample(database: DatabaseConnection, sample: Pick<PennySample, 'operators' | 'accounts' | 'requesters'>, now: string): Promise<void> {
  assertUnique(sample.operators.map((operator) => operator.id), 'sample operator IDs')
  assertUnique(sample.operators.map((operator) => operator.email.toLowerCase()), 'sample operator emails')
  assertUnique(sample.accounts.map((account) => account.id), 'sample account IDs')
  assertUnique(sample.accounts.map((account) => account.slug), 'sample account slugs')
  assertUnique(sample.requesters.map((requester) => requester.id), 'sample requester IDs')
  assertUnique(sample.requesters.map((requester) => requester.addressId), 'sample requester address IDs')
  assertUnique(sample.requesters.map((requester) => requester.email.toLowerCase()), 'sample requester emails')

  const repository = new AccountsRepository(database)
  await repository.insertOperators(sample.operators, now)
  await repository.insertAccounts(sample.accounts, now)
  await repository.insertRequesters(sample.requesters, now)
}
