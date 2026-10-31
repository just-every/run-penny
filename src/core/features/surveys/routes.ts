import type {Hono} from 'hono'
import {z} from 'zod'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {NativeError} from '../auth/native-tokens'
import {boundedRawBody} from '../integrations/raw-body'
import {guardedDatabase} from '../integrations/guarded-database'
import {captureGuard,readForm,sourceId} from './model'
import {credential,configured} from './transport'
import {verifySurvey} from './signatures'
import {typeformResponse} from './providers'
import {enqueueSurvey} from './intake'
import {registerSurveySettings} from './settings'
export function registerSurveyRoutes(app:Hono<OperatorMutationEnvironment>){
 registerSurveySettings(app)
 app.get('/api/integrations/surveys/:id',async c=>{
  c.header('Cache-Control','private, no-store')
  const form=await readForm(c.get('runtime').database.binding,c.req.param('id'))
  return c.body(null,form?.provider==='surveymonkey'&&form.enabled&&configured(c.get('runtime'),form)?200:404)
 })
 app.post('/api/integrations/surveys/:id',async c=>{
  c.header('Cache-Control','private, no-store')
  const runtime=c.get('runtime'),id=sourceId.safeParse(c.req.param('id'))
  if(!id.success)throw new NativeError('survey_form_missing',404)
  const form=await readForm(runtime.database.binding,id.data)
  if(!form)throw new NativeError('survey_form_missing',404)
  if(!form.enabled||form.state==='stopped'||form.state==='held')throw new NativeError('survey_capture_paused',409)
  if(form.provider==='google')throw new NativeError('survey_webhook_unsupported',400)
  const config=credential(runtime,form.id)
  if(!configured(runtime,form)||!config.webhookSecret)throw new NativeError('survey_transport_unconfigured',503)
  const raw=await boundedRawBody(c.req.raw,262144)
  await verifySurvey(c.req.raw,raw,form.provider,config.webhookSecret,config.clientId)
  let value:unknown;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw))}catch{throw new NativeError('survey_payload_invalid',400)}
  if(form.provider==='typeform'){
   const envelope=z.object({event_type:z.literal('form_response'),form_response:z.unknown()}).safeParse(value)
   if(!envelope.success)throw new NativeError('survey_payload_invalid',400)
   let response;try{response=typeformResponse(envelope.data.form_response,form.form_id)}catch{throw new NativeError('survey_payload_invalid',400)}
   return c.json(await enqueueSurvey(runtime,form,response.id,response),202)
  }
  let responseId:string,removed=false
  if(form.provider==='surveymonkey'){
   const parsed=z.object({event_type:z.enum(['response_completed','response_updated','response_deleted']),object_id:sourceId,resources:z.object({survey_id:sourceId})}).safeParse(value)
   if(!parsed.success||parsed.data.resources.survey_id!==form.form_id)throw new NativeError('survey_scope_mismatch',403)
   responseId=parsed.data.object_id;removed=parsed.data.event_type==='response_deleted'
  }else{
   const parsed=z.object({id:sourceId,type:z.enum(['response.created','response.updated','response.deleted']),formId:sourceId,responseId:sourceId.nullable()}).safeParse(value)
   if(!parsed.success||parsed.data.formId!==form.form_id)throw new NativeError('survey_scope_mismatch',403)
   responseId=parsed.data.responseId??'';removed=parsed.data.type==='response.deleted'
   // Pencil erases the response ID after successful deletion delivery; such a
   // notification cannot identify a capture and must not erase another one.
   if(!responseId)return c.json({accepted:true,duplicate:true},202)
  }
  if(removed){
   const state=await runtime.database.binding.prepare("SELECT epoch FROM data_state WHERE singleton=1 AND phase='idle'").first<{epoch:number}>()
   if(!state)throw new NativeError('data_operation_in_progress',409)
   const db=guardedDatabase(runtime.database.binding,captureGuard(form,state.epoch)),now=new Date().toISOString()
   await db.batch([
    db.prepare("UPDATE penny_survey_sources SET source_state='removed',removed_at=?,purge_at=? WHERE job_id IN(SELECT id FROM penny_survey_jobs WHERE form_id=? AND response_id=?) AND source_state IN('current','changed')").bind(now,new Date(Date.now()+form.purge_days*86400000).toISOString(),form.id,responseId),
    db.prepare("UPDATE penny_survey_jobs SET state='stopped',selected_json=NULL,claim=NULL,failure='survey_source_removed' WHERE form_id=? AND response_id=? AND evidence_id IS NULL").bind(form.id,responseId),
   ])
   return c.json({accepted:true},202)
  }
  return c.json(await enqueueSurvey(runtime,form,responseId),202)
 })
}
