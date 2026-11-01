import {z} from 'zod'
import type {Hono} from 'hono'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {integrationOperator} from '../integrations/destinations'
import {guardedDatabase} from '../integrations/guarded-database'
import {sessionGuard} from '../integrations/keys'
import {parseInput} from '../auth/native-routes'
import {NativeError} from '../auth/native-tokens'
import {teamsConfiguration} from './configuration'
export const eventNames=['inbox','mention','assignment','aging','review','failure','release','demand'] as const
export const defaults={inbox:'off',mention:'immediate',assignment:'immediate',aging:'off',review:'immediate',failure:'off',release:'off',demand:'off'}
const cadence=z.enum(['off','immediate','daily','weekly'])
const input=z.object({enabled:z.boolean(),demandThreshold:z.number().int().min(1).max(1000000),events:z.object({inbox:cadence,mention:cadence,assignment:cadence,aging:cadence,review:cadence,failure:cadence,release:cadence,demand:cadence}).strict()}).strict()
export function registerTeamsNotificationSettings(app:Hono<OperatorMutationEnvironment>){
 const path='/api/operator/integrations/teams/notifications'
 app.get(path,async c=>{
  const runtime=c.get('runtime'),{actor,db}=await integrationOperator(runtime,c.req.raw)
  const prefs=await db.prepare('SELECT * FROM penny_teams_preferences WHERE operator_id=?').bind(actor.id).first<{events_json:string;enabled:number;demand_threshold:number}>()
  return c.json({configured:Boolean(teamsConfiguration(runtime)?.notificationUrl&&runtime.bindings.PENNY_TEAMS_EGRESS),settings:prefs?{events:JSON.parse(prefs.events_json),enabled:prefs.enabled===1,demandThreshold:prefs.demand_threshold}:{events:defaults,enabled:false,demandThreshold:10},deliveries:(await db.prepare('SELECT id,state,failure,event_count,created_at FROM penny_teams_deliveries WHERE operator_id=? ORDER BY created_at DESC LIMIT 20').bind(actor.id).all()).results})
 })
 app.put(path,async c=>{
  const runtime=c.get('runtime'),{session,actor}=await integrationOperator(runtime,c.req.raw),value=await parseInput(c.req.raw,input)
  if(value.enabled&&(!teamsConfiguration(runtime)?.notificationUrl||!runtime.bindings.PENNY_TEAMS_EGRESS))throw new NativeError('teams_notifications_unconfigured',503)
  const db=guardedDatabase(runtime.database.binding,sessionGuard(session)),now=new Date().toISOString()
  await db.batch([
   db.prepare('INSERT INTO penny_teams_preferences(operator_id,events_json,demand_threshold,enabled,revision,updated_at) VALUES(?,?,?,?,1,?) ON CONFLICT(operator_id) DO UPDATE SET events_json=excluded.events_json,demand_threshold=excluded.demand_threshold,enabled=excluded.enabled,revision=penny_teams_preferences.revision+1,updated_at=excluded.updated_at').bind(actor.id,JSON.stringify(value.events),value.demandThreshold,value.enabled?1:0,now),
   db.prepare("UPDATE penny_teams_deliveries SET state=CASE WHEN state='sending' THEN 'unknown' ELSE 'stopped' END,failure='preferences_changed',updated_at=? WHERE operator_id=? AND state IN('pending','sending')").bind(now,actor.id),
  ])
  return c.json({saved:true})
 })
 app.post(path+'/resolve',async c=>{
  const runtime=c.get('runtime'),{session,actor}=await integrationOperator(runtime,c.req.raw),value=await parseInput(c.req.raw,z.object({id:z.string().uuid(),action:z.enum(['resolve','retry']).default('resolve')}).strict())
  const db=guardedDatabase(runtime.database.binding,sessionGuard(session))
  if(value.action==='retry'){
   const result=await db.prepare("UPDATE penny_teams_deliveries SET state='pending',claim=NULL,failure=NULL,updated_at=? WHERE id=? AND operator_id=? AND state='failed' AND EXISTS(SELECT 1 FROM penny_teams_preferences p WHERE p.operator_id=penny_teams_deliveries.operator_id AND p.revision=penny_teams_deliveries.revision AND p.enabled=1) RETURNING id").bind(new Date().toISOString(),value.id,actor.id).all()
   if(!result.results.length)throw new NativeError('teams_delivery_cannot_retry',409)
  }else await db.prepare("UPDATE penny_teams_deliveries SET state='stopped',failure='operator_resolved',updated_at=? WHERE id=? AND operator_id=? AND state IN('pending','failed','unknown')").bind(new Date().toISOString(),value.id,actor.id).run()
  return c.json({saved:true})
 })
}
