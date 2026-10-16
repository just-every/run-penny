import type { ImportPlan, SourceRecord } from '../../../../base/modules/import-kit/src/types'
import type { NativeImportValue } from './types'
import { asObject } from './mapping-support'
import { uservoiceAccumulator,type UserVoiceReceipt } from './uservoice-receipt'

export interface FeedbackReceipt {
 phase:string
 sources:{kind:string;read:number;generated:number;eligible:number;applied:number;reused:number;skipped:{reason:string;count:number}[]}[]
 destinations:{table:string;planned:number;created:number;removed:number;retained:number}[]
 omissions:{kind:string;field:string;count:number;reason:string}[]
 aggregates:{field:string;category:string;total:number|null;rows:number}[]
 unresolved:{kind:string;sourceId:string;field:string;target:string}[]
 identities:{kind:string;treatment:string}[]
 effects:{mail:number;notifications:number}
 originalsRetained:boolean
 conflicts:{kind:string;sourceId:string;reason:string}[]
 uservoice?:UserVoiceReceipt
}
export function feedbackReceipt(plans:Iterable<ImportPlan>,phase='preview',committed=new Map<string,{owned:boolean;reversed:boolean}>()):FeedbackReceipt {
 const accumulator=receiptAccumulator(phase,committed);for(const plan of plans)accumulator.add(plan);return accumulator.finish()
}
export function receiptAccumulator(phase='preview',committed=new Map<string,{owned:boolean;reversed:boolean}>()){
 const sources=new Map<string,FeedbackReceipt['sources'][number]>(),destinations=new Map<string,FeedbackReceipt['destinations'][number]>(),omissions=new Map<string,FeedbackReceipt['omissions'][number]>(),aggregates=new Map<string,FeedbackReceipt['aggregates'][number]>(),unresolved:FeedbackReceipt['unresolved']=[]
 const history=uservoiceAccumulator(),parents=new Map<string,string>(),votes:{request:string;requester:string;owned:boolean;reversed:boolean}[]=[]
 const sourceKind=(kind:string)=>{const source=sources.get(kind)??{kind,read:0,generated:0,eligible:0,applied:0,reused:0,skipped:[]};sources.set(kind,source);return source}
 const skipped=(source:FeedbackReceipt['sources'][number],reason:string)=>{const prior=source.skipped.find(item=>item.reason===reason);if(prior)prior.count++;else source.skipped.push({reason,count:1})}
 const add=(plan:ImportPlan)=>{
  for(const issue of plan.diagnostics.filter(d=>d.code==='UNRESOLVED_REFERENCE'))unresolved.push({kind:issue.kind!,sourceId:issue.sourceId!,field:issue.field!,target:issue.message})
  const key=(record:SourceRecord)=>JSON.stringify([record.kind,record.sourceId]),entries=new Map(plan.entries.map(entry=>[key(entry.source),entry])),seen=new Set<string>()
  // Base keeps every original source record while deduplicating applied entries.
  // Read counts, aggregate cells and retained-only omissions belong to each row.
  for(const record of plan.source.records){
   const kind=record.kind,source=sourceKind(kind),identity=key(record),entry=entries.get(identity)
   const generated=record.location.pointer?.startsWith('penny:generated:')||kind==='users'&&record.sourceId.startsWith('csv-author:')&&record.location.artifact.endsWith('.csv')||record.location.artifact==='owner-board-mapping.json'
   source.read+=Number(!generated);source.generated+=Number(generated)
   if(seen.has(identity))skipped(source,'Identical duplicate source row; one native entry retained.')
   seen.add(identity)
   for(const item of entry?.unmapped??[]){const field=item.field??'(source row)',key=JSON.stringify([kind,field,item.reason]),prior=omissions.get(key)??{kind,field,reason:item.reason,count:0};prior.count++;omissions.set(key,prior)}
   aggregateRecord(record,aggregates);history.add(record)
  }
  for(const entry of plan.entries){
   const source=sourceKind(entry.source.kind);source.eligible+=Number(entry.effects.length>0&&!entry.rejection)
   const state=committed.get(entry.identity)
   if(state){if(state.owned)source.applied+=Number(entry.effects.length>0);else source.reused++}
   if(entry.rejection||!entry.effects.length)skipped(source,entry.rejection??entry.unmapped[0]?.reason??'No mapped effects')
   for(const effect of entry.effects)for(const row of (effect.value as unknown as NativeImportValue).rows){
    if(row.table==='requests'&&row.values.merged_into_request_id)parents.set(String(row.values.id),String(row.values.merged_into_request_id))
    if(row.table==='request_vote_contributions')votes.push({request:String(row.values.request_id),requester:String(row.values.requester_id),owned:Boolean(state?.owned),reversed:Boolean(state?.reversed)})
    const item=destinations.get(row.table)??{table:row.table,planned:0,created:0,removed:0,retained:0};item.planned++
    if(state?.owned){item.created++;if(state.reversed)item.removed++;else item.retained++}destinations.set(row.table,item)
   }
  }
 }
 const finish=():FeedbackReceipt=>{
 const uservoice=history.finish()
 const plannedVotes=new Set<string>(),createdVotes=new Set<string>(),retainedVotes=new Set<string>()
 for(const vote of votes){let request=vote.request;const visited=new Set<string>();while(parents.has(request)&&!visited.has(request)){visited.add(request);request=parents.get(request)!}const key=request+':'+vote.requester;plannedVotes.add(key);if(vote.owned){createdVotes.add(key);if(!vote.reversed)retainedVotes.add(key)}}
 if(votes.length)destinations.set('request_votes',{table:'request_votes',planned:plannedVotes.size,created:createdVotes.size,removed:createdVotes.size-retainedVotes.size,retained:retainedVotes.size})
 return {phase,sources:[...sources.values()],destinations:[...destinations.values()],omissions:[...omissions.values()],aggregates:[...aggregates.values()],unresolved,identities:[...sources.keys()].map(kind=>({kind,treatment:kind==='users'?'Historical, non-authorizing contributors only: no login, verified identity, consent or outreach audience.':'Historical evidence only: no login, verified identity, consent, outreach audience or commercial authority.'})),effects:{mail:0,notifications:0},originalsRetained:true,conflicts:[],...(uservoice?{uservoice}:{})}
 };return {add,finish}
}
function aggregateRecord(record:SourceRecord,result:Map<string,FeedbackReceipt['aggregates'][number]>):void {
 const payload=asObject(record.payload)
 const cells=payload._format==='ideas-csv'||payload._format==='uservoice-ideas-csv'?asObject(payload._format==='ideas-csv'?payload._idea:payload._uservoice).aggregates as {field:string;category:string;value:number|string}[]:payload._format==='classic-csv'?['Score (Total Votes)','Comment Count','Company Count','Associated MRR'].filter(field=>field in payload&&payload[field]!=='').map(field=>({field,category:field==='Associated MRR'?'revenue':'count',value:Number(payload[field])})):[]
 for(const cell of cells){const key=JSON.stringify([cell.field,cell.category]),prior=result.get(key)??{field:cell.field,category:cell.category,total:cell.category==='company'?null:0,rows:0};prior.rows++;if(prior.total!==null)prior.total+=Number(cell.value);result.set(key,prior)}
}
