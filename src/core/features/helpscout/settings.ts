import type {Hono} from 'hono'
import {z} from 'zod'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {integrationOperator} from '../integrations/destinations'
import {guardedDatabase} from '../integrations/guarded-database'
import {sessionGuard} from '../integrations/keys'
import {NativeError} from '../auth/native-tokens'
import {parseInput} from '../auth/native-routes'
import {audit} from '../decisions/write-support'
import {installInput,issueToken,readConnection} from './configuration'
export function registerHelpScoutSettings(app:Hono<OperatorMutationEnvironment>){
 const path='/api/operator/integrations/helpscout'
 app.use(path+'*',async(c,next)=>{c.header('Cache-Control','private, no-store');await next()})
 async function owner(runtime:Parameters<typeof integrationOperator>[0],request:Request){
  const admitted=await integrationOperator(runtime,request)
  if(admitted.session.operator.role!=='owner')throw new NativeError('owner_required',403)
  const guard=sessionGuard(admitted.session);guard.sql+=" AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner')";guard.params.push(admitted.session.operatorId)
  return {...admitted,db:guardedDatabase(runtime.database.binding,guard)}
 }
 app.get(path,async c=>{
  const runtime=c.get('runtime'),{session,db}=await integrationOperator(runtime,c.req.raw)
  if(session.operator.role!=='owner')return c.json({canConfigure:false})
  const row=await readConnection(db)
  return c.json({canConfigure:true,transport:Boolean(runtime.bindings.PENNY_HELPSCOUT_EGRESS),connection:row,ownerName:row?await db.prepare('SELECT display_name FROM operators WHERE id=?').bind(row.actor_id).first<string>('display_name'):null,credentialStored:Boolean(await db.prepare('SELECT 1 FROM penny_helpscout_secrets LIMIT 1').first()),jobs:(await db.prepare('SELECT conversation_id,state,attempts,failure,source_state,evidence_id,updated_at FROM penny_helpscout_captures ORDER BY updated_at DESC LIMIT 20').all()).results})
 })
 app.post(path,async c=>{
  const runtime=c.get('runtime'),{session,actor,db}=await owner(runtime,c.req.raw),input=await parseInput(c.req.raw,installInput)
  const token=await issueToken(runtime,input.clientId,input.clientSecret),prior=await readConnection(db),id=prior?.id??crypto.randomUUID(),now=new Date().toISOString()
  await db.batch([
   db.prepare(`INSERT INTO penny_helpscout_connection(id,mailbox_id,tag,sidebar_user_id,owner_id,owner_version,actor_id,revision,enabled,purge_days,created_at,updated_at) VALUES(?,?,?,?,?,?,?,1,1,?,?,?) ON CONFLICT(id) DO UPDATE SET mailbox_id=excluded.mailbox_id,tag=excluded.tag,sidebar_user_id=excluded.sidebar_user_id,owner_id=excluded.owner_id,owner_version=excluded.owner_version,actor_id=excluded.actor_id,revision=penny_helpscout_connection.revision+1,enabled=1,purge_days=excluded.purge_days,updated_at=excluded.updated_at,failure=NULL`).bind(id,input.mailboxId,input.tag,input.sidebarUserId,session.operatorId,session.operator.version,actor.id,input.purgeDays,now,now),
   db.prepare('INSERT INTO penny_helpscout_secrets(connection_id,client_id,client_secret,app_secret,webhook_secret,access_token,expires_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(connection_id) DO UPDATE SET client_id=excluded.client_id,client_secret=excluded.client_secret,app_secret=excluded.app_secret,webhook_secret=excluded.webhook_secret,access_token=excluded.access_token,expires_at=excluded.expires_at').bind(id,input.clientId,input.clientSecret,input.appSecret,input.webhookSecret,token.access_token,Date.now()+token.expires_in*1000-30000),
   db.prepare('DELETE FROM penny_helpscout_contexts'),
   db.prepare("UPDATE penny_helpscout_captures SET source_state=CASE WHEN evidence_id IS NULL THEN source_state ELSE 'removed' END,removed_at=?,purge_at=?,failure='scope_changed' WHERE mailbox_id<>? OR (trigger_kind='tag' AND capture_tag<>?)").bind(now,new Date(Date.now()+input.purgeDays*86400000).toISOString(),input.mailboxId,input.tag),
   db.prepare("UPDATE penny_helpscout_captures SET state=CASE WHEN evidence_id IS NULL THEN 'stopped' ELSE 'done' END,claim=NULL,revision=(SELECT revision FROM penny_helpscout_connection WHERE id=?),next_check=?,updated_at=?").bind(id,now,now),
   audit(db,actor.id,'integration',id,'helpscout.connected',now),
  ])
  return c.json({connected:true})
 })
 app.post(path+'/control',async c=>{
  const runtime=c.get('runtime'),{db,session,actor}=await owner(runtime,c.req.raw),input=await parseInput(c.req.raw,z.object({action:z.enum(['pause','resume','retry']),conversationId:z.number().int().positive().optional()}).strict()),row=await readConnection(db),now=new Date().toISOString()
  if(!row)throw new NativeError('helpscout_disconnected',409)
  if(input.action==='retry'){
   if(!row.enabled||!input.conversationId)throw new NativeError('helpscout_retry_refused',409)
   await db.prepare("UPDATE penny_helpscout_captures SET state=CASE WHEN evidence_id IS NULL THEN 'pending' ELSE 'done' END,claim=NULL,failure=NULL,next_check=?,revision=?,updated_at=? WHERE conversation_id=? AND mailbox_id=? AND (trigger_kind='sidebar' OR capture_tag=?) AND state IN('failed','stopped','held')").bind(now,row.revision,now,input.conversationId,row.mailbox_id,row.tag).run()
  }else await db.batch([
   db.prepare('UPDATE penny_helpscout_connection SET enabled=?,revision=revision+1,owner_id=?,owner_version=?,actor_id=?,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM penny_helpscout_secrets WHERE connection_id=?)').bind(input.action==='resume'?1:0,session.operatorId,session.operator.version,actor.id,now,row.id,row.id),
   db.prepare('DELETE FROM penny_helpscout_contexts'),
   db.prepare("UPDATE penny_helpscout_captures SET state=CASE WHEN evidence_id IS NULL THEN 'stopped' ELSE 'done' END,claim=NULL,revision=(SELECT revision FROM penny_helpscout_connection WHERE id=?),next_check=?,updated_at=?").bind(row.id,now,now),
   audit(db,actor.id,'integration',row.id,'helpscout.'+input.action,now),
  ])
  return c.json({saved:true})
 })
 app.delete(path,async c=>{
  const runtime=c.get('runtime'),{db,actor}=await owner(runtime,c.req.raw),row=await readConnection(db),now=new Date().toISOString()
  if(row)await db.batch([
   db.prepare('UPDATE penny_helpscout_connection SET enabled=0,revision=revision+1,updated_at=? WHERE id=?').bind(now,row.id),
   db.prepare('DELETE FROM penny_helpscout_secrets'),db.prepare('DELETE FROM penny_helpscout_contexts'),
   db.prepare("UPDATE penny_helpscout_captures SET state=CASE WHEN evidence_id IS NULL THEN 'stopped' ELSE 'done' END,claim=NULL,source_state=CASE WHEN evidence_id IS NULL THEN source_state ELSE 'removed' END,removed_at=?,purge_at=?,updated_at=?").bind(now,new Date(Date.now()+row.purge_days*86400000).toISOString(),now),
   audit(db,actor.id,'integration',row.id,'helpscout.disconnected',now),
  ])
  return c.json({disconnected:true,upstreamAction:'Delete the OAuth application in Help Scout to revoke its provider credentials.'})
 })
}
