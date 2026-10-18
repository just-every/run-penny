export type PublicRequestStatus = 'open' | 'under_review' | 'planned' | 'in_progress' | 'shipped' | 'declined'

export interface PublicCategory {readonly id:string;readonly name:string;readonly parentId:string|null;readonly position:number;readonly archived:boolean;readonly requestCount:number}
export interface PublicCategoryReference {readonly id:string;readonly name:string;readonly parent:{readonly id:string;readonly name:string}|null}
export interface SubscriptionDisclosure { readonly enabled:boolean; readonly version:number; readonly vote:string|null; readonly submission:string|null }

export interface PublicBoard {
  readonly importanceChoices?:readonly string[]
  readonly subscriptionDisclosure?:SubscriptionDisclosure
  readonly slug: string
  readonly name: string
  readonly requestCount: number
  readonly categoryMode:'off'|'optional'|'required'
  readonly postingPolicy:'requesters'|'operators'
  readonly commentsAllowed:boolean
  readonly showVoteCounts:boolean
  readonly showVoters:boolean
  readonly anonymousRequesters:boolean
  readonly categories:readonly PublicCategory[]
}

export interface PublicRequestCard {
  readonly slug: string
  readonly board: Pick<PublicBoard, 'slug' | 'name'>
  readonly title: string
  readonly description: string
  readonly publicEta?:string|null
  readonly statusLabel?:string|null
  readonly status: PublicRequestStatus
  readonly category:PublicCategoryReference|null
  readonly voteCount?: number
  readonly commentCount: number
  readonly publishedAt: string
  readonly recentActivityAt: string
}

export interface PublicRequestComment {
  readonly id: string
  readonly author: {
    readonly displayName: string
    readonly kind: 'requester' | 'operator'
  }
  readonly body: string
  readonly publishedAt: string
}

export interface PublicRequestDetail extends PublicRequestCard {
  readonly authorDisplayName: string | null
  readonly commentsAllowed:boolean
  readonly showVoters:boolean
  readonly voters?:readonly {readonly displayName:string}[]
  readonly comments: readonly PublicRequestComment[]
  readonly statusUpdates: readonly {id:string;status:PublicRequestStatus|'withdrawn';body:string;pinned:number;publishedAt:string}[]
  readonly attachments: readonly {id:string;filename:string;contentType:string}[]
}

export interface PublicRoadmapItem {
  readonly category?:PublicCategoryReference|null
  readonly source?:'requests'
  readonly voteCount?:number
  readonly publicEta?:string|null
  readonly statusLabel?:string|null
  readonly board?: {readonly slug:string;readonly name:string}
  readonly slug: string
  readonly title: string
  readonly summary: string
  readonly status: Exclude<PublicRequestStatus, 'open' | 'declined'>
  readonly requests: readonly {
    readonly slug: string
    readonly title: string
  }[]
}

export interface PublicRelease {
  readonly authorName: string
  readonly slug: string
  readonly title: string
  readonly releaseType: 'new' | 'improved' | 'fixed'
  readonly body: string
  readonly publicationDate: string
  readonly setupUrl: string | null
}
