import type {OperatorRoadmapCard} from '@/core/shared/api/operator'
import type {ReleaseWindow} from '../../workspace/list-query'
import type {RoadmapPresentation} from '../../views/definition'
import {roadmapStatusLabel} from '@/core/app/ui/operator-format'
import {windowEnd} from '../../planning/risk'
import {RoadmapCard} from './roadmap-card'

function period(value:string|null,grain:'month'|'quarter'):string|null{
 if(!value||!windowEnd(value))return null
 if(/^\d{4}-Q[1-4]$/.test(value))return value.replace('-Q',' Q')
 const month=Number(value.slice(5,7))
 return grain==='quarter'?`${value.slice(0,4)} Q${Math.ceil(month/3)}`:value.slice(0,7)
}
export function RoadmapLayouts({items,presentation,releaseWindows,onSaved}:{items:readonly OperatorRoadmapCard[];presentation:RoadmapPresentation;releaseWindows:readonly ReleaseWindow[];onSaved:()=>void}){
 const buckets=new Map<string,OperatorRoadmapCard[]>()
 if(presentation.layout==='board')for(const status of ['exploring','planned','in_progress','shipped','dropped'])buckets.set(roadmapStatusLabel(status as OperatorRoadmapCard['status']),items.filter(item=>item.status===status))
 else if(presentation.layout==='horizons')for(const [name,statuses] of [['Now',['in_progress']],['Next',['planned']],['Later',['exploring']],['Completed',['shipped','dropped']]] as const)buckets.set(name,items.filter(item=>(statuses as readonly string[]).includes(item.status)))
 else{
  for(const item of items){const release=releaseWindows.find(window=>window.itemId===item.id),bucket=period(item.targetWindow,presentation.grain)??period(release?.releaseDate??null,presentation.grain)??'Unscheduled';buckets.set(bucket,[...(buckets.get(bucket)??[]),item])}
 }
 const groups=presentation.layout==='timeline'?[...buckets].sort(([a],[b])=>a==='Unscheduled'?1:b==='Unscheduled'?-1:a.localeCompare(b)):[...buckets]
 return <>{presentation.layout==='horizons'?<p className="mb-4 text-sm text-penny-muted">Now shows In progress, Next shows Planned, and Later shows Exploring. Shipped and Dropped items remain in Completed.</p>:presentation.layout==='timeline'?<p className="mb-4 text-sm text-penny-muted">Grouped by the target window, or the first linked release date when no dated target is set. Other target wording stays visible as Unscheduled.</p>:null}
 <div data-roadmap-layout={presentation.layout} className={`grid min-w-0 grid-cols-1 gap-4 ${presentation.layout==='timeline'?'lg:grid-cols-2':'sm:grid-cols-2 xl:grid-cols-3'}`}>
 {groups.map(([name,lane],index)=><section key={name} className="min-w-0 rounded-xl border border-penny-line bg-penny-paper/60 p-3" aria-labelledby={`roadmap-lane-${index}`}><div className="flex items-center justify-between gap-3"><h2 id={`roadmap-lane-${index}`} className="text-base font-bold text-penny-ink">{name}</h2><span className="min-w-7 rounded-full border border-penny-line bg-penny-card px-2 py-0.5 text-center text-xs font-semibold text-penny-muted tabular-nums">{lane.length}</span></div><div className="mt-3 space-y-3">{lane.length===0?<p className="rounded-lg border border-dashed border-penny-line bg-penny-card/60 px-3 py-4 text-sm leading-6 text-penny-muted">No items in this stage.</p>:lane.map(item=><div key={item.id} id={`roadmap-${item.id}`}><RoadmapCard item={item} onSaved={onSaved}/>{presentation.layout==='timeline'?releaseWindows.filter(window=>window.itemId===item.id).map(window=><p key={window.name+window.releaseDate} className="mt-2 break-words text-sm text-penny-muted">Release plan: {window.name} · <time dateTime={window.releaseDate}>{window.releaseDate}</time></p>):null}</div>)}</div></section>)}
 </div></>
}
