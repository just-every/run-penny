import type {ReleaseFilters} from '../releases/rich-repository'
import type { PublicRelease, PublicRequestDetail } from '@/core/shared/api/public'
import type { DatabaseConnection } from '@/core/platform/database'
import { PublicReleasesReadRepository } from '@/core/features/releases/public-read-repository'
import { PublicRequestsReadRepository, type PublicRequestFilters } from '@/core/features/requests/public-read-repository'
import { PublicRoadmapReadRepository } from '@/core/features/roadmap/public-read-repository'

export type PublicRequestLookup =
  | { readonly kind: 'found'; readonly request: PublicRequestDetail }
  | { readonly kind: 'redirect'; readonly slug: string }
  | { readonly kind: 'withdrawn' }
  | { readonly kind: 'not_found' }

export class PortalReadService {
  private readonly releases: PublicReleasesReadRepository
  private readonly requests: PublicRequestsReadRepository
  private readonly roadmap: PublicRoadmapReadRepository

  constructor(database: DatabaseConnection) {
    this.releases = new PublicReleasesReadRepository(database)
    this.requests = new PublicRequestsReadRepository(database)
    this.roadmap = new PublicRoadmapReadRepository(database)
  }

  listBoards() {
    return this.requests.listBoards()
  }

  listRequests(filters: PublicRequestFilters) {
    return this.requests.list(filters)
  }

  async getRequest(slug: string): Promise<PublicRequestLookup> {
    const canonical = await this.requests.canonical(slug)
    if(canonical)return {kind:'redirect',slug:canonical}
    const request = await this.requests.find(slug)
    if (request) return { kind: 'found', request }
    return await this.requests.isWithdrawn(slug) ? { kind: 'withdrawn' } : { kind: 'not_found' }
  }

  listRoadmap() {
    return this.roadmap.list()
  }

  listReleases(filters:ReleaseFilters={}) {
    return this.releases.list(filters)
  }

  async getRelease(slug: string): Promise<PublicRelease | null> {
    return this.releases.find(slug)
  }
}

export function portalReadService(database: DatabaseConnection): PortalReadService {
  return new PortalReadService(database)
}
