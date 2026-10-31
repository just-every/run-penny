import type {Hono} from 'hono'
import {z} from 'zod'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {integrationOperator} from '../integrations/destinations'
import {guardedDatabase} from '../integrations/guarded-database'
import {sessionGuard} from '../integrations/keys'
import {NativeError,digest} from '../auth/native-tokens'
import {parseInput} from '../auth/native-routes'
import {audit} from '../decisions/write-support'
import {teamsConfiguration,readSettings,settingsInput} from './configuration'
export function registerTeamsSettings(app:Hono<OperatorMutationEnvironment>){
 const path='/api/operator/integrations/teams'
 app.use(path+'*',async(c,next)=>{c.header('Cache-Control','private, no-store');await next()})
 app.get(path,async c=>{
  const runtime=c.get('runtime'),{session,db}=await integrationOperator(runtime,c.req.raw)
  if(session.operator.role!=='owner')return c.json({canConfigure:false})
  const settings=await readSettings(db),config=teamsConfiguration(runtime),jobs=(await db.prepare('SELECT id,message_id,channel_id,team_id,trigger_kind,state,attempts,failure,updated_at,(SELECT display_name FROM operators WHERE id=penny_teams_jobs.actor_id) ownerName FROM penny_teams_jobs ORDER BY updated_at DESC LIMIT 20').all()).results
  return c.json({canConfigure:true,configured:Boolean(config&&runtime.bindings.PENNY_TEAMS_EGRESS),applicationId:config?.applicationId??null,settings:settings?{teamId:settings.team_id,channelIds:JSON.parse(settings.channels_json),enabled:settings.enabled===1,purgeDays:settings.purge_days}:null,jobs,counts:(await db.prepare('SELECT state,count(*) count FROM penny_teams_jobs GROUP BY state').all()).results,owner:settings?.owner_id??null})
 })
 app.put(path,async c=>{
  const runtime=c.get('runtime'),{session,actor}=await integrationOperator(runtime,c.req.raw)
  if(session.operator.role!=='owner')throw new NativeError('owner_required',403)
  const input=await parseInput(c.req.raw,settingsInput)
  if(input.enabled&&(!teamsConfiguration(runtime)||!runtime.bindings.PENNY_TEAMS_EGRESS))throw new NativeError('teams_transport_unconfigured',503)
  const guard=sessionGuard(session);guard.sql+=" AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner')";guard.params.push(session.operatorId)
  const db=guardedDatabase(runtime.database.binding,guard),now=new Date().toISOString()
  await db.batch([
   db.prepare(`INSERT INTO penny_teams_settings(singleton,team_id,channels_json,owner_id,owner_version,actor_id,enabled,revision,purge_days,updated_at) VALUES(1,?,?,?,?,?,?,1,?,?) ON CONFLICT(singleton) DO UPDATE SET team_id=excluded.team_id,channels_json=excluded.channels_json,owner_id=excluded.owner_id,owner_version=excluded.owner_version,actor_id=excluded.actor_id,enabled=excluded.enabled,revision=penny_teams_settings.revision+1,purge_days=excluded.purge_days,updated_at=excluded.updated_at`).bind(input.teamId,JSON.stringify(input.channelIds),session.operatorId,session.operator.version,actor.id,input.enabled?1:0,input.purgeDays,now),
   db.prepare("UPDATE penny_teams_jobs SET state='stopped',claim=NULL,failure='configuration_changed',updated_at=? WHERE state IN('pending','running','failed')").bind(now),
   db.prepare("UPDATE penny_teams_sources SET next_check=CASE WHEN check_claim IS NOT NULL OR check_failure IS NOT NULL THEN ? ELSE next_check END,check_claim=NULL,check_started_at=NULL,check_failure=NULL WHERE source_state IN('current','changed')").bind(now),
   db.prepare("UPDATE penny_teams_sources SET source_state='removed',removed_at=?,purge_at=?,check_failure=NULL WHERE source_state IN('current','changed') AND (team_id<>? OR channel_id NOT IN(SELECT value FROM json_each(?)))").bind(now,new Date(Date.now()+input.purgeDays*86400000).toISOString(),input.teamId,JSON.stringify(input.channelIds)),
   audit(db,actor.id,'integration','teams',input.enabled?'teams.configured':'teams.paused',now),
  ])
  return c.json({saved:true})
 })
 app.post(path+'/jobs',async c=>{
  const runtime=c.get('runtime'),{session,actor}=await integrationOperator(runtime,c.req.raw)
  if(session.operator.role!=='owner')throw new NativeError('owner_required',403)
  const input=await parseInput(c.req.raw,z.object({id:z.string().max(500),action:z.enum(['retry','stop','forget'])}).strict()),settings=await readSettings(runtime.database.binding)
  if(!settings)throw new NativeError('teams_unconfigured',409)
  if(input.action==='retry'&&!settings.enabled)throw new NativeError('teams_capture_paused',409)
  const guard=sessionGuard(session);guard.sql+=" AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner')";guard.params.push(session.operatorId)
  const db=guardedDatabase(runtime.database.binding,guard),now=new Date().toISOString()
  if(input.action==='forget'){
   const erase=sessionGuard(session);erase.sql+=" AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner') AND EXISTS(SELECT 1 FROM penny_teams_jobs WHERE id=? AND evidence_id IS NULL AND state IN('failed','stopped','held'))";erase.params.push(session.operatorId,input.id)
   const fenced=guardedDatabase(runtime.database.binding,erase)
   await fenced.batch([
    fenced.prepare('INSERT INTO penny_teams_receipts(source_digest,created_at) VALUES(?,?) ON CONFLICT DO NOTHING').bind(await digest(input.id),now),
    fenced.prepare('DELETE FROM penny_teams_jobs WHERE id=?').bind(input.id),
    audit(fenced,actor.id,'integration','teams','teams.capture_forgotten',now),
   ])
   return c.json({saved:true})
  }
  const result=await db.batch([
   db.prepare(`UPDATE penny_teams_jobs SET state=?,failure=NULL,claim=NULL,revision=?,owner_id=?,owner_version=?,actor_id=?,updated_at=? WHERE id=? AND state IN(SELECT value FROM json_each(?)) AND team_id=? AND channel_id IN(SELECT value FROM json_each(?)) RETURNING id`).bind(input.action==='retry'?'pending':'stopped',settings.revision,settings.owner_id,settings.owner_version,settings.actor_id,now,input.id,JSON.stringify(input.action==='retry'?['failed','stopped','held']:['pending','running','failed','stopped','held']),settings.team_id,settings.channels_json),
   audit(db,actor.id,'integration','teams','teams.job_'+input.action,now),
  ])
  if(!result[0].results.length)throw new NativeError('teams_job_state_changed',409)
  return c.json({saved:true})
 })
}
