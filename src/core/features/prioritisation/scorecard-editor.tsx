import {useState} from 'react'
import {useOperatorResource} from '@/core/app/ui/operator-resource'
import {operatorMutation} from '../requests/ui/operator-client'
import {fieldClass} from '../auth/client-mutations'
import {paperCardClass,primaryButtonClass,disclosureSummaryClass} from '@/core/ui/app/classes'
import type {Scorecard,ScorecardResult} from './scorecards'
export interface ScorecardList {cards:Scorecard[];scorerId:string;canConfigure:boolean}
export function ScorecardSettings(){
 const [resource,reload]=useOperatorResource<ScorecardList>('/api/operator/scorecards')
 if(resource.kind!=='ready')return <section id="settings-scorecards"><h2 className="text-xl font-bold">Scorecards</h2><p role="status">{resource.kind==='loading'?'Loading scorecards…':'Scorecard settings unavailable.'}</p></section>
 return <section id="settings-scorecards" className={`${paperCardClass} p-5 sm:p-6`} aria-label="Scorecard settings"><h2 className="text-xl font-bold">Scorecards</h2><p className="mt-2 text-sm text-penny-muted">Owners and admins define criteria. Every operator can score ideas in Prioritisation.</p>{resource.data.canConfigure?<><details className="mt-4"><summary className={disclosureSummaryClass}>Create scorecard</summary><ScorecardEditor onSaved={reload}/></details>{resource.data.cards.map(card=><details className="mt-4" key={card.id}><summary className={disclosureSummaryClass}>Edit {card.name}</summary><EditScorecard id={card.id} onSaved={reload}/></details>)}</>:<p className="mt-4">Your role can score ideas; an owner or admin manages criteria.</p>}</section>
}
function EditScorecard({id,onSaved}:{id:string;onSaved:()=>void}){
 const [card,reload]=useOperatorResource<ScorecardResult>('/api/operator/scorecards/'+id)
 return card.kind==='ready'?<ScorecardEditor key={card.data.revision} saved={card.data} onSaved={()=>{reload();onSaved()}}/>:<p role="status">{card.kind==='loading'?'Loading criteria…':'Could not load criteria.'}</p>
}
function ScorecardEditor({saved,onSaved}:{saved?:ScorecardResult;onSaved:()=>void}){
 const initial=saved?.versions.find(v=>v.version===saved.revision)?.criteria??[{name:'Impact',scale:5,weight:1}]
 const [criteria,setCriteria]=useState(initial),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[failed,setFailed]=useState(false)
 return <form aria-label={saved?'Edit scorecard':'Create scorecard'} className="mt-4 space-y-4" onSubmit={async event=>{
  event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);setMessage('')
  try{await operatorMutation('/api/operator/scorecards'+(saved?'/'+saved.id:''),{name:data.get('name'),entity:data.get('entity'),criteria,...(saved?{revision:saved.revision}:{})},saved?'PUT':'POST');setFailed(false);setMessage('Scorecard saved. Earlier criteria and inputs remain readable.');onSaved()}catch(error){setFailed(true);setMessage(error instanceof Error?error.message:'Could not save scorecard.')}finally{setBusy(false)}
 }}><label className="block text-sm font-semibold">Scorecard name<input className={fieldClass} name="name" defaultValue={saved?.name} required maxLength={120}/></label><label className="block text-sm font-semibold">Ideas<select className={fieldClass} name="entity" defaultValue={saved?.entity??'requests'} disabled={Boolean(saved)}><option value="requests">Requests</option><option value="features">Features</option></select></label>{saved?<input type="hidden" name="entity" value={saved.entity}/>:null}
 {criteria.map((criterion,index)=><fieldset className="grid min-w-0 gap-3 rounded-lg border border-penny-line p-3 sm:grid-cols-3" key={index}><legend className="px-1 text-sm font-semibold">Criterion {index+1}</legend><label className="text-sm font-semibold">Name<input className={fieldClass} value={criterion.name} required maxLength={120} onChange={e=>setCriteria(rows=>rows.map((row,i)=>i===index?{...row,name:e.target.value}:row))}/></label><label className="text-sm font-semibold">Scale<select className={fieldClass} value={criterion.scale} onChange={e=>setCriteria(rows=>rows.map((row,i)=>i===index?{...row,scale:Number(e.target.value) as 5|10}:row))}><option value={5}>1–5</option><option value={10}>1–10</option></select></label><label className="text-sm font-semibold">Weight<input className={fieldClass} type="number" min="0.001" max="1000" step="any" value={criterion.weight} required onChange={e=>setCriteria(rows=>rows.map((row,i)=>i===index?{...row,weight:Number(e.target.value)}:row))}/></label>{criteria.length>1?<button type="button" className="min-h-11 text-left text-sm underline" onClick={()=>setCriteria(rows=>rows.filter((_,i)=>i!==index))}>Remove criterion {index+1}</button>:null}</fieldset>)}
 <div className="flex flex-wrap gap-3">{criteria.length<20?<button type="button" className="min-h-11 rounded-lg border border-penny-line px-4 text-sm font-semibold" onClick={()=>setCriteria(rows=>[...rows,{name:'',scale:5,weight:1}])}>Add criterion</button>:null}<button disabled={busy} className={primaryButtonClass}>Save scorecard</button></div>{message?<p role={failed?'alert':'status'} className="text-sm">{message}</p>:null}</form>
}
