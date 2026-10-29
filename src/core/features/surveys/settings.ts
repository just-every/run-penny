import type {Hono} from 'hono'
import {z} from 'zod'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {integrationOperator} from '../integrations/destinations'
import {guardedDatabase} from '../integrations/guarded-database'
import {sessionGuard} from '../integrations/keys'
import {NativeError} from '../auth/native-tokens'
import {parseInput} from '../auth/native-routes'
import {audit} from '../decisions/write-support'
import {formInput,readForm,sourceId} from './model'
import {configured} from './transport'
export function registerSurveySettings(app:Hono<OperatorMutationEnvironment>){
 const path='/api/operator/integrations/surveys'
 app.use(path+'*',async(c,next)=>{c.header('Cache-Control','private, no-store');await next()})
 app.get(path,async c=>{
  const runtime=c.get('runtime'),{session,db}=await integrationOperator(runtime,c.req.raw)
  if(session.operator.role!=='owner')return c.json({canConfigure:false})
  const forms=(await db.prepare('SELECT f.*,(SELECT display_name FROM operators WHERE id=f.actor_id) owner_name FROM penny_survey_forms f ORDER BY f.id').all()).results
  return c.json({canConfigure:true,forms:forms.map(row=>({...row,mapping:JSON.parse(String(row.mapping_json)),configured:configured(runtime,{id:String(row.id),provider:formInput.shape.provider.parse(row.provider)})})),jobs:(await db.prepare('SELECT id,form_id,response_id,state,attempts,failure,evidence_id,updated_at FROM penny_survey_jobs ORDER BY updated_at DESC LIMIT 30').all()).results})
 })
 app.put(path,async c=>{
  const runtime=c.get('runtime'),{session,actor}=await integrationOperator(runtime,c.req.raw)
  if(session.operator.role!=='owner')throw new NativeError('owner_required',403)
  const input=await parseInput(c.req.raw,formInput)
  if(input.enabled&&!configured(runtime,input))throw new NativeError('survey_transport_unconfigured',503)
  const previous=await readForm(runtime.database.binding,input.id)
  if(previous&&(previous.provider!==input.provider||previous.form_id!==input.formId))throw new NativeError('survey_form_identity_immutable',409)
  const guard=sessionGuard(session);guard.sql+=" AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner')";guard.params.push(session.operatorId)
  guard.sql+=" AND NOT EXISTS(SELECT 1 FROM penny_survey_forms WHERE id=? AND (provider<>? OR form_id<>?))";guard.params.push(input.id,input.provider,input.formId)
  const db=guardedDatabase(runtime.database.binding,guard),now=new Date().toISOString()
  await db.batch([
   db.prepare("INSERT INTO penny_survey_forms(id,provider,form_id,mapping_json,response_url,owner_id,owner_version,actor_id,enabled,revision,purge_days,state,due_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET mapping_json=excluded.mapping_json,response_url=excluded.response_url,owner_id=excluded.owner_id,owner_version=excluded.owner_version,actor_id=excluded.actor_id,enabled=excluded.enabled,revision=penny_survey_forms.revision+1,purge_days=excluded.purge_days,state=excluded.state,due_at=excluded.due_at,cursor=NULL,claim=NULL,failure=NULL,updated_at=excluded.updated_at").bind(input.id,input.provider,input.formId,JSON.stringify(input.mapping),input.responseUrl,session.operatorId,session.operator.version,actor.id,input.enabled?1:0,input.purgeDays,input.enabled?'idle':'stopped',now,now),
   // A changed map cannot reuse a previously selected payload.
   db.prepare("UPDATE penny_survey_jobs SET state='stopped',claim=NULL,selected_json=NULL,failure='survey_configuration_changed',updated_at=? WHERE form_id=? AND state<>'done'").bind(now,input.id),
   audit(db,actor.id,'integration',input.id,input.enabled?'survey.configured':'survey.paused',now),
  ])
  return c.json({saved:true})
 })
 app.post(path+'/work',async c=>{
  const runtime=c.get('runtime'),{session,actor}=await integrationOperator(runtime,c.req.raw)
  if(session.operator.role!=='owner')throw new NativeError('owner_required',403)
  const input=await parseInput(c.req.raw,z.object({id:sourceId,action:z.enum(['retry','stop'])}).strict()),form=await readForm(runtime.database.binding,input.id)
  if(!form)throw new NativeError('survey_form_missing',404)
  if(input.action==='retry'&&(!form.enabled||!configured(runtime,form)))throw new NativeError('survey_capture_paused',409)
  const guard=sessionGuard(session);guard.sql+=" AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner') AND EXISTS(SELECT 1 FROM penny_survey_forms WHERE id=? AND revision=?)";guard.params.push(session.operatorId,form.id,form.revision)
  const db=guardedDatabase(runtime.database.binding,guard),now=new Date().toISOString()
  await db.batch([
   db.prepare("UPDATE penny_survey_forms SET owner_id=?,owner_version=?,actor_id=?,state=?,due_at=?,claim=NULL,failure=NULL,revision=revision+1,updated_at=? WHERE id=?").bind(session.operatorId,session.operator.version,actor.id,input.action==='retry'?'idle':'stopped',now,now,form.id),
   db.prepare("UPDATE penny_survey_jobs SET state=?,revision=?,claim=NULL,failure=NULL,updated_at=? WHERE form_id=? AND state<>'done'").bind(input.action==='retry'?'pending':'stopped',form.revision+1,now,form.id),
   audit(db,actor.id,'integration',form.id,'survey.'+input.action,now),
  ])
  return c.json({saved:true})
 })
}
