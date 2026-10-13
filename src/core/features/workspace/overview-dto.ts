import type { OperatorOverview, OperatorRoadmapCard } from '@/core/shared/api/operator'

/** Attention supplements the existing planning context; it never changes its records. */
export interface WorkspaceOverviewDto extends OperatorOverview {
  readonly boardCount: number
  readonly awaitingModeration: readonly { readonly id: string; readonly slug: string; readonly title: string }[]
  readonly unpublishedStatusUpdates: readonly { readonly id: string; readonly title: string; readonly roadmapSlug: string; readonly versionNumber: number }[]
  readonly shippedWithoutRelease: readonly OperatorRoadmapCard[]
}
