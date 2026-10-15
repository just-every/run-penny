import type { OperatorDecisionBrief } from '@/core/shared/api/operator'
import { Field,LoopForm,nullableForm,useLoopOptions } from '@/core/app/ui/loop-form'
import { DisclosureRow, SmallDisclosureRow } from '@/core/ui/app/DisclosureRow'
import { SectionCard } from '@/core/ui/app/SectionCard'
import { BetEvidenceForm } from './decision-evidence-form'
const confidence=[{id:'low',label:'Low'},{id:'medium',label:'Medium'},{id:'high',label:'High'}]
export function DecisionCreate({onSaved}:{onSaved:()=>void}){
 const options=useLoopOptions()
 return <DisclosureRow icon="plus" label="Create decision" className="mt-6 sm:mt-8"><LoopForm frame="none" title="New decision" action="/api/operator/decisions" onSaved={onSaved} reset submit="Create decision" transform={data=>({...nullableForm(data),question:data.get('question')??''})}><Field name="question" label="Question"/><Field name="ownerOperatorId" label="Owner" choices={options.kind==='ready'?options.data.operators:[]}/></LoopForm></DisclosureRow>
}
export function DecisionActions({decision,onSaved}:{decision:OperatorDecisionBrief;onSaved:()=>void}){
 const options=useLoopOptions()
 if(!['draft','ready'].includes(decision.state))return null
 const base=`/api/operator/decisions/${decision.id}`
 return <div className="grid min-w-0 items-start gap-6 lg:grid-cols-2">
 <SectionCard id="brief-edit" icon="form" title="Edit brief"><LoopForm frame="hidden" title="Edit brief" action={base} method="PATCH" onSaved={onSaved} transform={data=>({...nullableForm(data),question:data.get('question')??''})}><Field name="question" label="Question" value={decision.question}/><Field name="ownerOperatorId" label="Owner" value={decision.owner?.id} choices={options.kind==='ready'?options.data.operators:[]}/><Field name="confidence" label="Confidence" value={decision.confidence} choices={confidence}/><Field name="reviewAt" label="Review date" value={decision.reviewAt?.slice(0,10)} type="date"/></LoopForm></SectionCard>
 <SectionCard id="brief-add-bet" icon="plus" title="Add candidate bet"><LoopForm frame="hidden" title="Add candidate bet" action={`${base}/bets`} onSaved={onSaved} reset submit="Add bet"><Field name="title" label="Bet title" required/><Field name="summary" label="Approach" type="textarea" required/></LoopForm></SectionCard>
 <SectionCard id="brief-commit" icon="check" title="Commit decision" className="lg:col-span-2"><LoopForm frame="hidden" title="Commit decision" action={`${base}/commit`} onSaved={onSaved} submit="Commit selected bet" transform={nullableForm}><Field name="selectedCandidateBetId" label="Selected bet" choices={decision.bets.map(b=>({id:b.id,label:b.title}))}/><Field name="rationale" label="Rationale" type="textarea"/><Field name="ownerOperatorId" label="Owner" value={decision.owner?.id} choices={options.kind==='ready'?options.data.operators:[]}/><Field name="confidence" label="Confidence" value={decision.confidence} choices={confidence}/><Field name="reviewAt" label="Review date" type="date" value={decision.reviewAt?.slice(0,10)}/>{decision.bets.length<2?<Field name="noViableAlternativeReason" label="No viable alternative reason" type="textarea"/>:null}<p className="text-base text-penny-muted">Commitment records the comparison and creates an internal Planned item. Public approval is a separate action.</p></LoopForm></SectionCard>
 </div>
}
export function BetActions({decisionId,bet,onSaved,editable}:{decisionId:string;bet:OperatorDecisionBrief['bets'][number];onSaved:()=>void;editable:boolean}){
 return <SmallDisclosureRow icon="form" label="Manage this bet">{editable?<LoopForm title="Edit comparison dimensions" action={`/api/operator/decisions/${decisionId}/bets/${bet.id}`} method="PATCH" onSaved={onSaved} transform={nullableForm}><Field name="title" label="Bet title" value={bet.title} required/><Field name="summary" label="Approach" value={bet.summary} required type="textarea"/><Field name="urgency" label="Urgency" value={bet.urgency}/><Field name="deliveryShape" label="Delivery shape" value={bet.deliveryShape}/><Field name="successMeasure" label="Observable success measure" value={bet.successMeasure}/></LoopForm>:null}
 <BetEvidenceForm betId={bet.id} onSaved={onSaved}/>
 {bet.evidence.map(e=><LoopForm key={e.id} title={`Unlink ${e.sourceLabel??e.sourceType}`} action={`/api/operator/evidence/${e.id}/links`} method="DELETE" onSaved={onSaved} submit="Unlink evidence" transform={()=>({target:'bet',targetId:bet.id})}><p className="truncate text-sm text-penny-muted">{e.wording}</p></LoopForm>)}
 </SmallDisclosureRow>
}
