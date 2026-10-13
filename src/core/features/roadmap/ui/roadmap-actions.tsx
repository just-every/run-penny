import { EvidencePicker } from './evidence-picker'
import {useRef} from 'react'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { OperatorOptionsState } from '@/core/app/ui/operator-options-state'
import { Field,LoopForm,nullableForm,useLoopOptions } from '@/core/app/ui/loop-form'
import type { OperatorRoadmapCard } from '@/core/shared/api/operator'
import { fieldLabelClass } from '@/core/ui/app/classes'
interface RoadmapContext {
 item:{title:string;summary:string;owner_operator_id:string|null;target_window:string|null;delivery_notes:string|null;confidence:string|null;account_impact:string|null;decision_id:string|null;candidate_bet_id:string|null;public_title_draft:string|null;public_summary_draft:string|null}
 proposed:{id:string;title:string}[]; mappings:{request_id:string;withdrawn_at:string|null}[]
 publication:{publicTitle:string;publicSummary:string;boardSlug:string|null;withdrawnAt:string|null}|null
 evidenceIds:string[];transitions:{id:string;from_status:string|null;to_status:string;reason:string;created_at:string}[]
}
export function RoadmapActions({item,onSaved}:{item:OperatorRoadmapCard;onSaved:()=>void}){
 const [context,reload]=useOperatorResource<RoadmapContext>(`/api/operator/roadmap/${item.id}/context`)
 const options=useLoopOptions()
 const moveAction=useRef<{body:string;key:string}|null>(null)
 const save=()=>{reload();onSaved()}
 const movePayload=(data:FormData)=>{const payload=Object.fromEntries(data),body=JSON.stringify(payload);if(moveAction.current?.body!==body)moveAction.current={body,key:crypto.randomUUID()};return {...payload,idempotencyKey:moveAction.current.key}}
 if(context.kind!=='ready')return <OperatorOptionsState state={context} loading="Loading editing options…" failure="Could not load editing options" reload={reload}/>
 if(options.kind!=='ready')return <OperatorOptionsState state={options} loading="Loading editing options…" failure="Could not load editing options" reload={options.reload}/>
 const record=context.data.item,base=`/api/operator/roadmap/${item.id}`,choices=options.data
 return <div className="mt-2 min-w-0 space-y-4" key={JSON.stringify(context.data)}>
 <EvidencePicker key={JSON.stringify(context.data.evidenceIds)} initialIds={context.data.evidenceIds}>{(picker,ready)=><LoopForm title="Edit internal record" action={base} method="PATCH" disabled={!ready} onSaved={save} transform={data=>({...nullableForm(data),summary:data.get('summary')??'',evidenceIds:data.getAll('evidenceIds')})}>
 <Field name="title" label="Internal title" value={record.title} required/><Field name="summary" label="Internal summary" value={record.summary} type="textarea"/>
 <Field name="ownerOperatorId" label="Owner" choices={choices.operators} value={record.owner_operator_id}/><Field name="targetWindow" label="Target window" value={record.target_window}/>
 <Field name="decisionId" label="Linked decision" choices={choices.decisions} value={record.decision_id}/><Field name="candidateBetId" label="Linked bet" choices={choices.bets} value={record.candidate_bet_id}/>
 {picker}
 <Field name="accountImpact" label="Account impact" value={record.account_impact} type="textarea"/><Field name="confidence" label="Confidence" value={record.confidence} choices={['low','medium','high'].map(id=>({id,label:id}))}/><Field name="deliveryNotes" label="Delivery notes" value={record.delivery_notes} type="textarea"/>
 <Field name="publicTitle" label="Draft customer-safe title" value={record.public_title_draft}/><Field name="publicSummary" label="Draft customer-safe summary" value={record.public_summary_draft} type="textarea"/><p className="text-sm text-penny-muted">Saving drafts keeps the last approved public wording. Approve explicitly below to publish new wording.</p>
 </LoopForm>}</EvidencePicker>
 <LoopForm title="Approve public projection" action={`${base}/approve`} submit="Approve wording and selected mappings" onSaved={save} transform={data=>({publicTitle:data.get('publicTitle'),publicSummary:data.get('publicSummary'),boardSlug:data.get('boardSlug'),requestIds:data.getAll('requestIds')})}>
 <Field name="publicTitle" label="Approved title" required value={record.public_title_draft??context.data.publication?.publicTitle}/><Field name="publicSummary" label="Approved summary" required type="textarea" value={record.public_summary_draft??context.data.publication?.publicSummary}/><Field name="boardSlug" label="Public board" required choices={choices.boards.filter(b=>b.visibility==='public')} value={context.data.publication?.boardSlug}/>
 <fieldset className="min-w-0"><legend className={fieldLabelClass}>Approve each published request mapping</legend><p className="my-2 text-xs text-penny-muted">Suggestions from the selected bet: {context.data.proposed.map(r=>r.title).join(', ')||'None yet'}. Select each mapping to approve it.</p>{choices.requests.filter(r=>r.publiclyVisible).map(r=><label key={r.id} className="flex min-h-11 items-center gap-2 text-sm text-penny-ink"><input className="size-4 accent-penny-ink" name="requestIds" type="checkbox" value={r.id} defaultChecked={context.data.mappings.some(m=>m.request_id===r.id&&!m.withdrawn_at)}/>{r.label}</label>)}</fieldset>
 </LoopForm>
 {context.data.publication&&!context.data.publication.withdrawnAt?<LoopForm title="Withdraw public approval" action={`${base}/withdraw`} onSaved={save} transform={()=>({})} submit="Withdraw approval"><p className="text-sm text-penny-muted">Removes the public item and request projections. Internal records and mapping history remain.</p></LoopForm>:null}
 <LoopForm title="Move roadmap item" action={`${base}/move`} onSaved={()=>{moveAction.current=null;save()}} submit="Record move" transform={movePayload}><Field name="status" label="New status" required choices={['exploring','planned','in_progress','shipped','dropped'].filter(s=>s!==item.status).map(id=>({id,label:id.replaceAll('_',' ')}))}/><Field name="reason" label="Reason" required type="textarea"/></LoopForm>
 <section><h4 className="text-sm font-semibold text-penny-ink">Recorded moves</h4>{context.data.transitions.map(t=><p key={t.id} className="mt-2 break-words border-t border-penny-line pt-2 text-sm text-penny-muted">{t.from_status??'Created'} → {t.to_status}: {t.reason} · {t.created_at}</p>)}</section>
 </div>
}
