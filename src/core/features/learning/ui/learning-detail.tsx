import { useState } from 'react'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { OperatorResourceFailure,OperatorResourceLoading,OperatorResourceNotFound,OperatorSessionExpired } from '@/core/app/ui/operator-resource-state'
import { LoopForm,Field } from '@/core/app/ui/loop-form'
import type { Artifact,Detail,Investigation,Source } from './types'
import { api,money,learningReason } from './types'
import { LearningCitation } from './learning-citation'

export function InvestigationControls({investigation,onSaved,sources}:{investigation:Investigation;onSaved:()=>void;sources:Source[]}) {
 const [inspect,setInspect]=useState(false)
 const base=`${api}/investigations/${investigation.id}`
 return <details><summary>Scope, cost and controls</summary><p>{investigation.purpose}</p><dl><dt>State</dt><dd>{investigation.state}</dd><dt>Grant expires</dt><dd>{investigation.expiresAt}</dd><dt>Used or reserved / limit</dt><dd>{money(investigation.spentMicros)} / {money(investigation.budgetMicros)}</dd><dt>Actual cost / still reserved</dt><dd>{money(investigation.actualCostMicros)} / {money(investigation.reservedCostMicros)}</dd><dt>Maximum check cost</dt><dd>{money(investigation.maxRunCostMicros)}</dd><dt>Next check</dt><dd>{investigation.nextRunAt??'No check scheduled'}</dd></dl>{investigation.lastReason?<p>{learningReason(investigation.lastReason)}</p>:null}
 <details onToggle={e=>setInspect(e.currentTarget.open)}><summary>Inspect history and prior versions</summary>{inspect?<InvestigationHistory id={investigation.id}/>:null}</details>
 <details><summary>Add a permitted source to this question</summary><LoopForm title="Extend selected source evidence" action={`${base}/source`} onSaved={onSaved} submit="Use selected source"><Field name="sourceId" label="Previously granted source" choices={sources.filter(s=>s.state==='active'&&s.provider==='orbit').map(s=>({id:s.id,label:s.name}))} required/><p>Reads only the selected records under the current purpose, expiry and budget. Grant the source below first.</p></LoopForm></details>
 <div className="control-actions">{(['run',investigation.state==='paused'?'resume':'pause','revoke'] as const).map(action=><LoopForm frame="hidden" key={action} title={`${action} investigation`} action={`${base}/${action==='run'?'run':'control'}`} submit={action==='run'?'Check now':action==='resume'?'Resume this':action==='pause'?'Pause this':'Revoke grant'} onSaved={onSaved} transform={()=>action==='run'?{}:{action}} disabled={investigation.state==='revoked'}><span className="sr-only">{action} affects this investigation only.</span></LoopForm>)}</div><p>Revoke stops future effects. Disconnecting a source additionally purges its copied records and derived work.</p></details>
}
export function SourceDrilldown({artifact}:{artifact:Artifact}) {
 const [state,retry]=useOperatorResource<Detail>(`${api}/investigations/${artifact.investigationId}`)
 if(state.kind==='loading')return <OperatorResourceLoading label="Loading original sources…"/>
 if(state.kind==='session_expired')return <OperatorSessionExpired/>
 if(state.kind==='not_found')return <OperatorResourceNotFound title="Learning record unavailable">It may have been erased or disconnected.</OperatorResourceNotFound>
 if(state.kind==='error')return <OperatorResourceFailure title="Could not load originals." onRetry={retry} status={state.status}/>
 return <div>{state.data.observations.map(o=><article key={o.id} className="source-row"><LearningCitation source={o.presentation}/><details><summary>Exact immutable wording and provider original</summary><p>Observation {o.id}</p><h4>Citation offset basis</h4><pre>{o.wording}</pre><h4>Preserved original</h4><pre>{JSON.stringify(o.original,null,2)}</pre></details>{[...artifact.body.citations,...artifact.body.contradictions].filter(c=>c.observationId===o.id).map((c,i)=><p key={i}>Cited span {c.start}–{c.end}: <q>{c.quote}</q></p>)}</article>)}<p>Interpretation v{artifact.version}. {state.data.artifacts.length} preserved versions; {state.data.corrections.length} recorded corrections; {state.data.runs.length} checks.</p></div>
}
export function CorrectInterpretation({artifact,onSaved}:{artifact:Artifact;onSaved:()=>void}) {
 return <details><summary>Contest or correct interpretation</summary><LoopForm title="Correct interpretation" action={`${api}/investigations/${artifact.investigationId}/correct`} submit="Record correction" onSaved={onSaved} transform={d=>({interpretationId:artifact.id,correction:d.get('correction')})}><Field name="correction" label="Correction and its evidence" type="textarea" required/><p>Creates a durable contest, invalidates stale advice, and informs the next check. Original source wording is preserved.</p></LoopForm></details>
}

function InvestigationHistory({id}:{id:string}) {
 const [state,retry]=useOperatorResource<Detail>(`${api}/investigations/${id}`)
 if(state.kind==='loading')return <OperatorResourceLoading label="Loading investigation history…"/>
 if(state.kind==='session_expired')return <OperatorSessionExpired/>
 if(state.kind==='not_found')return <OperatorResourceNotFound title="History unavailable">This investigation may have been erased.</OperatorResourceNotFound>
 if(state.kind==='error')return <OperatorResourceFailure title="Could not load history." onRetry={retry} status={state.status}/>
 return <div><h3>Preserved interpretations</h3>{state.data.artifacts.map(a=><article key={a.id} className="source-row"><h4>Version {a.version} · {a.state}</h4><p>{a.createdAt}</p><p>{a.body.interpretation}</p><p>Next check: {a.body.nextCheck}</p><ul>{a.body.uncertainty.map((u,i)=><li key={i}>{u}</li>)}</ul><CorrectInterpretation artifact={a} onSaved={retry}/></article>)}<h3>Operator corrections</h3>{state.data.corrections.length?state.data.corrections.map(c=><article key={c.id} className="source-row"><p>{c.created_at}</p><blockquote>{c.correction}</blockquote></article>):<p>No corrections recorded.</p>}<h3>Checks and actual costs</h3>{state.data.runs.length?state.data.runs.map(r=><article key={r.id} className="source-row"><p>{r.state} · {r.finished_at??r.created_at}</p><p>{learningReason(r.reason)}</p><p>{r.actual_micros===null?`Actual cost is unresolved; ${money(r.reserved_micros)} reserved.`:`Actual cost: ${money(r.actual_micros)}.`}</p></article>):<p>No checks have run.</p>}</div>
}
