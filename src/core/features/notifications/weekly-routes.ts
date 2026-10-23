import type {Hono} from 'hono'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {z} from 'zod'
import {requireRequesterIdentity} from '../auth/requester'
import {parseInput} from '../auth/native-routes'
import {NativeError} from '../auth/native-tokens'
import {integrationOperator} from '../integrations/destinations'
import {sessionGuard} from '../integrations/keys'
import {guardedDatabase} from '../integrations/guarded-database'
import {createUlid} from '@/core/shared/ulid'
import {weeklySetting,weeklyPreference,changeWeeklyPreference} from './weekly-preferences'
export function registerWeeklyRoutes(app:Hono<OperatorMutationEnvironment>){
 app.get('/api/operator/settings/weekly-summary',async c=>{
  const runtime=c.get('runtime'),{session}=await integrationOperator(runtime,c.req.raw)
  return c.json({enabled:await weeklySetting(runtime.database.binding),canConfigure:session.operator.role==='owner'})
 })
 app.put('/api/operator/settings/weekly-summary',async c=>{
  const runtime=c.get('runtime'),input=await parseInput(c.req.raw,z.object({enabled:z.boolean()}).strict()),{session,actor}=await integrationOperator(runtime,c.req.raw)
  if(session.operator.role!=='owner')throw new NativeError('owner_required',403)
  const guard=sessionGuard(session)
  guard.sql+=" AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner') AND (?=0 OR EXISTS(SELECT 1 FROM penny_mail_identity WHERE singleton=1 AND trim(postal_address)!=''))";guard.params.push(session.operatorId,Number(input.enabled))
  const db=guardedDatabase(runtime.database.binding,guard),now=new Date().toISOString()
  await db.batch([
   db.prepare(`INSERT INTO penny_weekly_summary(singleton,enabled,enabled_at,updated_at) VALUES(1,?,?,?) ON CONFLICT(singleton) DO UPDATE SET enabled=excluded.enabled,
   enabled_at=CASE WHEN excluded.enabled=1 AND penny_weekly_summary.enabled=0 THEN excluded.enabled_at ELSE penny_weekly_summary.enabled_at END,updated_at=excluded.updated_at`).bind(Number(input.enabled),input.enabled?now:null,now),
   db.prepare("INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,details_json,occurred_at,created_at,updated_at) VALUES(?,'operator',?,'notifications.weekly_setting','settings','weekly-summary',?,?,?,?)").bind(createUlid(),actor.id,JSON.stringify(input),now,now,now),
  ])
  return c.json({enabled:input.enabled,canConfigure:true})
 })
 app.get('/api/public/requester/weekly-summary',async c=>{
  const runtime=c.get('runtime'),identity=await requireRequesterIdentity(runtime,c.req.raw)
  c.header('Cache-Control','no-store');return c.json(await weeklyPreference(runtime.database.binding,identity))
 })
 app.patch('/api/public/requester/weekly-summary',async c=>{
  const runtime=c.get('runtime'),identity=await requireRequesterIdentity(runtime,c.req.raw),input=await parseInput(c.req.raw,z.object({subscribed:z.boolean()}).strict())
  return c.json(await changeWeeklyPreference(runtime,identity,input.subscribed))
 })
}
