import {useHydrated} from '@/core/app/ui/hydrated'
import {RoadmapLayouts} from './roadmap-layouts'
import {ViewColumns} from '../../views/columns'
import type {RoadmapPresentation} from '../../views/definition'
import {fieldClass} from '../../auth/client-mutations'
import {secondaryButtonClass,fieldLabelClass} from '@/core/ui/app/classes'
import {ReleasePlanning} from '@/core/features/planning/panel'
import { useState } from 'react'
import { StatusDrafts } from '@/core/features/releases/ui/status-drafts'
import { useSearch } from '@tanstack/react-router'
import type { OperatorRoadmapCard } from '@/core/shared/api/operator'
import { OperatorPageHeader } from '@/core/app/ui/operator-page-header'
import { useOperatorList, ListControls } from '@/core/features/workspace/ui/list-controls'
import { OperatorEmpty, OperatorResourceFailure, OperatorResourceLoading, OperatorResourceNotFound, OperatorSessionExpired } from '@/core/app/ui/operator-resource-state'


export function RoadmapPage() {
  const hydrated=useHydrated()
  const [generation, setGeneration] = useState(0)
  const { active } = useSearch({ from: '/app/roadmap' })
  const [roadmap, retry, page] = useOperatorList<OperatorRoadmapCard>('/api/operator/roadmap')
  const [choice,setChoice]=useState<{forId:string;presentation:RoadmapPresentation}>({forId:'',presentation:{layout:'board',grain:'month'}})
  const viewId=page?.savedView?.id??'',presentation=choice.forId===viewId?choice.presentation:page?.savedView?.presentation??{layout:'board',grain:'month'}
  const choose=(next:RoadmapPresentation)=>setChoice({forId:viewId,presentation:next})
  const refresh = () => { retry(); setGeneration(value => value + 1) }
  const visibleRoadmap = roadmap.kind === 'ready' && active ? roadmap.data.filter((item) => item.status === 'planned' || item.status === 'in_progress') : roadmap.kind === 'ready' ? roadmap.data : []
  const empty = roadmap.kind === 'ready' && visibleRoadmap.length === 0
  return <><OperatorPageHeader eyebrow="Internal roadmap" title="Turn commitments into an honest delivery promise." art={empty || roadmap.kind === 'error' ? null : { note: 'Planned → In\u00a0progress → Shipped' }}>Track delivery without confusing internal confidence, notes, or account context with what customers are told publicly.</OperatorPageHeader><nav aria-label="Roadmap layout" className="my-5 flex flex-wrap items-end gap-3">{[['board','Status board'],['horizons','Now / Next / Later'],['timeline','Timeline']].map(([layout,label])=><button type="button" disabled={!hydrated} className={secondaryButtonClass} key={layout} aria-pressed={presentation.layout===layout} onClick={()=>choose({...presentation,layout:layout as RoadmapPresentation['layout']})}>{label}</button>)}{presentation.layout==='timeline'?<label className={fieldLabelClass}>Timeline scale<select className={fieldClass} disabled={!hydrated} value={presentation.grain} onChange={event=>choose({...presentation,grain:event.target.value as 'month'|'quarter'})}><option value="month">Month</option><option value="quarter">Quarter</option></select></label>:null}</nav><ListControls page={page} entity="roadmap" presentation={presentation}/><section className="mt-6 sm:mt-8" aria-labelledby="roadmap-heading"><h2 id="roadmap-heading" className="sr-only">Roadmap items</h2>{active ? <p className="mb-4 text-base font-semibold text-penny-muted">Showing Planned and In progress delivery items.</p> : null}{roadmap.kind === 'loading' ? <OperatorResourceLoading label="Loading roadmap items…" /> : null}{roadmap.kind === 'session_expired' ? <OperatorSessionExpired /> : null}{roadmap.kind === 'not_found' ? <OperatorResourceNotFound title="Roadmap unavailable">This workspace roadmap route is not available.</OperatorResourceNotFound> : null}{roadmap.kind === 'error' ? <OperatorResourceFailure title="We could not load the roadmap." status={roadmap.status} message={roadmap.message} onRetry={retry} /> : null}{empty ? <OperatorEmpty title={active ? 'No active delivery items.' : 'No roadmap items have been created.'}>{active ? 'Planned and In progress items will appear here.' : 'A committed decision can create an internal roadmap item.'}</OperatorEmpty> : null}{roadmap.kind === 'ready' ? <ViewColumns value={page?.savedView?.columns}><RoadmapLayouts items={visibleRoadmap} presentation={presentation} releaseWindows={page?.releaseWindows??[]} onSaved={refresh}/></ViewColumns> : null}</section><ReleasePlanning generation={generation}/><StatusDrafts generation={generation}/></>
}
