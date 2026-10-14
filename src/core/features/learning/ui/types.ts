export interface Source {id:string;name:string;provider:string;resourceIds:string[];useBasis:string;state:string}
export interface Investigation {id:string;sourceId:string|null;question:string;purpose:string;state:string;expiresAt:string;budgetMicros:number;spentMicros:number;actualCostMicros:number;reservedCostMicros:number;maxRunCostMicros:number;intervalMinutes:number;nextRunAt:string|null;lastReason:string|null;version:number}
export interface Citation {observationId:string;start:number;end:number;quote:string}
export interface Protocol {cohort:string|null;denominator:number|null;baseline:string|null;window:string|null;measure:string|null;dataSource:string|null;comparison:string|null;limits:string|null;stopRule:string|null;budgetMicros:number}
export interface Option {id:string;kind:string;title:string;mechanism:string;urgency:string;deliveryShape:string;successMeasure:string;limitations:string;affectedRequesters:string[];affectedAccounts:string[];supportingEvidenceCount:number;latestObservedAt:string|null;contradictingEvidence:{id:string;observedAt:string}[];supportingObservationIds:string[];contradictingObservationIds:string[]}
export interface Output {question:string;interpretation:string;uncertainty:string[];contradictions:Citation[];citations:Citation[];missingEvidence:string[];clarification:{question:string;whyItMatters:string;distinguishes:string[]}|null;options:Option[];recommendation:{optionId:string;rationale:string;whyNow:string;consequence:string};protocol:Protocol;nextCheck:string;work?:{method:string;evidenceObtained:string;implementationBrief:string[];decisionImpact:string}}
export interface Artifact {id:string;investigationId:string;version:number;kind:string;state:string;createdAt:string;body:Output}
export interface LearningHome {configuration:{source:boolean;model:boolean};sources:Source[];investigations:Investigation[];results:CommitmentArtifact[];learning:Artifact[];needsYou:Artifact[]}
export interface Observation {id:string;wording:string;sourceLabel?:string;sourceType?:string;observedAt:string;sourcePersonId?:string;externalId?:string}
export interface Detail {investigation:Investigation;observations:Observation[];artifacts:Artifact[];commitments:unknown[];runs:{id:string;state:string;reason:string|null;actual_micros:number|null;reserved_micros:number;created_at:string;finished_at:string|null}[];corrections:{id:string;correction:string;created_at:string}[]}
export const api='/api/operator/learning'
export const money=(micros:number)=>new Intl.NumberFormat('en',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(micros/1e6)

export function protocolFromForm(d:FormData):Protocol {
 return {cohort:String(d.get('cohort')),denominator:d.get('denominator')===''?null:Number(d.get('denominator')),baseline:String(d.get('baseline')),window:String(d.get('window')),measure:String(d.get('measure')),dataSource:String(d.get('dataSource')),comparison:String(d.get('comparison')),limits:String(d.get('limits')),stopRule:String(d.get('stopRule')),budgetMicros:Math.round(Number(d.get('protocolBudget'))*1e6)}
}

export interface CommitmentArtifact {id:string;investigationId:string;createdAt:string;kind:'commitment';invalidated:boolean;invalidationReason:string|null;body:{selectedOption:Option;declinedOptions:Option[];protocol:Protocol;rationale:string;confidence:string;reviewAt:string;ownerOperatorId:string;interpretationVersion:number;observations:{id:string;wording:string;observed_at:string}[];status:string}}

export function learningReason(reason:string|null) {
 const descriptions:Record<string,string>={material_learning:'New permitted evidence changed the interpretation.',unchanged:'No material change since the previous check.',operator_correction:'Your correction is recorded. A new check will reassess the interpretation.',learning_model_unconfigured:'Interpretation is unconfigured. Original evidence is preserved; model work cannot proceed.',learning_source_unconfigured:'The selected source connection is unconfigured. Source work cannot proceed.',learning_call_budget_exceeded:'The next check exceeds its cost limit. It has stopped before model work.',learning_provider_revoked:'The source permission was revoked. Affected work has stopped.'}
 return reason?(descriptions[reason]??`The last check stopped: ${reason.replaceAll('_',' ')}.`):'No material learning recorded yet. Checks continue within the source and spend grant.'
}
