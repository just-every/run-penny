import {ReleasePlanning} from '@/core/features/planning/panel'
import { useState } from 'react'
import { StatusDrafts } from '@/core/features/releases/ui/status-drafts'
import { useSearch } from '@tanstack/react-router'
import type { OperatorRoadmapCard, OperatorRoadmapStatus } from '@/core/shared/api/operator'
import { OperatorPageHeader } from '@/core/app/ui/operator-page-header'
import { useOperatorList, ListControls } from '@/core/features/workspace/ui/list-controls'
import { OperatorEmpty, OperatorResourceFailure, OperatorResourceLoading, OperatorResourceNotFound, OperatorSessionExpired } from '@/core/app/ui/operator-resource-state'
import { roadmapStatusLabel } from '@/core/app/ui/operator-format'
import { RoadmapCard } from './roadmap-card'

const statuses: readonly OperatorRoadmapStatus[] = ['exploring', 'planned', 'in_progress', 'shipped', 'dropped']

export function RoadmapPage() {
  const [generation, setGeneration] = useState(0)
  const { active } = useSearch({ from: '/app/roadmap' })
  const [roadmap, retry, page] = useOperatorList<OperatorRoadmapCard>('/api/operator/roadmap')
  const refresh = () => { retry(); setGeneration(value => value + 1) }
  const visibleRoadmap = roadmap.kind === 'ready' && active ? roadmap.data.filter((item) => item.status === 'planned' || item.status === 'in_progress') : roadmap.kind === 'ready' ? roadmap.data : []
  const empty = roadmap.kind === 'ready' && visibleRoadmap.length === 0
  return <><OperatorPageHeader eyebrow="Internal roadmap" title="Turn commitments into an honest delivery promise." art={empty || roadmap.kind === 'error' ? null : { note: 'Planned → In\u00a0progress → Shipped' }}>Track delivery without confusing internal confidence, notes, or account context with what customers are told publicly.</OperatorPageHeader><ListControls page={page} entity="roadmap"/><section className="mt-6 sm:mt-8" aria-labelledby="roadmap-heading"><h2 id="roadmap-heading" className="sr-only">Roadmap items</h2>{active ? <p className="mb-4 text-base font-semibold text-penny-muted">Showing Planned and In progress delivery items.</p> : null}{roadmap.kind === 'loading' ? <OperatorResourceLoading label="Loading roadmap items…" /> : null}{roadmap.kind === 'session_expired' ? <OperatorSessionExpired /> : null}{roadmap.kind === 'not_found' ? <OperatorResourceNotFound title="Roadmap unavailable">This workspace roadmap route is not available.</OperatorResourceNotFound> : null}{roadmap.kind === 'error' ? <OperatorResourceFailure title="We could not load the roadmap." status={roadmap.status} message={roadmap.message} onRetry={retry} /> : null}{empty ? <OperatorEmpty title={active ? 'No active delivery items.' : 'No roadmap items have been created.'}>{active ? 'Planned and In progress items will appear here.' : 'A committed decision can create an internal roadmap item.'}</OperatorEmpty> : null}{roadmap.kind === 'ready' ? <RoadmapBoard items={visibleRoadmap} onSaved={refresh} /> : null}</section><ReleasePlanning generation={generation}/><StatusDrafts generation={generation}/></>
}

function RoadmapBoard({ items,onSaved }: { readonly items: readonly OperatorRoadmapCard[];onSaved:()=>void }) {
  return <><div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{statuses.map((status) => { const lane = items.filter((item) => item.status === status); return <section key={status} className="min-w-0 rounded-xl border border-penny-line bg-penny-paper/60 p-3" aria-labelledby={`roadmap-${status}`}><div className="flex items-center justify-between gap-3"><h2 id={`roadmap-${status}`} className="text-base font-bold text-penny-ink">{roadmapStatusLabel(status)}</h2><span className="min-w-7 rounded-full border border-penny-line bg-penny-card px-2 py-0.5 text-center text-xs font-semibold text-penny-muted tabular-nums">{lane.length}</span></div><div className="mt-3 space-y-3">{lane.length === 0 ? <p className="rounded-lg border border-dashed border-penny-line bg-penny-card/60 px-3 py-4 text-sm leading-6 text-penny-muted">No items in this stage.</p> : lane.map((item) => <div key={item.id} id={`roadmap-${item.id}`}><RoadmapCard item={item} onSaved={onSaved} /></div>)}</div></section> })}</div></>
}
