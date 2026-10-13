import { HydrationUnit } from '@/base/hydration/unit'
import { Link, useParams } from '@tanstack/react-router'
import type { PublicRoadmapItem } from '@/core/shared/api/public'
import { PortalBackLink } from '@/core/features/portal/ui/portal-back-link'
import { PageTitle } from '@/core/ui/app/PageTitle'
import { PublicPortalLayout, type PublicPortalContent } from '@/core/features/portal/ui/public-portal-layout'
import { PublicCard, PublicStatus, ResourceFailure, ResourceLoading } from '@/core/features/portal/ui/public-primitives'
import { usePublicResource } from '@/core/features/portal/ui/public-resource'
import { dataLabelClass, textLinkClass } from '@/core/features/portal/ui/portal-classes'

export function PublicRoadmapDetail({ content }: { content: PublicPortalContent }) {
  const { roadmapSlug } = useParams({ from: '/portal/roadmap/$roadmapSlug' })
  const [resource, retry] = usePublicResource<PublicRoadmapItem>(`/api/public/roadmap/${encodeURIComponent(roadmapSlug)}`)
  return (
    <PublicPortalLayout content={content}>
      <div className="mx-auto max-w-3xl">
        <PortalBackLink to="/portal/roadmap">All roadmap items</PortalBackLink>
        {resource.kind === 'loading' ? <div className="mt-5"><ResourceLoading label="Loading roadmap item…" /></div> : resource.kind === 'ready' ? (
          <HydrationUnit><article className="mt-3">
            <PublicStatus status={resource.data.status} />
            <PageTitle id="roadmap-detail-heading" className="mt-4">{resource.data.title}</PageTitle>
            <PublicCard className="mt-6 p-5 sm:p-7">
              <p className="whitespace-pre-wrap break-words text-base leading-7 text-penny-ink">{resource.data.summary}</p>
              {resource.data.board ? <p className="mt-5 text-sm text-penny-muted"><span className={dataLabelClass}>Board</span> <span className="ml-2 font-semibold text-penny-ink">{resource.data.board.name}</span></p> : null}
              {resource.data.requests.length > 0 ? (
                <ul className="mt-5 divide-y divide-penny-line border-t border-penny-line">
                  {resource.data.requests.map((request) => <li key={request.slug}><Link className={`${textLinkClass} inline-flex min-h-11 items-center`} to="/portal/feedback/$requestSlug" params={{ requestSlug: request.slug }}>{request.title}</Link></li>)}
                </ul>
              ) : null}
            </PublicCard>
          </article></HydrationUnit>
        ) : <div className="mt-5"><ResourceFailure status={resource.kind === 'error' ? resource.status : 404} onRetry={retry} /></div>}
      </div>
    </PublicPortalLayout>
  )
}
