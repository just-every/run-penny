import {useEffect,useRef,useState} from 'react'
import {Link} from '@tanstack/react-router'
import {OperatorResourceFailure,OperatorSessionExpired} from '@/core/app/ui/operator-resource-state'
import {useOperatorResource} from '@/core/app/ui/operator-resource'
import {roundMutation,roundMutationFailure,type RoundMutationFailure} from '../requests/ui/round-mutation'
import {fieldClass} from '../auth/client-mutations'
import {paperCardClass,primaryButtonClass,secondaryButtonClass,disclosureSummaryClass} from '@/core/ui/app/classes'
import type {Scorecard,ScorecardResult} from './scorecards'
export interface ScorecardList {cards:Scorecard[];scorerId:string;canConfigure:boolean}
type Criterion=ScorecardResult['versions'][number]['criteria'][number]
/** A draft row remembers the position of the saved criterion it started from; rows the person added have none. */
type DraftCriterion=Criterion&{base?:number}
interface Base {revision:number;name:string;criteria:Criterion[]}
const current=(card:ScorecardResult)=>card.versions.find(v=>v.version===card.revision)?.criteria??[]
/** Fields the person left as the base version had them take the newer version's value at that position; typed fields, added rows and removals stay. */
function rebase(rows:DraftCriterion[],from:Criterion[],to:Criterion[]):DraftCriterion[]{
 const kept=rows.flatMap(({base:at,...row}):DraftCriterion[]=>{
  const was=at===undefined?undefined:from[at]
  if(at===undefined||!was)return [row]
  const now=to[at]
  if(!now)return row.name!==was.name||row.scale!==was.scale||row.weight!==was.weight?[row]:[]
  return [{name:row.name===was.name?now.name:row.name,scale:row.scale===was.scale?now.scale:row.scale,weight:row.weight===was.weight?now.weight:row.weight,base:at}]
 })
 return [...kept,...to.slice(from.length).map((criterion,index)=>({...criterion,base:from.length+index}))]
}
export function ScorecardSettings(){
 const [resource,reload]=useOperatorResource<ScorecardList>('/api/operator/scorecards')
 const [createOpen,setCreateOpen]=useState(false),[created,setCreated]=useState(''),[savedId,setSavedId]=useState('')
 if(resource.kind==='loading')return null
 if(resource.kind!=='ready')return <section id="settings-scorecards" aria-label="Scorecard settings">{resource.kind==='session_expired'?<OperatorSessionExpired/>:<OperatorResourceFailure title="Could not load scorecards." onRetry={reload}/>}</section>
 if(!resource.data.canConfigure)return null
 const onSaving=()=>setSavedId('')
 return <section id="settings-scorecards" className={`${paperCardClass} p-5 sm:p-6`} aria-label="Scorecard settings"><h2 className="text-xl font-bold">Scorecards</h2><details className="mt-4" open={createOpen} onToggle={e=>setCreateOpen(e.currentTarget.open)}><summary className={disclosureSummaryClass}>Create scorecard</summary><ScorecardEditor onSaving={onSaving} onSaved={id=>{setSavedId(id);setCreateOpen(false);setCreated(id);reload()}}/></details>{resource.data.cards.map(card=><details className="mt-4" key={card.id} open={created===card.id||undefined}><summary className={disclosureSummaryClass}>Edit {card.name}</summary><EditScorecard id={card.id} succeeded={savedId===card.id} onSaving={onSaving} onSaved={()=>{setSavedId(card.id);reload()}}/></details>)}</section>
}
function EditScorecard({id,succeeded,onSaved,onSaving}:{id:string;succeeded:boolean;onSaved:()=>void;onSaving:()=>void}){
 const [card,reload,request]=useOperatorResource<ScorecardResult>('/api/operator/scorecards/'+id)
 return card.kind==='ready'?<ScorecardEditor key={card.data.id} saved={card.data} succeeded={succeeded} reloading={request.pending} onReload={reload} onSaving={onSaving} onSaved={()=>{reload();onSaved()}}/>:card.kind==='loading'?<p role="status">Loading criteria…</p>:card.kind==='session_expired'?<OperatorSessionExpired/>:<OperatorResourceFailure title="Could not load criteria." onRetry={reload}/>
}
function ScorecardEditor({saved,succeeded=false,reloading=false,onReload,onSaved,onSaving}:{saved?:ScorecardResult;succeeded?:boolean;reloading?:boolean;onReload?:()=>void;onSaved:(id:string)=>void;onSaving:()=>void}){
 const [base,setBase]=useState<Base|null>(saved?{revision:saved.revision,name:saved.name,criteria:current(saved)}:null)
 const [criteria,setCriteria]=useState<DraftCriterion[]>(()=>base?base.criteria.map((criterion,index)=>({...criterion,base:index})):[{name:'Impact',scale:5,weight:1}]),[busy,setBusy]=useState(false),[failure,setFailure]=useState<RoundMutationFailure|null>(null)
 const writing=useRef(false),status=useRef<HTMLSpanElement>(null)
 const [name,setName]=useState(saved?.name??''),[entity,setEntity]=useState<Scorecard['entity']>(saved?.entity??'requests')
 // A newer saved version (Reload, or the refresh after a save) is rebased under the draft; the form stays mounted.
 if(saved&&base&&saved.revision>base.revision){const newer=current(saved);setBase({revision:saved.revision,name:saved.name,criteria:newer});setName(name===base.name?saved.name:name);setCriteria(rebase(criteria,base.criteria,newer))}
 useEffect(()=>{if(succeeded)status.current?.scrollIntoView({block:'nearest'})},[succeeded])
 return <form aria-label={saved?'Edit scorecard':'Create scorecard'} className="mt-4 space-y-4" onSubmit={async event=>{
  event.preventDefault();if(writing.current||reloading)return;writing.current=true;const data=new FormData(event.currentTarget);setBusy(true);setFailure(null);onSaving()
  try{
   const result=await roundMutation<{id:string}>('/api/operator/scorecards'+(saved?'/'+saved.id:''),{name:data.get('name'),entity:data.get('entity'),criteria:criteria.map(({name,scale,weight})=>({name,scale,weight})),...(saved?{revision:saved.revision}:{})},saved?'PUT':'POST')
   if(!saved){setName('');setEntity('requests');setCriteria([{name:'Impact',scale:5,weight:1}])}
   onSaved(result.id)
  }catch(error){setFailure(roundMutationFailure(error,"Couldn't save the scorecard."))}finally{writing.current=false;setBusy(false)}
 }}><label className="block text-sm font-semibold">Scorecard name<input className={fieldClass} name="name" value={name} onChange={e=>setName(e.target.value)} required maxLength={120}/></label><label className="block text-sm font-semibold">Ideas<select aria-label="Ideas" className={fieldClass} name="entity" value={entity} onChange={e=>setEntity(e.target.value as Scorecard['entity'])} disabled={Boolean(saved)}><option value="requests">Requests</option><option value="features">Features</option></select></label>{saved?<input type="hidden" name="entity" value={saved.entity}/>:null}
 {criteria.map((criterion,index)=><fieldset className="grid min-w-0 gap-3 rounded-lg border border-penny-line p-3 sm:grid-cols-3" key={index}><legend className="px-1 text-sm font-semibold">Criterion {index+1}</legend><label className="text-sm font-semibold">Name<input className={fieldClass} value={criterion.name} required maxLength={120} onChange={e=>setCriteria(rows=>rows.map((row,i)=>i===index?{...row,name:e.target.value}:row))}/></label><label className="text-sm font-semibold">Scale<select aria-label="Scale" className={fieldClass} value={criterion.scale} onChange={e=>setCriteria(rows=>rows.map((row,i)=>i===index?{...row,scale:Number(e.target.value) as 5|10}:row))}><option value={5}>1–5</option><option value={10}>1–10</option></select></label><label className="text-sm font-semibold">Weight<input className={fieldClass} type="number" min="0.001" max="1000" step="any" value={criterion.weight} required onChange={e=>setCriteria(rows=>rows.map((row,i)=>i===index?{...row,weight:Number(e.target.value)}:row))}/></label>{criteria.length>1?<button type="button" className="min-h-11 text-left text-sm underline" onClick={()=>setCriteria(rows=>rows.filter((_,i)=>i!==index))}>Remove criterion {index+1}</button>:null}</fieldset>)}
 <div className="flex flex-wrap items-center gap-3">{criteria.length<20?<button type="button" className="min-h-11 rounded-lg border border-penny-line px-4 text-sm font-semibold" onClick={()=>setCriteria(rows=>[...rows,{name:'',scale:5,weight:1}])}>Add criterion</button>:null}<button disabled={busy||reloading} className={primaryButtonClass}>Save scorecard</button>{succeeded?<span ref={status} role="status" className="text-sm text-penny-muted">Saved</span>:null}</div>{failure?<div className="text-sm"><p role="alert">{failure.message}</p>{failure.action==='retry'?<button className={`${secondaryButtonClass} mt-2`} disabled={busy}>Retry</button>:failure.action==='reload'?<button type="button" className={`${secondaryButtonClass} mt-2`} disabled={reloading} onClick={()=>{setFailure(null);onReload?.()}}>Reload</button>:failure.action==='sign_in'?<Link to="/signin" className={`${secondaryButtonClass} mt-2`}>Sign in now</Link>:null}</div>:null}</form>
}
