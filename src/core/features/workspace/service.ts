import { overviewRead } from './overview-read'
import type { ListQuery } from './list-query'
import type { WorkspaceOverviewDto } from './overview-dto'
import type {
  OperatorAccountDetail,
  OperatorDecisionBrief,
  OperatorReleaseDetail,
} from '@/core/shared/api/operator'
import type { DatabaseConnection } from '@/core/platform/database'
import { AccountsReadRepository } from '@/core/features/accounts/read-repository'
import { DecisionsReadRepository } from '@/core/features/decisions/read-repository'
import { ReleasesReadRepository } from '@/core/features/releases/read-repository'

export class WorkspaceReadService {
  private readonly database: DatabaseConnection
  private readonly accounts: AccountsReadRepository
  private readonly decisions: DecisionsReadRepository
  private readonly releases: ReleasesReadRepository

  constructor(database: DatabaseConnection) {
    this.database = database
    this.accounts = new AccountsReadRepository(database)
    this.decisions = new DecisionsReadRepository(database)
    this.releases = new ReleasesReadRepository(database)
  }

  getOverview(query: ListQuery, today: string): Promise<WorkspaceOverviewDto> { return overviewRead(this.database,query,today) }

  findDecision(slug: string): Promise<OperatorDecisionBrief | null> {
    return this.decisions.find(slug)
  }

  findRelease(slug: string): Promise<OperatorReleaseDetail | null> {
    return this.releases.find(slug)
  }

  findAccount(slug: string): Promise<OperatorAccountDetail | null> {
    return this.accounts.find(slug)
  }
}

export function workspaceReadService(database: DatabaseConnection): WorkspaceReadService {
  return new WorkspaceReadService(database)
}
