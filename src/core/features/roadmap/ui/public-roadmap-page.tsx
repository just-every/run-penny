import { HydrationUnit } from '@/base/hydration/unit'
import { useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import type { PublicRoadmapItem } from '@/core/shared/api/public'
import type { PublicPortalContent } from '@/core/features/portal/ui/public-portal-layout'
import { PublicPortalLayout } from '@/core/features/portal/ui/public-portal-layout'
import { PortalIcon, PublicCard, PublicEmpty, PublicStatus, ResourceFailure, ResourceLoading } from '@/core/features/portal/ui/public-primitives'
import { PageTitle } from '@/core/ui/app/PageTitle'
import { usePublicResource } from '@/core/features/portal/ui/public-resource'
import { dataLabelClass, ledeClass, textLinkClass } from '@/core/features/portal/ui/portal-classes'
import type { PublicRoadmapSettings } from '../status-roadmap-settings'

export function PublicRoadmapPage({ content }: { readonly content: PublicPortalContent }) {
  const [roadmap, retry] = usePublicResource<readonly PublicRoadmapItem[]>('/api/public/roadmap')
  const [settings, retrySettings] = usePublicResource<PublicRoadmapSettings>('/api/public/roadmap/settings')
  useEffect(() => {
    if (roadmap.kind === 'loading') return
    const timer = window.setTimeout(retry, 4000)
    return () => window.clearTimeout(timer)
  }, [roadmap, retry])
  useEffect(() => {
    if (settings.kind === 'loading') return
    const timer = window.setTimeout(retrySettings, 4000)
    return () => window.clearTimeout(timer)
  }, [settings, retrySettings])

  return (
    <PublicPortalLayout content={content}>
      <HydrationUnit><section aria-labelledby="roadmap-heading">
        <header className="min-w-0"><PageTitle id="roadmap-heading" eyebrow="Roadmap">What we're working toward</PageTitle><p className={ledeClass}>{settings.kind === 'ready' && settings.data.source === 'request_statuses' ? 'Follow the progress of published feedback. Any ETA shown is a month or quarter.' : 'Only approved customer-safe roadmap items are shown here. Delivery dates are not published.'}</p></header>
        <div className="mt-8">
          {roadmap.kind === 'loading' || settings.kind === 'loading' ? <ResourceLoading label="Loading the public roadmap…" /> : null}
          {roadmap.kind === 'error' ? <ResourceFailure status={roadmap.status} onRetry={retry} /> : null}
          {settings.kind === 'error' ? <ResourceFailure status={settings.status} onRetry={retrySettings} /> : null}
          {roadmap.kind === 'ready' && settings.kind === 'ready' && roadmap.data.length === 0 ? <PublicEmpty title="No roadmap items are published">{settings.data.source === 'request_statuses' ? 'Published feedback in the visible roadmap statuses will appear here.' : 'Approved roadmap items will appear here.'}</PublicEmpty> : null}
          {roadmap.kind === 'ready' && settings.kind === 'ready' && roadmap.data.length > 0 ? <RoadmapBoard items={roadmap.data} settings={settings.data} /> : null}
        </div>
      </section></HydrationUnit>
    </PublicPortalLayout>
  )
}

function RoadmapBoard({ items, settings }: { readonly items: readonly PublicRoadmapItem[]; readonly settings: PublicRoadmapSettings }) {
  const columns = settings.columns
  const gridClass = columns.length === 1 ? 'grid-cols-1' : columns.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : columns.length === 3 ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'
  return (
    <div className={`grid min-w-0 gap-4 ${gridClass}`}>
      {columns.map(({ status, label }) => {
        const statusItems = items.filter((item) => item.status === status)
        return <HydrationUnit key={status}><section className="min-w-0" aria-label={`Roadmap status ${label}`}>
          <div className="mb-3 flex min-h-8 items-center gap-2"><h2 className="min-w-0 break-words text-sm font-bold text-penny-ink">{settings.source === 'approved_items' ? <PublicStatus status={status} /> : label}</h2><span className="text-xs font-semibold tabular-nums text-penny-muted">{statusItems.length}</span></div>
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
      <h3 className="break-words text-base font-bold tracking-[-0.015em] text-penny-ink">{item.source === 'requests' ? <Link to="/portal/feedback/$requestSlug" params={{requestSlug:item.slug}} className="inline-flex min-h-11 min-w-0 max-w-full items-center [overflow-wrap:anywhere] hover:underline hover:decoration-penny-copper hover:underline-offset-4">{item.title}</Link> : <Link to="/portal/roadmap/$roadmapSlug" params={{roadmapSlug:item.slug}} className="inline-flex hover:underline hover:decoration-penny-copper hover:underline-offset-4 min-h-11 min-w-0 max-w-full items-center [overflow-wrap:anywhere]">{item.title}</Link>}</h3>
      <p className="mt-2 break-words text-sm leading-6 text-penny-muted">{item.summary}</p>
      {item.source === 'requests' ? <div className="mt-4 space-y-2 border-t border-penny-line pt-3 text-xs text-penny-muted">
        {item.board ? <p className="break-words">{item.board.name}</p> : null}
        {item.category ? <p className="break-words">{item.category.parent ? `${item.category.parent.name} / ` : ''}{item.category.name}</p> : null}
        {item.voteCount!==undefined?<p className="inline-flex items-center gap-1.5"><PortalIcon name="vote" className="size-3.5" />{item.voteCount} {item.voteCount === 1 ? 'vote' : 'votes'}</p>:null}
        {item.publicEta ? <p>ETA: {item.publicEta}</p> : null}
      </div> : item.requests.length > 0 ? <div className="mt-4 border-t border-penny-line pt-3"><p className={dataLabelClass}>Related feedback</p><ul className="mt-2 space-y-1">{item.requests.map((request) => <li key={request.slug} className="min-w-0"><Link to="/portal/feedback/$requestSlug" params={{ requestSlug: request.slug }} className={`${textLinkClass} flex min-h-11 w-full min-w-0 max-w-full items-center gap-1 text-sm font-medium`}><span className="min-w-0 break-all">{request.title}</span><PortalIcon name="arrow" className="size-3.5 shrink-0" /></Link></li>)}</ul></div> : null}
    </PublicCard>
  )
}
