export type PublicRequestStatus = 'open' | 'under_review' | 'planned' | 'in_progress' | 'shipped' | 'declined'

export interface PublicBoard {
  readonly slug: string
  readonly name: string
  readonly requestCount: number
}

export interface PublicRequestCard {
  readonly slug: string
  readonly board: Pick<PublicBoard, 'slug' | 'name'>
  readonly title: string
  readonly description: string
  readonly status: PublicRequestStatus
  readonly voteCount: number
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
  readonly comments: readonly PublicRequestComment[]
  readonly statusUpdates: readonly {id:string;status:PublicRequestStatus|'withdrawn';body:string;pinned:number;publishedAt:string}[]
  readonly attachments: readonly {id:string;filename:string;contentType:string}[]
}

export interface PublicRoadmapItem {
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
  readonly tagNames: readonly string[]
  readonly slug: string
  readonly title: string
  readonly releaseType: 'new' | 'improved' | 'fixed'
  readonly body: string
  readonly publicationDate: string
  readonly setupUrl: string | null
}
