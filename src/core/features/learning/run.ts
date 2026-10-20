import {selected} from '../ai/configuration'
import {reserve,settle,failReservation,type Reservation} from '../ai/budget'
import {purge} from './privacy'
import {learningConfiguration} from './configuration'
import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError,digest} from '../auth/native-tokens'
import {guardedDatabase} from '../integrations/guarded-database'
import {context,scopeGuard,assertScope} from './authority'
import {acquire,retain} from './acquisition'
import {interpret} from './ports'
import {validateLearning} from './validation'
import {citationRanges,observationOriginal} from './source-content'
import {canonical} from '../data/archive'
import {learningRunJournalGuard} from './journal'
import {learningAudit,systemLearningAudit,type LearningActor} from './audit'

/** The event key is supplied by the initiating HTTP event or scheduled window;
 * the durable claim is never retried after an ambiguous paid call. */
export async function runInvestigation(runtime:PennyRuntime,id:string,eventKey:string,execution:{db:D1Database;actor:LearningActor}){
 const native=runtime.database.binding,{i,s}=await context(execution.db,id)
 await assertScope(native,i,s)
 const state=(await native.prepare('SELECT origin,epoch FROM data_state WHERE singleton=1').first<{origin:string;epoch:number}>())!,guard=scopeGuard(i,s),journal=learningRunJournalGuard(state.origin,state.epoch)
 const db=guardedDatabase(execution.db,{sql:`(${guard.sql}) AND (${journal.sql})`,params:[...guard.params,...journal.params]})
 const prior=await db.prepare('SELECT id,state,reason FROM learning_runs WHERE investigation_id=? AND event_key=?').bind(id,eventKey).first()
 if(prior)return {replayed:true,run:prior}
 const runId=crypto.randomUUID(),claim=crypto.randomUUID(),now=new Date().toISOString()
 try{
 await db.batch([
  db.prepare(`INSERT INTO penny_integration_guards(id,allowed) VALUES(?,EXISTS(SELECT 1 FROM learning_investigations WHERE id=? AND spent_micros+max_run_cost_micros<=budget_micros))`).bind(claim,id),
  db.prepare('UPDATE learning_investigations SET spent_micros=spent_micros+max_run_cost_micros,next_run_at=?,last_reason=NULL WHERE id=?').bind(new Date(Date.now()+i.interval_minutes*60000).toISOString(),id),
  db.prepare("INSERT INTO learning_runs(id,investigation_id,event_key,claim,grant_version,state,reserved_micros,created_at) VALUES(?,?,?,?,?,'running',?,?)").bind(runId,id,eventKey,claim,i.version,i.max_run_cost_micros,now),
  learningAudit(db,execution.actor,'learning_investigation',id,'learning.run_requested',{runId,grantVersion:i.version}),
  db.prepare('DELETE FROM penny_integration_guards WHERE id=?').bind(claim),
 ])
 }catch(error){if(String(error).includes('UNIQUE'))return {replayed:true,reason:'already_claimed'};throw error}
 let paid=false,reservation:Reservation|undefined
 try{
  const config=learningConfiguration(runtime)
  if(!runtime.bindings.PENNY_AI||!runtime.bindings.PENNY_LEARNING_EGRESS)throw new NativeError('learning_model_unconfigured',503)
  const sourceCost=s.provider==='orbit'?(config.orbit?.readCostMicros??0)*(JSON.parse(s.resource_ids_json) as string[]).length:0
  if(sourceCost>=i.max_run_cost_micros)throw new NativeError('learning_call_budget_exceeded',409)
  const model=await selected(runtime,db,'learning')
  reservation=await reserve(db,'learning',model.provider,model.id,i.max_run_cost_micros,sourceCost)
  if(sourceCost>0)paid=true
  const records=await acquire(runtime,db,i,s);let observations=await retain(db,i,s,records)
  const corrections=(await db.prepare('SELECT id,correction FROM learning_corrections WHERE investigation_id=? ORDER BY created_at,id').bind(id).all()).results
  // A repeated input after a correction is a new interpretation, never a revival
  // of the invalidated immutable artifact or its committed snapshot.
  const predecessor=await db.prepare("SELECT id FROM learning_artifacts WHERE investigation_id=? AND state<>'current' ORDER BY version DESC LIMIT 1").bind(id).first<string>('id')
  const hashInput=()=>digest(canonical({observations:observations.map(o=>[o.id,o.content_hash]),corrections,predecessor}));let inputHash=await hashInput()
  const known=await db.prepare("SELECT id FROM learning_artifacts WHERE investigation_id=? AND input_hash=? AND state='current'").bind(id,inputHash).first<{id:string}>()
  if(known){await finish(sourceCost,'unchanged');return {runId,unchanged:true,artifactId:known.id}}
  if(observations.some(o=>observationOriginal(o)?.normalized===false)){observations=await retain(db,i,s,records,false);inputHash=await hashInput()}
  if(!observations.some(o=>citationRanges(o).length))throw new NativeError('learning_source_content_missing',409)
  await assertScope(native,i,s)
  // This db read also rechecks native session and erasure journal before paid work.
  await db.prepare('SELECT 1').first()
  const generated=await interpret(runtime,db,{question:i.question,purpose:i.purpose,observations:observations.map(o=>({id:o.id,wording:o.wording,citableRanges:citationRanges(o),observedAt:o.observed_at,requesterId:o.requester_id,accountId:o.account_id})),corrections,budgetMicros:i.budget_micros-i.spent_micros},i.max_run_cost_micros-sourceCost,async()=>{await db.prepare('SELECT 1').first();paid=true},reservation)
  generated.costMicros+=sourceCost
  const body=validateLearning(generated.output,observations,i.budget_micros-i.spent_micros),artifactId=crypto.randomUUID()
  const guards=records.flatMap(record=>record.nativeGuard?[db.prepare(`INSERT INTO penny_integration_guards(id,allowed) VALUES(?,(${record.nativeGuard.sql}))`).bind(crypto.randomUUID(),...record.nativeGuard.params)]:[])
  await db.batch([...guards,
   db.prepare("UPDATE learning_artifacts SET state='superseded' WHERE investigation_id=? AND state='current'").bind(id),
   db.prepare("INSERT INTO learning_artifacts(id,investigation_id,version,input_hash,body_json,state,created_at) SELECT ?,?,COALESCE(MAX(version),0)+1,?,?,'current',? FROM learning_artifacts WHERE investigation_id=?").bind(artifactId,id,inputHash,JSON.stringify(body),new Date().toISOString(),id),
   ...observations.map(o=>db.prepare('INSERT INTO learning_contributions(artifact_id,observation_id) VALUES(?,?)').bind(artifactId,o.id)),
   db.prepare("UPDATE learning_runs SET state='complete',actual_micros=?,reason='material_learning',cursor_json=?,finished_at=? WHERE id=? AND claim=? AND state='running'").bind(generated.costMicros,JSON.stringify(observations.map(o=>({eventKey:o.event_key,contentHash:o.content_hash}))),new Date().toISOString(),runId,claim),
   db.prepare("UPDATE learning_investigations SET spent_micros=spent_micros-?+?,last_reason=? WHERE id=?").bind(i.max_run_cost_micros,generated.costMicros,'material_learning',id),
   learningAudit(db,execution.actor,'learning_investigation',id,'learning.run_completed',{runId,interpretationId:artifactId,unchanged:false}),
   db.prepare('DELETE FROM penny_integration_guards'),
  ])
  return {runId,artifactId,unchanged:false}
 }catch(error){
  const reason=error instanceof NativeError?error.code:'learning_output_or_source_invalid'
  if(reservation)await failReservation(native,reservation,paid)
  // Record uncertainty without retaining model/provider exception strings. A
  // revoke/erase may have removed the run, in which case this writes nothing.
  await native.batch([native.prepare("UPDATE learning_runs SET state=?,reason=?,actual_micros=?,finished_at=? WHERE id=? AND claim=? AND state='running'").bind(paid?'uncertain':'refused',reason,paid?null:0,new Date().toISOString(),runId,claim),systemLearningAudit(native,'learning.run','learning_investigation',id,'learning.run_failed',{runId,reason},true),native.prepare('UPDATE learning_investigations SET last_reason=?,spent_micros=spent_micros-? WHERE id=? AND version=?').bind(reason,paid?0:i.max_run_cost_micros,id,i.version)])
  if(reason==='learning_provider_revoked'){
   const revoked=(await native.prepare("SELECT id FROM learning_sources WHERE provider='orbit' AND installation_id IS ? AND state='active'").bind(s.installation_id).all<{id:string}>()).results
   for(const source of revoked)await purge(native,source.id,{actor:{system:'learning.provider_revocation'},action:'learning.provider_revoked'})
  }
  throw error instanceof NativeError?error:new NativeError(reason,409)
 }
 async function finish(cost:number,reason:string){if(reservation)await settle(native,reservation,cost);await db.batch([db.prepare("UPDATE learning_runs SET state='complete',actual_micros=?,reason=?,finished_at=? WHERE id=? AND claim=? AND state='running'").bind(cost,reason,new Date().toISOString(),runId,claim),db.prepare('UPDATE learning_investigations SET spent_micros=spent_micros-?+?,last_reason=? WHERE id=?').bind(i.max_run_cost_micros,cost,reason,id),learningAudit(db,execution.actor,'learning_investigation',id,'learning.run_completed',{runId,unchanged:true})])}
}
