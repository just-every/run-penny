import {registerLearningControls} from './controls'
import type {Hono} from 'hono'
import {z} from 'zod'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {parseMutationBody} from '@/core/app/operator-mutations'
import {integrationOperator} from '../integrations/destinations'
import {NativeError} from '../auth/native-tokens'
import {sourceInput,investigationInput,commitInput} from './schema'
import {createSource,createInvestigation,commit,overview,investigationDto,artifactDto} from './service'
import {runInvestigation} from './run'
import {context} from './authority'
import {learningAudit} from './audit'
import {learningConfiguration} from './configuration'
import {observationView} from './presentation'
import type {Observation} from './schema'
import {redactionSettings,redactionFence} from '../redaction/settings'
import {redactLearningValue} from './redaction'
import {configuration} from './ports'
const root='/api/operator/learning'
export function registerLearningRoutes(app:Hono<OperatorMutationEnvironment>){
 registerLearningControls(app)
 app.get(root,async c=>c.json(await overview(c.get('runtime'),c.req.raw)))
 /** Whether this installation can run learning at all; the menu offers the page only when it can. */
 app.get(root+'/availability',async c=>{await integrationOperator(c.get('runtime'),c.req.raw);const {source,model}=configuration(c.get('runtime'));return c.json({available:source||model})})
 app.post(root+'/sources',async c=>{const input=await parseMutationBody(c,sourceInput);if(!input)return c.json({error:'validation_failed'},400);return c.json(await createSource(c.get('runtime'),c.req.raw,input),201)})
 app.post(root+'/investigations',async c=>{const input=await parseMutationBody(c,investigationInput);if(!input)return c.json({error:'validation_failed'},400);return c.json(await createInvestigation(c.get('runtime'),c.req.raw,input),201)})
 app.get(root+'/investigations/:id',async c=>{const {db}=await integrationOperator(c.get('runtime'),c.req.raw),id=c.req.param('id')!,{i}=await context(db,id);const result=await db.batch<Record<string,unknown>>(['learning_observations','learning_artifacts','learning_commitments','learning_runs','learning_corrections'].map(table=>db.prepare(`SELECT * FROM ${table} WHERE investigation_id=? ORDER BY created_at DESC LIMIT 201`).bind(id)));if(result.some(r=>r.results.length>200))throw new NativeError('learning_detail_limit',413);return c.json({investigation:investigationDto({...i}),observations:result[0].results.map(r=>({...r,investigationId:r.investigation_id,eventKey:r.event_key,contentHash:r.content_hash,observedAt:r.observed_at,sourcePersonId:r.source_person_id,requesterId:r.requester_id,accountId:r.account_id,original:JSON.parse(String(r.original_json)),presentation:observationView(r as unknown as Observation,learningConfiguration(c.get('runtime')).orbit)})),artifacts:result[1].results.map(r=>artifactDto(r,result[0].results as unknown as Observation[],learningConfiguration(c.get('runtime')).orbit)),commitments:result[2].results.map(r=>({...r,snapshot:JSON.parse(String(r.snapshot_json))})),runs:result[3].results,corrections:result[4].results})})
 app.post(root+'/investigations/:id/run',async c=>{const {db,actor}=await integrationOperator(c.get('runtime'),c.req.raw);return c.json(await runInvestigation(c.get('runtime'),c.req.param('id')!,'manual:'+crypto.randomUUID(),{db,actor:{operatorId:actor.id}}))})
 app.post(root+'/investigations/:id/commit',async c=>{const input=await parseMutationBody(c,commitInput);if(!input)return c.json({error:'validation_failed'},400);return c.json(await commit(c.get('runtime'),c.req.raw,c.req.param('id')!,input),201)})
 app.post(root+'/investigations/:id/correct',async c=>{
  const {db,actor}=await integrationOperator(c.get('runtime'),c.req.raw),input=await parseMutationBody(c,z.object({interpretationId:z.string(),correction:z.string().trim().min(1).max(4000)}).strict());if(!input)return c.json({error:'validation_failed'},400)
  const id=c.req.param('id')!,correctionId=crypto.randomUUID(),guard=crypto.randomUUID()
  const rules=await redactionSettings(db),fence=redactionFence(db,rules.revision),correction=redactLearningValue({correction:input.correction},rules).correction
  if(!await db.prepare("SELECT id FROM learning_artifacts WHERE id=? AND investigation_id=? AND state='current'").bind(input.interpretationId,id).first())throw new NativeError('learning_interpretation_stale',409)
  const result=await db.batch([
   fence.before,
   db.prepare("INSERT INTO penny_integration_guards(id,allowed) VALUES(?,EXISTS(SELECT 1 FROM learning_artifacts WHERE id=? AND investigation_id=? AND state='current'))").bind(guard,input.interpretationId,id),
   db.prepare("UPDATE learning_artifacts SET state='contested' WHERE id=? AND investigation_id=? AND state='current' RETURNING id").bind(input.interpretationId,id),
   db.prepare('INSERT INTO learning_corrections(id,investigation_id,artifact_id,correction,actor_id,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1').bind(correctionId,id,input.interpretationId,correction,actor.id,new Date().toISOString()),
   db.prepare("UPDATE learning_investigations SET version=version+1,last_reason='operator_correction',next_run_at=? WHERE id=? AND EXISTS(SELECT 1 FROM learning_corrections WHERE id=?)").bind(new Date().toISOString(),id,correctionId),
   learningAudit(db,{operatorId:actor.id},'learning_investigation',id,'learning.corrected',{interpretationId:input.interpretationId,correctionId}),
   db.prepare('DELETE FROM penny_integration_guards WHERE id=?').bind(guard),
   fence.after,
  ])
  if(!result[2].results.length)throw new NativeError('learning_interpretation_stale',409)
  return c.json({ok:true})
 })
 app.post(root+'/artifacts/:id/defer',async c=>{
  const {db,actor}=await integrationOperator(c.get('runtime'),c.req.raw),id=c.req.param('id')!,artifact=await db.prepare("SELECT investigation_id FROM learning_artifacts WHERE id=? AND state='current' AND deferred=0").bind(id).first<{investigation_id:string}>()
  if(!artifact)throw new NativeError('learning_interpretation_stale',409)
  const guard=crypto.randomUUID()
  await db.batch([db.prepare("INSERT INTO penny_integration_guards(id,allowed) VALUES(?,EXISTS(SELECT 1 FROM learning_artifacts WHERE id=? AND state='current' AND deferred=0))").bind(guard,id),db.prepare('UPDATE learning_artifacts SET deferred=1 WHERE id=?').bind(id),learningAudit(db,{operatorId:actor.id},'learning_investigation',artifact.investigation_id,'learning.deferred',{interpretationId:id}),db.prepare('DELETE FROM penny_integration_guards WHERE id=?').bind(guard)])
  return c.json({ok:true})
 })
}
