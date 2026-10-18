import {useState} from 'react'
import {useLocation} from '@tanstack/react-router'
import {OperatorPageHeader} from '@/core/app/ui/operator-page-header'
import {useOperatorResource} from '@/core/app/ui/operator-resource'
import {OperatorResourceFailure,OperatorResourceLoading,OperatorResourceNotFound,OperatorSessionExpired} from '@/core/app/ui/operator-resource-state'
import {WorkspaceLink} from '@/core/features/workspace/ui/workspace-link'
import {paperCardClass,disclosureSummaryClass,textLinkClass} from '@/core/ui/app/classes'
import {ViewEditor} from './view-editor'
import type {SavedView,ViewResult} from './repository'
import type {EvaluatedRow,ViewInput} from './formulas'
import {inputLabels} from './labels'
export function PrioritisationPage(){
 const selected=new URLSearchParams(useLocation().searchStr).get('view')
 const [views,reload]=useOperatorResource<SavedView[]>('/api/operator/prioritisation')
 return <><OperatorPageHeader eyebrow="Prioritisation" title="Compare demand with every input in view." art={null}>Save a private or shared comparison of requests and features. A formula sorts this view only; decisions and public statuses stay separate.</OperatorPageHeader>
 <div className="space-y-6"><section className={`${paperCardClass} p-5`} aria-label="Saved comparisons"><h2 className="text-xl font-bold">Saved comparisons</h2>{views.kind==='loading'?<OperatorResourceLoading label="Loading comparisons…"/>:views.kind==='session_expired'?<OperatorSessionExpired/>:views.kind!=='ready'?<OperatorResourceFailure title="Could not load comparisons." onRetry={reload}/>:<><ul className="mt-4 space-y-3">{views.data.map(saved=><li key={saved.id} className="break-words"><WorkspaceLink className={textLinkClass} href={`/app/prioritisation?view=${saved.id}`}>{saved.view.name}</WorkspaceLink><span className="ml-2 text-sm text-penny-muted">{saved.view.shared?'Shared':'Private'}{saved.owned?' · Yours':''}</span></li>)}</ul>{!views.data.length?<p className="mt-3 text-penny-muted">No saved comparisons. Create one below.</p>:null}</>}
 <details className="group mt-5"><summary className={disclosureSummaryClass}>Create comparison</summary><div className="mt-3"><ViewEditor onSaved={reload}/></div></details></section>
 {selected?<SelectedView key={selected} id={selected} onSaved={reload}/>:null}</div></>
}
function SelectedView({id,onSaved}:{id:string;onSaved:()=>void}){
 const [result,reload]=useOperatorResource<ViewResult>(`/api/operator/prioritisation/${id}`),[limit,setLimit]=useState(25)
 if(result.kind==='loading')return <OperatorResourceLoading label="Loading comparison…"/>
 if(result.kind==='session_expired')return <OperatorSessionExpired/>
 if(result.kind==='not_found')return <OperatorResourceNotFound title="Comparison unavailable">This view does not exist or is private to another operator.</OperatorResourceNotFound>
 if(result.kind!=='ready')return <OperatorResourceFailure title="Could not load this comparison." onRetry={reload}/>
 const saved=result.data
 return <section className={`${paperCardClass} p-5`} aria-label={saved.view.name}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="break-words text-2xl font-bold">{saved.view.name}</h2><p className="mt-2 text-sm text-penny-muted">{saved.view.entity==='features'?'Features':'Requests'} · {saved.view.formula.replaceAll('_',' ')} · {saved.view.shared?'Shared with operators':'Private'}</p></div><WorkspaceLink className={textLinkClass} href={`/app/prioritisation?view=${id}`}>Open saved view</WorkspaceLink></div>
 {saved.owned?<details className="group mt-4"><summary className={disclosureSummaryClass}>Edit comparison</summary><div className="mt-3"><ViewEditor key={`${saved.id}:${saved.revision}`} saved={saved} onSaved={()=>{reload();onSaved()}}/></div></details>:<p className="mt-4 text-sm text-penny-muted">Shared read-only view. Its creator manages the inputs and sharing.</p>}
 <p className="mt-5 text-sm text-penny-muted">Voters, accounts and evidence are separate native counts. Feature importance counts request-level vote choices, so one person can have choices on several requests. Unknown formula inputs leave the row unscored.</p>
 <ol className="mt-5 space-y-4" aria-label="Ranked comparison">{saved.rows.slice(0,limit).map((row,index)=><ComparisonRow key={row.id} row={row} rank={index+1} formula={saved.view.formula}/>)}</ol>{!saved.rows.length?<p className="mt-4 text-penny-muted">No {saved.view.entity} to compare yet.</p>:null}{limit<saved.rows.length?<button type="button" className="mt-4 min-h-11 underline" onClick={()=>setLimit(n=>n+25)}>Show more results</button>:null}</section>
}
function ComparisonRow({row,rank,formula}:{row:EvaluatedRow;rank:number;formula:ViewInput['formula']}){
 const value=(key:keyof typeof row.inputs)=>row.inputs[key]??'Unknown'
 const calculation=formula==='rice'?`RICE = ${value('reach')} × ${value('impact')} × (${value('confidence')} / 100) ÷ ${value('effort')}`:formula==='value_over_effort'?`Manual value / effort = ${value('value')} ÷ ${value('effort')}`:formula==='weighted_segment_demand'?`Manual segment demand = ${value('segmentDemand')} × ${row.weights.reach}`:formula==='weighted_sum'?`Weighted sum: ${Object.entries(row.weights).filter(([,weight])=>weight!==0).map(([key,weight])=>`${inputLabels[key as keyof typeof inputLabels]} ${value(key as keyof typeof row.inputs)} × ${weight}`).join(' + ')||'no weighted inputs'}`:'Title order'

 return <li className="min-w-0 rounded-lg border border-penny-line p-4"><h3 className="break-words text-lg font-bold">{rank}. {row.title}</h3><dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">{[['Voters',row.votes],['Accounts',row.accounts],['Evidence',row.evidence],['Sort score',row.score===null?'Unscored':Number(row.score.toFixed(4))]].map(([label,value])=><div key={label}><dt className="text-penny-muted">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}</dl>{row.missing.length?<p className="mt-3 text-sm text-penny-muted">Missing: {row.missing.map(key=>inputLabels[key as keyof typeof inputLabels]).join(', ')}</p>:null}<p className="mt-3 break-words text-sm text-penny-muted">{calculation}</p><details className="group mt-3"><summary className={disclosureSummaryClass}>Inputs and weights</summary><dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">{Object.entries(row.inputs).map(([key,value])=><div key={key}><dt className="font-semibold">{inputLabels[key as keyof typeof inputLabels]}</dt><dd>{value===null?'Unknown':value}{formula==='weighted_sum'&&key in row.weights?` · weight ${row.weights[key as keyof typeof row.weights]}`:''}{['impact','confidence','effort','value','segmentDemand'].includes(key)?' · manual input':''}</dd></div>)}</dl></details></li>
}
