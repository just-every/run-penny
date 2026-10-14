import {NativeError} from '../auth/native-tokens'
import {outputSchema,type Observation} from './schema'
export function validateLearning(value:unknown,observations:Observation[],budget:number){
 const output=outputSchema.parse(value),ids=new Set(observations.map(o=>o.id)),cited=new Set<string>()
 for(const cite of [...output.citations,...output.contradictions]){
  const observation=observations.find(o=>o.id===cite.observationId)
  if(!observation||cite.end<=cite.start||cite.end>observation.wording.length||cite.start>=observation.wording.length||observation.wording.slice(cite.start,cite.end)!==cite.quote)throw new NativeError('learning_citation_invalid',409)
  cited.add(cite.observationId)
 }
 if(new Set(output.options.map(o=>o.id)).size!==output.options.length||!output.options.some(o=>o.id===output.recommendation.optionId)||!output.options.some(o=>['no-build','support','process','onboarding'].includes(o.kind)))throw new NativeError('learning_comparison_invalid',409)
 if(output.protocol.budgetMicros>budget)throw new NativeError('learning_protocol_budget_exceeded',409)
 if(output.missingEvidence.length&&!output.clarification)throw new NativeError('learning_clarification_required',409)
 const options=output.options.map(option=>{
  if(!option.supportingObservationIds.length||[...option.supportingObservationIds,...option.contradictingObservationIds].some(id=>!ids.has(id)||!cited.has(id)))throw new NativeError('learning_option_evidence_invalid',409)
  const support=observations.filter(o=>option.supportingObservationIds.includes(o.id))
  return {...option,affectedRequesters:[...new Set(support.flatMap(o=>o.requester_id?[o.requester_id]:[]))],affectedAccounts:[...new Set(support.flatMap(o=>o.account_id?[o.account_id]:[]))],unlinkedObservations:support.filter(o=>!o.account_id).length,supportingEvidenceCount:support.length,latestObservedAt:support.map(o=>o.observed_at).sort((a,b)=>Date.parse(b)-Date.parse(a))[0]??null,contradictingEvidence:observations.filter(o=>option.contradictingObservationIds.includes(o.id)).map(o=>({id:o.id,observedAt:o.observed_at}))}
 })
 return {...output,options}
}
