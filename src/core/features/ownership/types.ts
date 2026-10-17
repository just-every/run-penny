export interface OwnershipOperator { id: string; displayName: string }
export interface ItemOwner extends OwnershipOperator { active: boolean }
export interface OwnershipCatalog {
 operators: OwnershipOperator[]
 boards: { id: string; slug: string; name: string; owner: ItemOwner | null }[]
}
export interface OwnedRequest { id: string; slug: string; title: string; boardName: string; moderationState: string }
export interface OwnedEvidence { id: string; wording: string; sourceType: string; sourceLabel: string | null }
export interface AwaitingComment { id: string; requestId: string; slug: string; title: string; body: string; moderationState: string; updatedAt: string }
export interface OwnershipQueue {
 requests: OwnedRequest[]
 evidence: OwnedEvidence[]
 comments: AwaitingComment[]
 totals: { requests: number; evidence: number; comments: number }
 page: number
 pageSize: number
}
export type OwnedEntity = 'requests' | 'evidence' | 'boards'
