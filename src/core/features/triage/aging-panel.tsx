import { useState } from 'react'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { OperatorCard } from '@/core/app/ui/operator-primitives'
import { fieldClass } from '@/core/features/auth/client-mutations'
import { fieldLabelClass,secondaryButtonClass,textLinkClass } from '@/core/ui/app/classes'
import { operatorMutation } from '../requests/ui/operator-client'
import type { AgingSummary } from './reminders'
const labels={inbox:'Untriaged inbox',comment:'Unanswered comments',response:'No public response',stale:'Stale status'}
export function AgingPanel({staleOnly=false}:{staleOnly?:boolean}){
 const [resource,reload]=useOperatorResource<AgingSummary>('/api/operator/triage'),[message,setMessage]=useState('')
 const summary=resource.kind==='ready'?resource.data:null
 async function snooze(id:string,until:string|null){setMessage('');try{await operatorMutation(`/api/operator/triage/evidence/${id}/snooze`,{until},'PATCH');reload();window.dispatchEvent(new Event('penny-ownership-changed'));setMessage(until?'Evidence snoozed. It will return on the chosen date.':'Evidence returned to the inbox.')}catch(e){setMessage(e instanceof Error?e.message:'Could not change the snooze.')}}
 const items=summary?.items.filter(i=>!staleOnly||i.kind==='stale')??[]
 return <OperatorCard as="section" className="my-6 p-5 sm:p-6" aria-label={staleOnly?'Stale requests':'Aging and follow-up'}>
  <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold text-penny-ink">{staleOnly?'Stale requests':'Aging and follow-up'}</h2><button className={secondaryButtonClass} onClick={reload}>Refresh follow-up</button></div>
  <p className="mt-2 text-sm text-penny-muted">Flags use the ages in Feedback settings. Owners receive one in-app reminder per age step; a response, review or status change clears resolved attention.</p>
  {resource.kind==='loading'?<p className="mt-3">Loading follow-up…</p>:!summary?<p role="alert" className="mt-3 text-penny-danger">Could not load follow-up. Refresh or sign in again.</p>:<>
   <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">{(Object.keys(labels) as (keyof typeof labels)[]).filter(k=>!staleOnly||k==='stale').map(kind=><li key={kind}><a className={`${textLinkClass} inline-flex min-h-11 items-center`} href={`#aging-${kind}`}>{labels[kind]} ({summary.counts[kind]})</a></li>)}</ul>
   {!staleOnly?<p className="mt-2 text-sm text-penny-muted">Your active reminders: {summary.reminders.length}. Unassigned items stay flagged until someone takes ownership.</p>:null}
   {(Object.keys(labels) as (keyof typeof labels)[]).filter(k=>!staleOnly||k==='stale').map(kind=><section key={kind} id={`aging-${kind}`} className="mt-4 border-t border-penny-line pt-4" aria-label={labels[kind]}><h3 className="font-semibold text-penny-ink">{labels[kind]} ({summary.counts[kind]})</h3>{items.filter(i=>i.kind===kind).length?<ul className="mt-2 divide-y divide-penny-line">{items.filter(i=>i.kind===kind).map(item=><li key={item.id} className="min-w-0 space-y-2 py-3"><a className={`${textLinkClass} inline-flex min-h-11 items-center break-words`} href={item.evidenceId?`/app/feedback?item=${item.evidenceId}#evidence-${item.evidenceId}`:`/app/moderation?item=${item.requestId}#request-${item.slug}`}>{item.title.slice(0,200)}</a><p className="text-sm text-penny-muted">{item.ownerName??'Unassigned'} · {item.status?.replaceAll('_',' ')}{item.status?' · ':''}Since {new Date(item.since).toLocaleDateString()} · Age step {item.ageStep}</p>{summary.reminders.some(r=>r.kind===item.kind&&r.id===item.id)?<p className="text-sm font-semibold text-penny-ink">Reminder for you</p>:null}{item.evidenceId&&!staleOnly?<SnoozeForm id={item.evidenceId} save={snooze}/>:null}</li>)}</ul>:<p className="mt-2 text-sm text-penny-muted">Nothing past this age.</p>}</section>)}
   {!staleOnly&&summary.snoozed.length?<section className="mt-5 border-t border-penny-line pt-4" aria-label="Snoozed evidence"><h3 className="font-semibold text-penny-ink">Snoozed evidence ({summary.snoozed.length})</h3><ul className="mt-2 divide-y divide-penny-line">{summary.snoozed.map(item=><li key={item.id} className="space-y-2 py-3"><p className="break-words text-sm">{item.title.slice(0,200)}</p><p className="text-sm text-penny-muted">Returns {new Date(item.untilAt).toLocaleString()}</p><button className={secondaryButtonClass} onClick={()=>void snooze(item.id,null)}>Return to inbox now</button></li>)}</ul></section>:null}
  </>}
  <p role="status" className="mt-3 text-sm empty:hidden">{message}</p>
 </OperatorCard>
}
function SnoozeForm({id,save}:{id:string;save:(id:string,until:string|null)=>Promise<void>}){
 return <form className="flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();const until=String(new FormData(e.currentTarget).get('until'));void save(id,new Date(until).toISOString())}}><label className={`${fieldLabelClass} min-w-0`}>Snooze until<input name="until" type="datetime-local" required className={`${fieldClass} max-w-full`}/></label><button className={secondaryButtonClass}>Snooze evidence</button></form>
}
