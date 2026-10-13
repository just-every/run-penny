export type OperatorDecisionState = 'draft' | 'ready' | 'committed' | 'review_due'
export type OperatorRoadmapStatus = 'exploring' | 'planned' | 'in_progress' | 'shipped' | 'dropped'

export interface OperatorReference {
  readonly id: string
  readonly displayName: string
}

export interface OperatorAccountReference {
  readonly id: string
  readonly slug: string
  readonly name: string
}

export interface OperatorEvidenceCard {
  readonly id: string
  readonly namedSpeaker?: string | null
  readonly wording: string
  readonly sourceType: string
  readonly sourceLabel: string | null
  readonly observedAt: string
  readonly reviewState: 'unreviewed' | 'reviewed'
  readonly reviewReason: string | null
  readonly account: OperatorAccountReference | null
  readonly requester: {
    readonly id: string
    readonly displayName: string
    readonly email: string | null
  } | null
  readonly tags: readonly string[]
}

export interface OperatorRequestCard {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly description: string
  readonly moderationState: 'awaiting_review' | 'approved' | 'rejected'
  readonly publicState: 'unpublished' | 'open' | 'under_review' | 'planned' | 'in_progress' | 'shipped' | 'declined' | 'withdrawn'
  readonly board: { readonly slug: string; readonly name: string; readonly visibility: 'public' | 'internal' }
  readonly author: { readonly id: string; readonly displayName: string; readonly email: string | null } | null
  readonly voteCount: number
  readonly evidenceCount: number
}

export interface OperatorDecisionListItem {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly state: OperatorDecisionState
  readonly owner: OperatorReference | null
  readonly lastAction?: string | null
  readonly lastActionAt?: string | null
  readonly reviewAt: string | null
  readonly evidenceCount: number
  readonly accountCount: number
}

export interface OperatorRoadmapCard {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly summary: string
  readonly status: OperatorRoadmapStatus
  readonly targetWindow: string | null
  readonly deliveryNotes: string | null
  readonly confidence: 'low' | 'medium' | 'high' | null
  readonly owner: OperatorReference | null
  readonly decision: Pick<OperatorDecisionListItem, 'slug' | 'title' | 'state'> | null
  readonly decisionDisposition?: 'selected'|'declined'|null
  readonly evidenceCount: number
  readonly publicStatus: 'under_review' | 'planned' | 'in_progress' | 'shipped' | null
}

export interface OperatorReleaseCard {
  readonly id: string
  readonly slug: string
  readonly state: 'draft' | 'published'
  readonly title: string
  readonly releaseType: 'new' | 'improved' | 'fixed'
  readonly publicationDate: string | null
  readonly publishedAt: string | null
  readonly author: OperatorReference
  readonly tagNames: readonly string[]
  readonly recipientSnapshotCount: number | null
  readonly outcomeTotal: number | null
}

export interface OperatorReleaseDetail extends OperatorReleaseCard {
  readonly tagIds: readonly string[]
  readonly targetIds: readonly string[]
  readonly deliveryCounts: import('@/core/features/releases/counts').DeliveryCounts
  readonly body: string
  readonly setupUrl: string | null
  readonly outcomePrompt: string
  readonly targets: readonly {
    readonly roadmapSlug: string
    readonly roadmapTitle: string
    readonly roadmapStatus: OperatorRoadmapStatus
    readonly decisionSlug: string
    readonly decisionTitle: string
  }[]
}

export interface OperatorAccountCard extends OperatorAccountReference {
  readonly revenueCents: number | null
  readonly renewalDate: string | null
  readonly health: string | null
  readonly owner: OperatorReference | null
  readonly requesterCount: number
  readonly evidenceCount: number
}

export interface OperatorAccountDetail extends OperatorAccountCard {
  readonly linkedRequestCount: number
  readonly linkedDecisionCount: number
  readonly requests: readonly { readonly id: string; readonly slug: string; readonly title: string }[]
  readonly requesters: readonly { readonly id: string; readonly displayName: string; readonly email: string | null }[]
  readonly evidence: readonly OperatorEvidenceCard[]
  readonly decisions: readonly Pick<OperatorDecisionListItem, 'slug' | 'title' | 'state'>[]
}

export interface OperatorDecisionBrief extends OperatorDecisionListItem {
  readonly question: string
  readonly confidence: 'low' | 'medium' | 'high' | null
  readonly rationale: string | null
  readonly selectedCandidateBetId: string | null
  readonly bets: readonly {
    readonly id: string
    readonly title: string
    readonly summary: string
    readonly urgency: string | null
    readonly deliveryShape: string | null
    readonly successMeasure: string | null
    readonly assumptions: string | null
    readonly counterEvidence: string | null
    readonly accounts: readonly (OperatorAccountReference & { readonly revenueCents: number | null; readonly health: string | null })[]
    readonly evidence: readonly (OperatorEvidenceCard & { readonly stance: 'supporting' | 'contradicting' })[]
    readonly metrics: { readonly supportingCount: number; readonly contradictingCount: number; readonly affectedAccountCount: number; readonly affectedRequesterCount?: number; readonly latestSupportAt?: string | null }
  }[]
  readonly roadmapItem: Pick<OperatorRoadmapCard, 'slug' | 'title' | 'status'> | null
}

export interface OperatorOverview {
  readonly decisions: readonly OperatorDecisionListItem[]
  readonly unreviewedEvidence: readonly OperatorEvidenceCard[]
  readonly roadmap: readonly OperatorRoadmapCard[]
  readonly recentReleases: readonly OperatorReleaseCard[]
}
