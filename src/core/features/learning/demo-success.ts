import type {LearningWire} from './configuration'
import type {LearningOutput} from './schema'

/** The paid model's provider envelope, used only by demoEffect in a demo. */
export function demoLearningSuccess(wire:LearningWire){
 const request=JSON.parse(wire.body),input=JSON.parse(request.messages.find((message:{role:string})=>message.role==='user').content)
 const observations=input.observations as {id:string;wording:string;citableRanges?:{start:number;end:number}[]}[]
 const citations=observations.flatMap(observation=>(observation.citableRanges??[{start:0,end:observation.wording.length}]).map(range=>({observationId:observation.id,start:range.start,end:range.end,quote:observation.wording.slice(range.start,range.end)}))).slice(0,100)
 const ids=[...new Set(citations.map(citation=>citation.observationId))]
 const option=(id:string,kind:'no-build'|'product',title:string,mechanism:string)=>({id,kind,title,mechanism,urgency:'Before the next decision review',deliveryShape:kind==='no-build'?'An internal workflow checklist':'A bounded internal prototype',successMeasure:'Compare completion of the reported workflow',supportingObservationIds:ids,contradictingObservationIds:[],limitations:'Selected evidence does not establish prevalence or causation.'})
 const output:LearningOutput={
  question:input.question||'Which change would help with the reported workflow?',
  interpretation:'The selected evidence describes friction. Compare clearer guidance with a change to the workflow before committing.',
  uncertainty:['The selected observations do not establish how many customers share this problem.'],citations,contradictions:[],missingEvidence:['A comparison with customers who complete the same workflow.'],
  clarification:{question:'Does the difficulty come from finding the workflow or completing it?',whyItMatters:'Guidance and a product change address different causes.',distinguishes:['The existing workflow is hard to find.','The workflow lacks a needed capability.']},
  options:[option('guidance','no-build','Prepare workflow guidance','Outline the existing steps and identify unclear instructions.'),option('prototype','product','Sketch a workflow improvement','Prepare an internal prototype addressing the reported friction.')],
  recommendation:{optionId:'guidance',rationale:'Prepare a reversible way to compare the explanations.',whyNow:'The evidence is available for the next review.',consequence:'An internal plan; no customer contact or production change.'},
  protocol:{cohort:null,denominator:null,baseline:null,window:null,measure:'Workflow completion',dataSource:'The selected evidence',comparison:'Guidance versus a workflow prototype',limits:'No outcomes have been measured.',stopRule:'Stop when the authorization expires.',budgetMicros:0},
  nextCheck:'Review the proposed explanations against additional permitted evidence.',
  work:{method:'Compare the selected observations',evidenceObtained:'Retained exact quotations from the permitted evidence.',implementationBrief:['Write a checklist of the current workflow.','Sketch a prototype for the reported difficulty.','Agree on a comparison before any customer-facing action.'],decisionImpact:'Provides two reversible approaches for the owner to review.'},
 }
 return {status:200,headers:{'content-type':'application/json'},body:JSON.stringify({choices:[{message:{content:JSON.stringify(output)},finish_reason:'stop'}],usage:{prompt_tokens:0,completion_tokens:0}})}
}
