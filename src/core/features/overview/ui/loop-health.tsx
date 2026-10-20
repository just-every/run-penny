import { useState } from 'react'
import { useLocation } from '@tanstack/react-router'
import type { WorkspaceOverviewDto } from '@/core/features/workspace/overview-dto'
import type { LoopHealthMetric as Metric, LoopHealthPage } from '@/core/features/workspace/loop-health-types'
import { WorkspaceLink } from '@/core/features/workspace/ui/workspace-link'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { OperatorCard } from '@/core/app/ui/operator-primitives'
import { OperatorEmpty, OperatorResourceFailure, OperatorResourceLoading, OperatorResourceNotFound, OperatorSessionExpired } from '@/core/app/ui/operator-resource-state'
import { secondaryButtonClass, textLinkClass } from '@/core/ui/app/classes'
import { SectionHeading } from '@/core/ui/app/SectionHeading'
import { cardHoverClass, cardLinkClass } from './overview-parts'

const metrics = {
  ownership: { title: 'Requests with an owner', description: 'All current requests, including those without an owner.', empty: 'No current requests yet.' },
  response: { title: 'Time to first public response', description: 'Requests with a public response, showing the time from creation to their first response.', empty: 'No requests have a public response yet.' },
  notified: { title: 'Shipped requests notified', description: 'All shipped requests. A request counts as notified when at least one release recipient snapshot is fully delivered.', empty: 'No shipped requests yet.' },
  promises: { title: 'Promises at risk', description: 'Active roadmap items with a past-due approved public ETA or a slipped delivery dependency. Each item is counted once.', empty: 'No promises are currently at risk.' },
} as const
export function LoopHealth({ health }: { readonly health: WorkspaceOverviewDto['loopHealth'] }) {
  const location = useLocation()
  const hash = location.hash.replace(/^#/, '')
  const selected = (Object.keys(metrics) as Metric[]).find(metric => hash === `loop-health-${metric}`)
  const figures: readonly { metric: Metric; value: string; detail: string }[] = [
    { metric: 'ownership', value: share(health.ownership.share, health.ownership.total), detail: `${health.ownership.owned} of ${health.ownership.total} current requests have an owner.` },
    { metric: 'response', value: health.firstResponse.medianSeconds === null ? 'No data' : duration(health.firstResponse.medianSeconds), detail: `${health.firstResponse.responded} of ${health.firstResponse.total} current requests have a public response. Median across responded requests.` },
    { metric: 'notified', value: share(health.notified.share, health.notified.total), detail: `${health.notified.notified} of ${health.notified.total} shipped requests have fully delivered recipient snapshots.` },
    { metric: 'promises', value: String(health.promises.atRisk), detail: 'Active roadmap items with an overdue public ETA or a slipped delivery dependency.' },
  ]

  return (
    <section aria-labelledby="overview-loop-health" className="min-w-0">
      <SectionHeading id="overview-loop-health" title="Loop health">Across the workspace. Open a figure to inspect the records behind it.</SectionHeading>
      <ul className="mt-4 grid min-w-0 list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-4">
        {figures.map(figure => (
          <li key={figure.metric} className="min-w-0">
            <WorkspaceLink href={`${location.pathname}${location.searchStr}#loop-health-${figure.metric}`} aria-label={metrics[figure.metric].title} aria-current={selected === figure.metric ? 'location' : undefined} className={`${cardLinkClass} h-full`}>
              <OperatorCard as="article" className={`h-full p-5 sm:p-6 ${cardHoverClass}`}>
                <h3 className="text-base font-bold text-penny-ink">{metrics[figure.metric].title}</h3>
                <p className="mt-3 break-words text-3xl leading-tight font-extrabold tracking-tight text-penny-ink tabular-nums">{figure.value}</p>
                <p className="mt-3 text-sm leading-normal text-penny-muted">{figure.detail}</p>
                {figure.value === 'No data' ? <p className="mt-2 text-sm text-penny-muted">{metrics[figure.metric].empty}</p> : null}
                <p className="mt-4 text-sm font-semibold text-penny-accent">View records →</p>
              </OperatorCard>
            </WorkspaceLink>
          </li>
        ))}
      </ul>
      {selected ? <LoopHealthRecords key={selected} metric={selected} /> : null}
    </section>
  )
}

function LoopHealthRecords({ metric }: { readonly metric: Metric }) {
  const [page, setPage] = useState(1)
  const [resource, retry] = useOperatorResource<LoopHealthPage>(`/api/operator/loop-health?metric=${metric}&page=${page}`)
  const definition = metrics[metric]

  return (
    <section id={`loop-health-${metric}`} aria-labelledby="loop-health-records-title" className="mt-6 min-w-0 scroll-mt-24 lg:scroll-mt-6">
      <h3 id="loop-health-records-title" className="text-xl font-extrabold text-penny-ink">{definition.title}</h3>
      <p className="mt-2 text-base text-penny-muted">{definition.description}</p>
      <div className="mt-4 space-y-4">
        {resource.kind === 'loading' ? <OperatorResourceLoading label="Loading loop health records…" /> : null}
        {resource.kind === 'session_expired' ? <OperatorSessionExpired /> : null}
        {resource.kind === 'not_found' ? <OperatorResourceNotFound title="Loop health records unavailable">These records could not be found.</OperatorResourceNotFound> : null}
        {resource.kind === 'error' ? <OperatorResourceFailure title="We could not load loop health records." status={resource.status} message={resource.message} onRetry={retry} /> : null}
        {resource.kind === 'ready' ? <>
          {resource.data.items.length === 0 ? <OperatorEmpty small title={resource.data.total === 0 ? definition.empty : 'No records on this page.'}>Current records appear here as the workspace changes.</OperatorEmpty> : (
            <ul className="min-w-0 list-none space-y-3 p-0">
              {resource.data.items.map(item => (
                <li key={item.id} className="min-w-0">
                  <OperatorCard as="article" className="p-5 sm:p-6">
                    <h4 className="break-words text-lg font-bold text-penny-ink"><WorkspaceLink href={item.href} className={`${textLinkClass} inline-block min-h-11 content-center`}>{item.title}</WorkspaceLink></h4>
                    <p className="mt-2 break-words text-base text-penny-muted">{item.detail}</p>
                  </OperatorCard>
                </li>
              ))}
            </ul>
          )}
          <nav aria-label="Loop health pages" className="flex flex-wrap items-center gap-3 border-t border-penny-line pt-4">
            <p role="status" className="text-sm text-penny-muted">{resource.data.total} {resource.data.total === 1 ? 'record' : 'records'} · Page {resource.data.page} of {Math.max(1, Math.ceil(resource.data.total / resource.data.pageSize))}</p>
            {resource.data.page > 1 ? <button type="button" className={secondaryButtonClass} onClick={() => setPage(resource.data.page - 1)}>Previous loop health page</button> : null}
            {resource.data.page * resource.data.pageSize < resource.data.total ? <button type="button" className={secondaryButtonClass} onClick={() => setPage(resource.data.page + 1)}>Next loop health page</button> : null}
          </nav>
        </> : null}
      </div>
    </section>
  )
}

function share(value: number, total: number): string {
  return total === 0 ? 'No data' : `${new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value * 100)}%`
}

function duration(seconds: number): string {
  if (seconds > 0 && seconds < 1) return 'Less than 1 second'
  const rounded = Math.round(seconds)
  const unit = (value: number, name: string) => `${value} ${name}${value === 1 ? '' : 's'}`
  const parts = rounded >= 86400 ? [Math.floor(rounded / 86400), 'day', Math.floor(rounded % 86400 / 3600), 'hour'] as const
    : rounded >= 3600 ? [Math.floor(rounded / 3600), 'hour', Math.floor(rounded % 3600 / 60), 'minute'] as const
      : rounded >= 60 ? [Math.floor(rounded / 60), 'minute', rounded % 60, 'second'] as const
        : null
  return parts ? `${unit(parts[0], parts[1])}${parts[2] > 0 ? ` ${unit(parts[2], parts[3])}` : ''}` : unit(rounded, 'second')
}
