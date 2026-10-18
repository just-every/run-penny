import type { Context,Hono } from 'hono'
import { z } from 'zod'
import { parseMutationBody,type OperatorMutationEnvironment } from '@/core/app/operator-mutations'
import { integrationOperator } from '../integrations/destinations'
import { sessionGuard } from '../integrations/keys'
import { guardedDatabase } from '../integrations/guarded-database'
import { NativeError } from '../auth/native-tokens'
import { createUlid } from '@/core/shared/ulid'
import { agingSummary } from './reminders'
const days=z.number().int().min(1).max(3650)
const settings=z.object({inbox_days:days,comment_days:days,response_days:days,under_review_days:days,planned_days:days,in_progress_days:days}).strict()
export type AgingPolicy=z.infer<typeof settings>
export function registerTriageRoutes(app:Hono<OperatorMutationEnvironment>){
 app.get('/api/operator/triage',c=>admitted(c,async(db,actor)=>c.json(await agingSummary(db,actor))))
 app.get('/api/operator/triage/settings',c=>admitted(c,async(db,_actor,canConfigure)=>c.json({...await db.prepare('SELECT * FROM penny_triage_settings WHERE singleton=1').first(),canConfigure})))
 app.patch('/api/operator/triage/settings',c=>admitted(c,async(db,actor)=>{

  const input=await parseMutationBody(c,settings);if(!input)return c.json({error:'validation_failed'},400)
  const now=new Date().toISOString()
  await db.batch([db.prepare('UPDATE penny_triage_settings SET inbox_days=?,comment_days=?,response_days=?,under_review_days=?,planned_days=?,in_progress_days=?,updated_at=? WHERE singleton=1').bind(input.inbox_days,input.comment_days,input.response_days,input.under_review_days,input.planned_days,input.in_progress_days,now),audit(db,actor,'triage.settings','workspace','1',now)])
  return c.json({ok:true})
 },true))
 app.patch('/api/operator/triage/evidence/:id/snooze',c=>admitted(c,async(db,actor)=>{
  const input=await parseMutationBody(c,z.object({until:z.string().datetime({offset:true}).nullable()}).strict());if(!input)return c.json({error:'validation_failed'},400)
  const id=c.req.param('id'),now=new Date().toISOString(),until=input.until?new Date(input.until).toISOString():null
  if(until&&until<=now)return c.json({error:'snooze_must_be_future'},400)
  if(!await db.prepare('SELECT id FROM evidence_items WHERE id=?').bind(id).first())return c.json({error:'not_found'},404)
  await db.batch([until?db.prepare('INSERT INTO penny_evidence_snoozes(evidence_id,until_at,updated_at) VALUES(?,?,?) ON CONFLICT(evidence_id) DO UPDATE SET until_at=excluded.until_at,updated_at=excluded.updated_at').bind(id,until,now):db.prepare('DELETE FROM penny_evidence_snoozes WHERE evidence_id=?').bind(id),audit(db,actor,until?'triage.snoozed':'triage.unsnoozed','evidence',id,now)])
  return c.json({ok:true})
 }))
}
function audit(db:D1Database,actor:string,action:string,entity:string,id:string,now:string){return db.prepare("INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) VALUES(?,'operator',?,?,?,?,?,?,?)").bind(createUlid(),actor,action,entity,id,now,now,now)}
async function admitted(c:Context<OperatorMutationEnvironment>,action:(db:D1Database,actor:string,canConfigure:boolean)=>Promise<Response>,configure=false){
 try{
  const runtime=c.get('runtime'),admission=await integrationOperator(runtime,c.req.raw)
  let db=admission.db
  if(configure){
   if(!['owner','admin'].includes(admission.session.operator.role))throw new NativeError('triage_settings_role_required',403)
   const guard=sessionGuard(admission.session);guard.sql+=" AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role IN ('owner','admin'))";guard.params.push(admission.session.operatorId)
   db=guardedDatabase(runtime.database.binding,guard)
  }
  c.header('Cache-Control','private, no-store');return await action(db,admission.actor.id,['owner','admin'].includes(admission.session.operator.role))
 }catch(e){if(e instanceof NativeError)return c.json({error:e.code},e.status);throw e}
}
