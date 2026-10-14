import {purge} from './privacy'
import {learningConfiguration} from './configuration'
import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError,digest} from '../auth/native-tokens'
import {guardedDatabase} from '../integrations/guarded-database'
import {context,scopeGuard,assertScope} from './authority'
import {acquire,retain} from './acquisition'
import {interpret} from './ports'
import {validateLearning} from './validation'
import {canonical} from '../data/archive'

/** The event key is supplied by the initiating HTTP event or scheduled window;
 * the durable claim is never retried after an ambiguous paid call. */
export async function runInvestigation(runtime:PennyRuntime,id:string,eventKey:string,operatorDb?:D1Database){
 const native=runtime.database.binding,{i,s}=await context(operatorDb??native,id)
 await assertScope(native,i,s)
 const epoch=await native.prepare('SELECT epoch FROM data_state WHERE singleton=1').first<number>('epoch'),guard=scopeGuard(i,s)
 const db=guardedDatabase(operatorDb??native,{sql:`(${guard.sql}) AND EXISTS(SELECT 1 FROM data_state WHERE epoch=?)`,params:[...guard.params,epoch!]})
 const prior=await db.prepare('SELECT id,state,reason FROM learning_runs WHERE investigation_id=? AND event_key=?').bind(id,eventKey).first()
 if(prior)return {replayed:true,run:prior}
 const runId=crypto.randomUUID(),claim=crypto.randomUUID(),now=new Date().toISOString()
 try{
 await db.batch([
  db.prepare(`INSERT INTO penny_integration_guards(id,allowed) VALUES(?,EXISTS(SELECT 1 FROM learning_investigations WHERE id=? AND spent_micros+max_run_cost_micros<=budget_micros))`).bind(claim,id),
  db.prepare('UPDATE learning_investigations SET spent_micros=spent_micros+max_run_cost_micros,next_run_at=?,last_reason=NULL WHERE id=?').bind(new Date(Date.now()+i.interval_minutes*60000).toISOString(),id),
  db.prepare("INSERT INTO learning_runs(id,investigation_id,event_key,claim,grant_version,state,reserved_micros,created_at) VALUES(?,?,?,?,?,'running',?,?)").bind(runId,id,eventKey,claim,i.version,i.max_run_cost_micros,now),
  db.prepare('DELETE FROM penny_integration_guards WHERE id=?').bind(claim),
 ])
 }catch(error){if(String(error).includes('UNIQUE'))return {replayed:true,reason:'already_claimed'};throw error}
 let paid=false
 try{
  const config=learningConfiguration(runtime)
  if(!config.model||!runtime.bindings.PENNY_LEARNING_EGRESS)throw new NativeError('learning_model_unconfigured',503)
  const sourceCost=s.provider==='orbit'?(config.orbit?.readCostMicros??0)*(JSON.parse(s.resource_ids_json) as string[]).length:0
  if(sourceCost>=i.max_run_cost_micros)throw new NativeError('learning_call_budget_exceeded',409)
  if(sourceCost>0)paid=true
  const records=await acquire(runtime,db,i,s),observations=await retain(db,i,s,records)
  const corrections=(await db.prepare('SELECT id,correction FROM learning_corrections WHERE investigation_id=? ORDER BY created_at,id').bind(id).all()).results
  // A repeated input after a correction is a new interpretation, never a revival
  // of the invalidated immutable artifact or its committed snapshot.
  const predecessor=await db.prepare("SELECT id FROM learning_artifacts WHERE investigation_id=? AND state<>'current' ORDER BY version DESC LIMIT 1").bind(id).first<string>('id')
  const inputHash=await digest(canonical({observations:observations.map(o=>[o.id,o.content_hash]),corrections,predecessor}))
  const known=await db.prepare("SELECT id FROM learning_artifacts WHERE investigation_id=? AND input_hash=? AND state='current'").bind(id,inputHash).first<{id:string}>()
  if(known){await finish(sourceCost,'unchanged');return {runId,unchanged:true,artifactId:known.id}}
  await assertScope(native,i,s)
  // This db read also rechecks native session and erasure epoch immediately before paid work.
  await db.prepare('SELECT 1').first()
  const generated=await interpret(runtime,{question:i.question,purpose:i.purpose,observations:observations.map(o=>({id:o.id,wording:o.wording,observedAt:o.observed_at,requesterId:o.requester_id,accountId:o.account_id})),corrections,budgetMicros:i.budget_micros-i.spent_micros},i.max_run_cost_micros-sourceCost,async()=>{await db.prepare('SELECT 1').first();paid=true})
  generated.costMicros+=sourceCost
  const body=validateLearning(generated.output,observations,i.budget_micros-i.spent_micros),artifactId=crypto.randomUUID()
  const guards=records.flatMap(record=>record.nativeGuard?[db.prepare(`INSERT INTO penny_integration_guards(id,allowed) VALUES(?,(${record.nativeGuard.sql}))`).bind(crypto.randomUUID(),...record.nativeGuard.params)]:[])
  await db.batch([...guards,
   db.prepare("UPDATE learning_artifacts SET state='superseded' WHERE investigation_id=? AND state='current'").bind(id),
   db.prepare("INSERT INTO learning_artifacts(id,investigation_id,version,input_hash,body_json,state,created_at) SELECT ?,?,COALESCE(MAX(version),0)+1,?,?,'current',? FROM learning_artifacts WHERE investigation_id=?").bind(artifactId,id,inputHash,JSON.stringify(body),new Date().toISOString(),id),
   ...observations.map(o=>db.prepare('INSERT INTO learning_contributions(artifact_id,observation_id) VALUES(?,?)').bind(artifactId,o.id)),
   db.prepare("UPDATE learning_runs SET state='complete',actual_micros=?,reason='material_learning',cursor_json=?,finished_at=? WHERE id=? AND claim=? AND state='running'").bind(generated.costMicros,JSON.stringify(observations.map(o=>({eventKey:o.event_key,contentHash:o.content_hash}))),new Date().toISOString(),runId,claim),
   db.prepare("UPDATE learning_investigations SET spent_micros=spent_micros-?+?,last_reason=? WHERE id=?").bind(i.max_run_cost_micros,generated.costMicros,'material_learning',id),
   db.prepare('DELETE FROM penny_integration_guards'),
  ])
  return {runId,artifactId,unchanged:false}
 }catch(error){
  const reason=error instanceof NativeError?error.code:'learning_output_or_source_invalid'
  // Record uncertainty without retaining model/provider exception strings. A
  // revoke/erase may have removed the run, in which case this writes nothing.
  await native.batch([native.prepare("UPDATE learning_runs SET state=?,reason=?,actual_micros=?,finished_at=? WHERE id=? AND claim=? AND state='running'").bind(paid?'uncertain':'refused',reason,paid?null:0,new Date().toISOString(),runId,claim),native.prepare('UPDATE learning_investigations SET last_reason=?,spent_micros=spent_micros-? WHERE id=? AND version=?').bind(reason,paid?0:i.max_run_cost_micros,id,i.version)])
  if(reason==='learning_provider_revoked'){
   const revoked=(await native.prepare("SELECT id FROM learning_sources WHERE provider='orbit' AND installation_id IS ? AND state='active'").bind(s.installation_id).all<{id:string}>()).results
   for(const source of revoked)await purge(native,source.id)
  }
  throw error instanceof NativeError?error:new NativeError(reason,409)
 }
 async function finish(cost:number,reason:string){await db.batch([db.prepare("UPDATE learning_runs SET state='complete',actual_micros=?,reason=?,finished_at=? WHERE id=? AND claim=? AND state='running'").bind(cost,reason,new Date().toISOString(),runId,claim),db.prepare('UPDATE learning_investigations SET spent_micros=spent_micros-?+?,last_reason=? WHERE id=?').bind(i.max_run_cost_micros,cost,reason,id)])}
}
