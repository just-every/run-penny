import type {PennyRuntime} from '@/core/app/runtime'
import {recordEvidence} from '../evidence/write-service'
import {digest} from '../auth/native-tokens'
import {guardedDatabase} from '../integrations/guarded-database'
import {channels,connection,type ChatConnection} from './configuration'
import {slack,SlackFailure,permalink,messageTimestamp} from './slack'
import {failureSummary} from './job-status'

interface Job {id:string;connection_id:string;channel_id:string;message_ts:string;capturer:string|null;kind:string;attempts:number}
interface Source {evidence_id:string;connection_id:string;state:string;fingerprint:string;purge_at:number|null}
async function workDatabase(runtime:PennyRuntime,config:ChatConnection,job:Job,lease:string){
 const state=await runtime.database.binding.prepare("SELECT epoch FROM data_state WHERE singleton=1 AND phase='idle'").first<{epoch:number}>()
 return guardedDatabase(runtime.database.binding,{sql:`EXISTS(SELECT 1 FROM penny_chat_connections c JOIN oa_operators o ON o.id=c.native_operator_id WHERE c.id=? AND c.state='active' AND o.status='active' AND o.role='owner' AND o.version=c.operator_version) AND EXISTS(SELECT 1 FROM penny_chat_jobs WHERE id=? AND state='running' AND lease=? AND lease_until>unixepoch('now')*1000) AND NOT EXISTS(SELECT 1 FROM penny_chat_sources WHERE workspace_id=? AND channel_id=? AND message_ts=? AND connection_id<>?) AND EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle' AND epoch=?)`,params:[config.id,job.id,lease,config.team_id,job.channel_id,job.message_ts,config.id,state?.epoch??-1]})
}
function completed(db:D1Database,config:ChatConnection,job:Job,now:number){
 return [db.prepare("UPDATE penny_chat_jobs SET state='succeeded',failure=NULL,capturer=NULL,lease=NULL,lease_until=NULL WHERE id=?").bind(job.id),db.prepare('UPDATE penny_chat_connections SET last_success_at=? WHERE id=?').bind(now,config.id),failureSummary(db,config.id)]
}
async function removed(db:D1Database,source:Source,config:ChatConnection,now:number){
 await db.prepare("UPDATE penny_chat_sources SET state='removed',removed_at=?,purge_at=?,check_at=? WHERE evidence_id=? AND state NOT IN('removed','purged')").bind(now,now+config.purge_days*86400000,now+86400000,source.evidence_id).run()
}
async function runJob(runtime:PennyRuntime,config:ChatConnection,job:Job,lease:string,now:number){
 const db=await workDatabase(runtime,config,job,lease)
 const source=await db.prepare('SELECT evidence_id,connection_id,state,fingerprint,purge_at FROM penny_chat_sources WHERE workspace_id=? AND channel_id=? AND message_ts=?').bind(config.team_id,job.channel_id,job.message_ts).first<Source>()
 if(!channels(config).includes(job.channel_id))throw new SlackFailure('capture_channel_out_of_scope')
 // Erasure can remove the provenance while a refresh is pending. Never turn
 // that refresh or a second trigger into a new copy of erased evidence.
 if(!source&&(job.kind!=='capture'||await db.prepare("SELECT 1 FROM penny_chat_jobs j JOIN penny_chat_connections c ON c.id=j.connection_id WHERE c.team_id=? AND j.channel_id=? AND j.message_ts=? AND j.kind='capture' AND j.state='succeeded' AND j.id<>?").bind(config.team_id,job.channel_id,job.message_ts,job.id).first()))return db.batch(completed(db,config,job,now))
 if(job.kind==='capture'&&source||source&&['removed','purged'].includes(source.state))return db.batch(completed(db,config,job,now))
 if(job.kind==='remove'){
  if(source)await removed(db,source,config,now)
  return db.batch(completed(db,config,job,now))
 }
 let data
 try{data=await slack(runtime,config,'reactions.get',{channel:job.channel_id,timestamp:job.message_ts,full:'false'})}catch(error){
  if(source&&error instanceof SlackFailure&&error.removed){await removed(db,source,config,now);return db.batch(completed(db,config,job,now))}
  throw error
 }
 const message=data.message
 if(data.type!=='message'||data.channel!==job.channel_id||message?.ts!==job.message_ts||typeof message.text!=='string'||!message.text.trim()||message.text.length>20000||message.thread_ts!==undefined&&!messageTimestamp(message.thread_ts))throw new SlackFailure('slack_message_invalid')
 const fingerprint=await digest(message.text)
 if(source){
  await db.batch([db.prepare("UPDATE penny_chat_sources SET state=CASE WHEN fingerprint<>? THEN 'changed' ELSE state END,check_at=? WHERE evidence_id=?").bind(fingerprint,now+3600000,source.evidence_id),...completed(db,config,job,now)])
  return
 }
 // Slack supplies one selected message, not a whole conversation. Confirm the
 // channel's sharing relationship before assigning any customer account.
 const channel=(await slack(runtime,config,'conversations.info',{channel:job.channel_id})).channel
 if(channel?.id!==job.channel_id)throw new SlackFailure('slack_channel_invalid')
 let team=typeof message.team==='string'?message.team:null
 const thread=message.thread_ts??message.ts
 const url=permalink((await slack(runtime,config,'chat.getPermalink',{channel:job.channel_id,message_ts:thread})).permalink)
 const speaker=typeof message.user==='string'&&/^[A-Z][A-Z0-9]{1,79}$/.test(message.user)?message.user:null
 let name:string|null=null
 if(speaker){
  const user=(await slack(runtime,config,'users.info',{user:speaker})).user
  if(user?.id!==speaker)throw new SlackFailure('slack_author_invalid')
  if(!team&&typeof user.team_id==='string')team=user.team_id
  const label=user.profile?.display_name||user.real_name||user.name
  if(typeof label==='string'&&label.trim()&&label.length<=200)name=label
 }
 const shared=channel.is_ext_shared===true&&Array.isArray(channel.shared_team_ids)&&team!==config.team_id&&channel.shared_team_ids.includes(team)
 const mappings=JSON.parse(config.mappings_json) as {teamId:string;accountId:string}[]
 const account=shared?mappings.find(row=>row.teamId===team)?.accountId:null
 // No source identity is granted a native operator, requester or mail permission.
 await recordEvidence(db,{sourceType:'support_conversation',sourceLabel:'Slack',wording:message.text,observedAt:new Date(Number(message.ts)*1000).toISOString(),namedSpeaker:name,accountId:account},null,new Date(now).toISOString(),undefined,undefined,{
  systemActor:'slack-capture',statements:id=>[
   db.prepare('INSERT INTO penny_chat_sources(evidence_id,connection_id,workspace_id,channel_id,message_ts,thread_ts,source_url,source_author,capturer,source_team,fingerprint,check_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,config.id,config.team_id,job.channel_id,job.message_ts,thread,url,speaker,job.capturer,team,fingerprint,now+3600000),
   ...completed(db,config,job,now),
  ],
 })
}
/** Cron is the recovery door after a crash or failed ingress handoff. Every
 * source and queue scan is bounded; source reads have no customer-facing effect. */
export async function drainChatCapture(runtime:PennyRuntime,now=Date.now()){
 const raw=runtime.database.binding
 if(!await raw.prepare("SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle'").first())return
 await raw.prepare(`UPDATE penny_chat_jobs SET state='stopped',failure='capture_supervision_replaced',lease=NULL,lease_until=NULL WHERE state IN('pending','running','failed') AND EXISTS(SELECT 1 FROM penny_chat_sources s JOIN penny_chat_connections c ON c.id=penny_chat_jobs.connection_id WHERE s.workspace_id=c.team_id AND s.channel_id=penny_chat_jobs.channel_id AND s.message_ts=penny_chat_jobs.message_ts AND s.connection_id<>c.id)`).run()
 await raw.prepare(`UPDATE penny_chat_jobs SET state='stopped',failure='capture_authority_removed',lease=NULL,lease_until=NULL WHERE state IN('pending','running','failed') AND NOT EXISTS(SELECT 1 FROM penny_chat_connections c JOIN oa_operators o ON o.id=c.native_operator_id JOIN penny_chat_secrets s ON s.connection_id=c.id WHERE c.id=penny_chat_jobs.connection_id AND c.state IN('active','paused') AND o.status='active' AND o.role='owner' AND o.version=c.operator_version)`).run()
 const due=(await raw.prepare(`SELECT s.connection_id,s.channel_id,s.message_ts FROM penny_chat_sources s JOIN penny_chat_connections c ON c.id=s.connection_id WHERE s.check_at<=? AND s.state IN('captured','changed') AND c.state='active' ORDER BY s.check_at LIMIT 5`).bind(now).all<{connection_id:string;channel_id:string;message_ts:string}>()).results
 for(const source of due){
  await raw.batch([
   raw.prepare("INSERT INTO penny_chat_jobs(id,connection_id,receipt,channel_id,message_ts,kind,due_at,created_at) VALUES(?,?,?,?,?,'refresh',?,?) ON CONFLICT(connection_id,receipt) DO NOTHING").bind(crypto.randomUUID(),source.connection_id,'poll:'+source.channel_id+':'+source.message_ts+':'+Math.floor(now/3600000),source.channel_id,source.message_ts,now,now),
   raw.prepare('UPDATE penny_chat_sources SET check_at=? WHERE connection_id=? AND channel_id=? AND message_ts=?').bind(now+3600000,source.connection_id,source.channel_id,source.message_ts),
  ])
 }
 const jobs=(await raw.prepare(`SELECT j.* FROM penny_chat_jobs j JOIN penny_chat_connections c ON c.id=j.connection_id WHERE c.state='active' AND (j.state='pending' AND j.due_at<=? OR j.state='running' AND j.lease_until<=?) ORDER BY j.due_at,j.created_at,j.id LIMIT 10`).bind(now,now).all<Job>()).results
 for(const job of jobs){
  const config=await connection(runtime,job.connection_id)
  if(!config)continue
  const lease=crypto.randomUUID(),claim=await raw.prepare("UPDATE penny_chat_jobs SET state='running',lease=?,lease_until=?,attempts=attempts+1 WHERE id=? AND (state='pending' AND due_at<=? OR state='running' AND lease_until<=?) RETURNING id").bind(lease,now+120000,job.id,now,now).first()
  if(!claim)continue
  try{await runJob(runtime,config,job,lease,now)}catch(error){
   // A concurrent capture won the unique source key: finish the losing job
   // without a second evidence item. The failed transaction rolled back whole.
   const exists=await raw.prepare('SELECT 1 FROM penny_chat_sources WHERE workspace_id=? AND channel_id=? AND message_ts=?').bind(config.team_id,job.channel_id,job.message_ts).first()
   if(job.kind==='capture'&&exists){await raw.prepare("UPDATE penny_chat_jobs SET state='succeeded',capturer=NULL,lease=NULL,lease_until=NULL,failure=NULL WHERE id=? AND lease=?").bind(job.id,lease).run();continue}
   const code=error instanceof SlackFailure?error.code:'capture_failed',delay=error instanceof SlackFailure?error.delay:60000
   await raw.batch([
    raw.prepare("UPDATE penny_chat_jobs SET state=?,failure=?,due_at=?,lease=NULL,lease_until=NULL WHERE id=? AND lease=?").bind(job.attempts>=7?'failed':'pending',code,now+delay,job.id,lease),
    raw.prepare('UPDATE penny_chat_connections SET last_failure=? WHERE id=?').bind(code,config.id),
   ])
  }
 }
 const purges=(await raw.prepare("SELECT evidence_id FROM penny_chat_sources WHERE state='removed' AND purge_at<=? LIMIT 10").bind(now).all<{evidence_id:string}>()).results
 for(const {evidence_id:id} of purges)await guardedDatabase(raw,{sql:"EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle') AND EXISTS(SELECT 1 FROM penny_chat_sources WHERE evidence_id=? AND state='removed' AND purge_at<=?)",params:[id,now]}).batch([
  raw.prepare("UPDATE evidence_versions SET wording='[Source excerpt removed]' WHERE evidence_id=?").bind(id),
  raw.prepare('UPDATE evidence_items SET named_speaker=NULL WHERE id=?').bind(id),
  raw.prepare("UPDATE penny_chat_sources SET state='purged',source_author=NULL,capturer=NULL,source_team=NULL,fingerprint='' WHERE evidence_id=? AND state='removed'").bind(id),
 ])
}
