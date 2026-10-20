import type { LoopHealth } from './loop-health-types'
import type { OperatorOverview, OperatorRoadmapCard } from '@/core/shared/api/operator'

/** Attention supplements the existing planning context; it never changes its records. */
export interface WorkspaceOverviewDto extends OperatorOverview {
  readonly loopHealth: LoopHealth
  readonly pagination: {page:number;pageSize:number;total:number}
  readonly counts: {decisions:number;readyDecisions:number;reviewDueDecisions:number;evidence:number;roadmap:number;releases:number;shipped:number;moderation:number;comments:number;updates:number}
  readonly boardCount: number
  readonly awaitingModeration: readonly { readonly id: string; readonly slug: string; readonly title: string }[]
  readonly unpublishedStatusUpdates: readonly { readonly id: string; readonly title: string; readonly roadmapSlug: string; readonly versionNumber: number }[]
  readonly shippedWithoutRelease: readonly OperatorRoadmapCard[]
}
