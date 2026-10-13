import { validRoadmapUpdateDraft } from '@/core/features/roadmap/update-policy'
import type { WorkspaceOverviewDto } from './overview-dto'
import { currentModerationRequest } from '@/core/features/requests/moderation-claim'
import type {
  OperatorAccountCard,
  OperatorAccountDetail,
  OperatorDecisionBrief,
  OperatorDecisionListItem,
  OperatorEvidenceCard,
  OperatorReleaseCard,
  OperatorReleaseDetail,
  OperatorRequestCard,
  OperatorRoadmapCard,
} from '@/core/shared/api/operator'
import type { DatabaseConnection } from '@/core/platform/database'
import { AccountsReadRepository } from '@/core/features/accounts/read-repository'
import { DecisionsReadRepository } from '@/core/features/decisions/read-repository'
import { EvidenceReadRepository } from '@/core/features/evidence/read-repository'
import { ReleasesReadRepository } from '@/core/features/releases/read-repository'
import { RequestsReadRepository } from '@/core/features/requests/read-repository'
import { RoadmapReadRepository } from '@/core/features/roadmap/read-repository'

export class WorkspaceReadService {
  private readonly database: DatabaseConnection
  private readonly accounts: AccountsReadRepository
  private readonly decisions: DecisionsReadRepository
  private readonly evidence: EvidenceReadRepository
  private readonly releases: ReleasesReadRepository
  private readonly requests: RequestsReadRepository
  private readonly roadmap: RoadmapReadRepository

  constructor(database: DatabaseConnection) {
    this.database = database
    this.accounts = new AccountsReadRepository(database)
    this.decisions = new DecisionsReadRepository(database)
    this.evidence = new EvidenceReadRepository(database)
    this.releases = new ReleasesReadRepository(database)
    this.requests = new RequestsReadRepository(database)
    this.roadmap = new RoadmapReadRepository(database)
  }

  async getOverview(): Promise<WorkspaceOverviewDto> {
    const [decisionRows, evidenceRows, roadmapRows, releaseRows, boards, moderation, updates, released] = await Promise.all([
      this.decisions.list(), this.evidence.list('unreviewed'), this.roadmap.list(), this.releases.list(),
      this.database.binding.prepare('SELECT COUNT(*) AS count FROM boards WHERE archived_at IS NULL').first<{count:number}>(),
      this.database.binding.prepare(`SELECT r.id, r.slug, r.title FROM requests r
        WHERE r.moderation_state='awaiting_review' AND ${currentModerationRequest('r')}
        ORDER BY r.created_at ASC, r.id ASC`).all<WorkspaceOverviewDto['awaitingModeration'][number]>(),
      this.database.binding.prepare(`SELECT v.id, v.title, i.slug AS roadmapSlug, v.version_number AS versionNumber
        FROM roadmap_update_versions v JOIN roadmap_items i ON i.id=v.roadmap_item_id
        JOIN roadmap_publications p ON p.roadmap_item_id=i.id
        WHERE v.published_at IS NULL AND v.discarded_at IS NULL AND ${validRoadmapUpdateDraft}
        ORDER BY v.created_at ASC, v.id ASC`).all<WorkspaceOverviewDto['unpublishedStatusUpdates'][number]>(),
      this.database.binding.prepare(`SELECT DISTINCT t.roadmap_item_id AS id FROM release_targets t
        JOIN releases r ON r.id=t.release_id WHERE r.state='published' AND r.published_at IS NOT NULL`).all<{id:string}>(),
    ])
    return {
      boardCount: Number(boards?.count ?? 0),
      awaitingModeration: moderation.results,
      unpublishedStatusUpdates: updates.results,
      shippedWithoutRelease: roadmapRows.filter(item => item.status === 'shipped' && !released.results.some(target => target.id === item.id)),
      decisions: decisionRows.filter((decision) => decision.state === 'ready' || decision.state === 'review_due'),
      unreviewedEvidence: evidenceRows,
      roadmap: roadmapRows.filter((item) => item.status === 'planned' || item.status === 'in_progress'),
      recentReleases: releaseRows.filter((release) => release.state === 'published' && release.publishedAt !== null && release.publishedAt >= thirtyDaysAgo()),
    }
  }

  listEvidence(): Promise<readonly OperatorEvidenceCard[]> {
    return this.evidence.list()
  }

  listRequests(): Promise<readonly OperatorRequestCard[]> {
    return this.requests.list()
  }

  listDecisions(): Promise<readonly OperatorDecisionListItem[]> {
    return this.decisions.list()
  }

  findDecision(slug: string): Promise<OperatorDecisionBrief | null> {
    return this.decisions.find(slug)
  }

  listRoadmap(): Promise<readonly OperatorRoadmapCard[]> {
    return this.roadmap.list()
  }

  listReleases(): Promise<readonly OperatorReleaseCard[]> {
    return this.releases.list()
  }

  findRelease(slug: string): Promise<OperatorReleaseDetail | null> {
    return this.releases.find(slug)
  }

  listAccounts(): Promise<readonly OperatorAccountCard[]> {
    return this.accounts.list()
  }

  findAccount(slug: string): Promise<OperatorAccountDetail | null> {
    return this.accounts.find(slug)
  }
}

function thirtyDaysAgo(): string {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
}

export function workspaceReadService(database: DatabaseConnection): WorkspaceReadService {
  return new WorkspaceReadService(database)
}
