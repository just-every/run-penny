import type {Hono} from 'hono'
import {z} from 'zod'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {parseMutationBody} from '@/core/app/operator-mutations'
import {integrationOperator} from '../integrations/destinations'
import {NativeError} from '../auth/native-tokens'
import {context} from './authority'
import {purge} from './privacy'
const root='/api/operator/learning'
export function registerLearningControls(app:Hono<OperatorMutationEnvironment>){
 app.post(root+'/control',async c=>{const {db}=await integrationOperator(c.get('runtime'),c.req.raw);if(!await parseMutationBody(c,z.object({action:z.literal('pause')}).strict()))return c.json({error:'validation_failed'},400);await db.batch([db.prepare("UPDATE learning_investigations SET state='paused',version=version+1,last_reason='operator_paused_all' WHERE state='active'"),db.prepare("UPDATE learning_runs SET state='uncertain',reason='operator_paused_all' WHERE state='running'")]);return c.json({ok:true})})
 app.post(root+'/investigations/:id/control',async c=>{
  const {db,session,actor}=await integrationOperator(c.get('runtime'),c.req.raw),input=await parseMutationBody(c,z.object({action:z.enum(['pause','resume','revoke'])}).strict());if(!input)return c.json({error:'validation_failed'},400)
  const {i,s}=await context(db,c.req.param('id')!)
  if(input.action==='revoke'){await purge(db,s.id,undefined,i.id);return c.json({ok:true})}
  if(input.action==='resume'&&(s.state!=='active'||i.state==='revoked'||i.expires_at<=new Date().toISOString()||i.spent_micros+i.max_run_cost_micros>i.budget_micros))throw new NativeError('learning_resume_requires_new_grant',409)
  await db.batch([db.prepare('UPDATE learning_investigations SET state=?,version=version+1,native_operator_id=?,operator_version=?,actor_id=?,last_reason=?,next_run_at=? WHERE id=?').bind(input.action==='pause'?'paused':'active',session.operatorId,session.operator.version,actor.id,'operator_'+input.action,new Date().toISOString(),i.id),db.prepare("UPDATE learning_runs SET state='uncertain',reason='operator_control' WHERE investigation_id=? AND state='running'").bind(i.id)])
  return c.json({ok:true})
 })
 app.post(root+'/sources/:id/disconnect',async c=>{const {db}=await integrationOperator(c.get('runtime'),c.req.raw);await purge(db,c.req.param('id')!);return c.json({ok:true})})
 app.post(root+'/sources/:id/erase-person',async c=>{const {db}=await integrationOperator(c.get('runtime'),c.req.raw),input=await parseMutationBody(c,z.object({sourcePersonId:z.string().min(1).max(200)}).strict());if(!input)return c.json({error:'validation_failed'},400);await purge(db,c.req.param('id')!,input.sourcePersonId);return c.json({ok:true})})
 app.post(root+'/investigations/:id/source',async c=>{const {db,session,actor}=await integrationOperator(c.get('runtime'),c.req.raw),input=await parseMutationBody(c,z.object({sourceId:z.string().min(1)}).strict());if(!input)return c.json({error:'validation_failed'},400);const {i,s}=await context(db,c.req.param('id')!);if(s.provider!=='native'||i.state==='revoked'||!await db.prepare("SELECT 1 FROM learning_sources WHERE id=? AND state='active'").bind(input.sourceId).first())throw new NativeError('learning_source_change_refused',409);await db.batch([db.prepare("UPDATE learning_investigations SET source_id=?,version=version+1,native_operator_id=?,operator_version=?,actor_id=?,last_reason='source_connected' WHERE id=?").bind(input.sourceId,session.operatorId,session.operator.version,actor.id,i.id),db.prepare("UPDATE learning_artifacts SET state='contested' WHERE investigation_id=?").bind(i.id)]);return c.json({ok:true})})
}
