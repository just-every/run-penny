import { HydrationUnit } from '@/base/hydration/unit'
import { Link } from '@tanstack/react-router'
import type { PublicRoadmapItem, PublicRequestStatus } from '@/core/shared/api/public'
import type { PublicPortalContent } from '@/core/features/portal/ui/public-portal-layout'
import { PublicPortalLayout } from '@/core/features/portal/ui/public-portal-layout'
import { PortalIcon, PublicCard, PublicEmpty, PublicStatus, ResourceFailure, ResourceLoading } from '@/core/features/portal/ui/public-primitives'
import { PageTitle } from '@/core/ui/app/PageTitle'
import { usePublicResource } from '@/core/features/portal/ui/public-resource'
import { dataLabelClass, ledeClass, textLinkClass } from '@/core/features/portal/ui/portal-classes'

const roadmapStatuses: readonly Exclude<PublicRequestStatus, 'open' | 'declined'>[] = ['under_review', 'planned', 'in_progress', 'shipped']

export function PublicRoadmapPage({ content }: { readonly content: PublicPortalContent }) {
  const [roadmap, retry] = usePublicResource<readonly PublicRoadmapItem[]>('/api/public/roadmap')

  return (
    <PublicPortalLayout content={content}>
      <HydrationUnit><section aria-labelledby="roadmap-heading">
        <header className="min-w-0"><PageTitle id="roadmap-heading" eyebrow="Roadmap">What we're working toward</PageTitle><p className={ledeClass}>Only approved customer-safe roadmap items are shown here. Delivery dates are not published.</p></header>
        <div className="mt-8">
          {roadmap.kind === 'loading' ? <ResourceLoading label="Loading the public roadmap…" /> : null}
          {roadmap.kind === 'error' ? <ResourceFailure status={roadmap.status} onRetry={retry} /> : null}
          {roadmap.kind === 'ready' && roadmap.data.length === 0 ? <PublicEmpty title="No roadmap items are published">Approved roadmap items will appear here.</PublicEmpty> : null}
          {roadmap.kind === 'ready' && roadmap.data.length > 0 ? <RoadmapBoard items={roadmap.data} /> : null}
        </div>
      </section></HydrationUnit>
    </PublicPortalLayout>
  )
}

function RoadmapBoard({ items }: { readonly items: readonly PublicRoadmapItem[] }) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {roadmapStatuses.map((status) => {
        const statusItems = items.filter((item) => item.status === status)
        return <HydrationUnit><section key={status} className="min-w-0" aria-label={`Roadmap status ${status.replace('_', ' ')}`}>
          <div className="mb-3 flex items-center gap-2"><PublicStatus status={status} /><span className="text-xs font-semibold tabular-nums text-penny-muted">{statusItems.length}</span></div>
          <div className="space-y-3">
            {statusItems.length === 0 ? <div className="rounded-xl border border-dashed border-penny-line-strong/60 px-4 py-5 text-sm leading-6 text-penny-muted">No items in this status.</div> : null}
            {statusItems.map((item) => <RoadmapItemCard key={item.slug} item={item} />)}
          </div>
        </section></HydrationUnit>
      })}
    </div>
  )
}

function RoadmapItemCard({ item }: { readonly item: PublicRoadmapItem }) {
  return (
    <PublicCard className="p-4">
      <h2 className="break-words text-base font-bold tracking-[-0.015em] text-penny-ink"><Link to="/portal/roadmap/$roadmapSlug" params={{roadmapSlug:item.slug}} className="inline-flex hover:underline hover:decoration-penny-copper hover:underline-offset-4 min-h-11 min-w-0 max-w-full items-center [overflow-wrap:anywhere]">{item.title}</Link></h2>
      <p className="mt-2 break-words text-sm leading-6 text-penny-muted">{item.summary}</p>
      {item.requests.length > 0 ? <div className="mt-4 border-t border-penny-line pt-3"><p className={dataLabelClass}>Related feedback</p><ul className="mt-2 space-y-1">{item.requests.map((request) => <li key={request.slug} className="min-w-0"><Link to="/portal/feedback/$requestSlug" params={{ requestSlug: request.slug }} className={`${textLinkClass} flex min-h-11 w-full min-w-0 max-w-full items-center gap-1 text-sm font-medium`}><span className="min-w-0 break-all">{request.title}</span><PortalIcon name="arrow" className="size-3.5 shrink-0" /></Link></li>)}</ul></div> : null}
    </PublicCard>
  )
}
