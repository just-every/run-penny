import type {Hono} from 'hono'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {parseInput} from '../auth/native-routes'
import {NativeError} from '../auth/native-tokens'
import {audit} from '../decisions/write-support'
import {connect,connectionInput,ownerConfiguration} from './configuration'
import {receive} from './ingress'
import {z} from 'zod'

export function registerChatCapture(app:Hono<OperatorMutationEnvironment>){
 const root='/api/operator/integrations/chat'
 app.get(root,async c=>{
  const {db}=await ownerConfiguration(c.get('runtime'),c.req.raw)
  const connections=(await db.prepare('SELECT id,team_id,app_id,channels_json,mappings_json,reaction,purge_days,state,last_success_at,last_failure FROM penny_chat_connections ORDER BY created_at').all()).results
  const jobs=(await db.prepare('SELECT id,connection_id,channel_id,message_ts,capturer,kind,state,attempts,due_at,failure FROM penny_chat_jobs ORDER BY created_at DESC,id LIMIT 100').all()).results
  return c.json({connections,jobs,transport:c.env.PENNY_EGRESS?'configured':'configuration-disabled'})
 })
 app.post(root,async c=>c.json(await connect(c.get('runtime'),c.req.raw,await parseInput(c.req.raw,connectionInput)),201))
 app.post(root+'/:id/state',async c=>{
  const {db,actor}=await ownerConfiguration(c.get('runtime'),c.req.raw),{state}=await parseInput(c.req.raw,z.object({state:z.enum(['active','paused','revoked'])}).strict()),id=c.req.param('id')!
  if(!await db.prepare("SELECT 1 FROM penny_chat_connections WHERE id=? AND state<>'revoked'").bind(id).first())throw new NativeError('capture_unavailable',404)
  const now=Date.now()
  await db.batch([
   db.prepare('UPDATE penny_chat_connections SET state=? WHERE id=?').bind(state,id),
   ...(state==='revoked'?[
    db.prepare('DELETE FROM penny_chat_secrets WHERE connection_id=?').bind(id),
    db.prepare("UPDATE penny_chat_jobs SET state='stopped',failure='capture_disconnected',lease=NULL,lease_until=NULL WHERE connection_id=? AND state IN('pending','running','failed')").bind(id),
    db.prepare("UPDATE penny_chat_sources SET state='removed',removed_at=?,purge_at=?+(SELECT purge_days FROM penny_chat_connections WHERE id=?)*86400000 WHERE connection_id=? AND state NOT IN('removed','purged')").bind(now,now,id,id),
   ]:[]),
   audit(db,actor.id,'settings',id,'slack.capture_'+state,new Date(now).toISOString()),
  ])
  return c.json({state})
 })
 app.post(root+'/jobs/:id',async c=>{
  const {db,actor}=await ownerConfiguration(c.get('runtime'),c.req.raw),{action}=await parseInput(c.req.raw,z.object({action:z.enum(['retry','stop'])}).strict()),id=c.req.param('id')!
  const row=await db.prepare("SELECT j.state,c.state connection_state FROM penny_chat_jobs j JOIN penny_chat_connections c ON c.id=j.connection_id WHERE j.id=?").bind(id).first<{state:string;connection_state:string}>()
  if(!row)throw new NativeError('capture_job_not_found',404)
  if(!(action==='stop'?['pending','running','failed']:['pending','failed','stopped']).includes(row.state)||action==='retry'&&row.connection_state!=='active')throw new NativeError('capture_job_not_retryable',409)
  await db.batch([
   db.prepare('UPDATE penny_chat_jobs SET state=?,attempts=0,failure=NULL,due_at=?,lease=NULL,lease_until=NULL WHERE id=?').bind(action==='retry'?'pending':'stopped',Date.now(),id),
   audit(db,actor.id,'settings',id,'slack.capture_job_'+action,new Date().toISOString()),
  ])
  return c.json({saved:true})
 })
 for(const suffix of ['events','interactivity'])app.post('/api/integrations/chat/:id/'+suffix,async c=>{
  c.header('Cache-Control','no-store')
  return c.json(await receive(c.get('runtime'),c.req.raw,c.req.param('id')!,suffix==='interactivity'))
 })
}
