import {createUlid} from '@/core/shared/ulid'
import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError,digest} from '../auth/native-tokens'
import {guardedDatabase} from '../integrations/guarded-database'
import {recordEvidence} from '../evidence/write-service'
import {redactCaptured,redactionFence} from '../redaction/settings'
import {captureGuard,discordMessage,readSettings,selected,snowflake,type DiscordSettings} from './configuration'
const sourceMessage=z.object({id:snowflake,channel_id:snowflake,content:z.string().max(20000),timestamp:z.iso.datetime({offset:true}),edited_timestamp:z.iso.datetime({offset:true}).nullable().optional(),author:z.object({id:snowflake,username:z.string().max(200).optional(),global_name:z.string().max(200).nullable().optional()}).nullable().optional()})
const sourceHash=(message:z.infer<typeof sourceMessage>)=>digest(JSON.stringify({content:message.content,timestamp:message.timestamp,editedAt:message.edited_timestamp??null,author:message.author??null}))
type Job={id:string;guild_id:string;channel_id:string;message_id:string;capturer_id:string;capturer_name:string|null;revision:number;state:string;claim:string|null}
type Source={evidence_id:string;guild_id:string;channel_id:string;message_id:string;source_hash:string;source_state:string}
function fenced(runtime:PennyRuntime,settings:DiscordSettings,epoch:number){
 const guard=captureGuard(settings);guard.sql+=' AND EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND epoch=?)';guard.params.push(epoch)
 return guardedDatabase(runtime.database.binding,guard)
}
function failure(error:unknown){return error instanceof NativeError?error.code:'discord_read_failed'}
export async function drainDiscord(runtime:PennyRuntime,clock=Date.now()){
 const raw=runtime.database.binding,state=await raw.prepare("SELECT epoch FROM data_state WHERE singleton=1 AND phase='idle'").first<{epoch:number}>()
 if(!state)return
 const settings=await readSettings(raw)
 if(!settings?.enabled)return
 const owner=await raw.prepare("SELECT 1 FROM oa_operators WHERE id=? AND version=? AND status='active' AND role='owner'").bind(settings.owner_id,settings.owner_version).first()
 if(!owner){
  const stopped=guardedDatabase(raw,{sql:"EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle' AND epoch=?) AND EXISTS(SELECT 1 FROM penny_discord_settings WHERE singleton=1 AND revision=?)",params:[state.epoch,settings.revision]})
  await stopped.prepare("UPDATE penny_discord_jobs SET state='failed',claim=NULL,failure='discord_owner_unavailable',updated_at=? WHERE state IN('pending','running')").bind(new Date(clock).toISOString()).run()
  return
 }
 const db=fenced(runtime,settings,state.epoch),now=new Date(clock).toISOString()
 // A killed read never resumes invisibly. Explicit retry uses the same source
 // identity, and an atomic receipt prevents a second item after any restart.
 await db.prepare("UPDATE penny_discord_jobs SET state='failed',failure='interrupted_read_retry_required',claim=NULL,updated_at=? WHERE state='running' AND started_at<?").bind(now,new Date(clock-300000).toISOString()).run()
 const jobs=(await db.prepare("SELECT * FROM penny_discord_jobs WHERE state='pending' ORDER BY created_at,id LIMIT 10").all<Job>()).results
 for(const job of jobs){
  if(!selected(settings,job.guild_id,job.channel_id)||job.revision!==settings.revision){await db.prepare("UPDATE penny_discord_jobs SET state='stopped',failure='scope_changed',updated_at=? WHERE id=? AND state='pending'").bind(now,job.id).run();continue}
  const claim=crypto.randomUUID(),claimed=await db.prepare("UPDATE penny_discord_jobs SET state='running',claim=?,started_at=?,attempts=attempts+1,updated_at=? WHERE id=? AND state='pending' RETURNING id").bind(claim,now,now,job.id).all()
  if(!claimed.results.length)continue
  try{
   const response=await discordMessage(runtime,job.channel_id,job.message_id)
   if(response.status!==200)throw new NativeError(response.status===429?'discord_rate_limited':response.status===401||response.status===403?'discord_access_revoked':response.status===404?'discord_source_removed':'discord_provider_unavailable',503)
   const parsed=sourceMessage.safeParse(JSON.parse(response.body))
   if(!parsed.success||parsed.data.id!==job.message_id||parsed.data.channel_id!==job.channel_id)throw new NativeError('discord_message_invalid',503)
   const message=parsed.data
   if(!message.content.trim())throw new NativeError('discord_message_content_unavailable',503)
   const fingerprint=await sourceHash(message),sourceDigest=await digest(job.id),redacted=await redactCaptured(db,{name:message.author?.global_name??message.author?.username??null,capturerName:job.capturer_name},['name','capturerName'])
   const guard=captureGuard(settings);guard.sql+=" AND EXISTS(SELECT 1 FROM penny_discord_jobs WHERE id=? AND state='running' AND claim=?) AND EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND epoch=?)";guard.params.push(job.id,claim,state.epoch)
   const commit=guardedDatabase(raw,guard),fence=redactionFence(commit,redacted.revision)
   await recordEvidence(commit,{sourceType:'discord',sourceLabel:'Discord message '+job.message_id,wording:message.content,namedSpeaker:redacted.input.name,observedAt:message.timestamp},null,now,undefined,undefined,{systemActor:'discord-capture',statements:id=>[
    fence.before,fence.after,
    commit.prepare('INSERT INTO penny_discord_receipts(source_digest,created_at) VALUES(?,?)').bind(sourceDigest,now),
    commit.prepare(`INSERT INTO penny_discord_sources(evidence_id,job_id,guild_id,channel_id,message_id,jump_url,capturer_id,capturer_name,author_id,source_hash,source_state,next_check) VALUES(?,?,?,?,?,?,?,?,?,?,'current',?)`).bind(id,job.id,job.guild_id,job.channel_id,job.message_id,`https://discord.com/channels/${job.guild_id}/${job.channel_id}/${job.message_id}`,job.capturer_id,redacted.input.capturerName,message.author?.id??null,fingerprint,new Date(clock+3600000).toISOString()),
    commit.prepare("UPDATE penny_discord_jobs SET state='done',failure=NULL,claim=NULL,evidence_id=?,capturer_name=?,updated_at=? WHERE id=? AND claim=?").bind(id,redacted.input.capturerName,now,job.id,claim),
   ]})
  }catch(error){
   // Provider bodies, tokens, names and excerpts never enter failure records.
   await raw.prepare("UPDATE penny_discord_jobs SET state='failed',failure=?,claim=NULL,updated_at=? WHERE id=? AND state='running' AND claim=?").bind(failure(error),now,job.id,claim).run()
  }
 }
 const current=await readSettings(raw)
 if(current?.revision===settings.revision&&current.enabled)await refreshDiscordSources(runtime,settings,state.epoch,clock)
}
async function refreshDiscordSources(runtime:PennyRuntime,settings:DiscordSettings,epoch:number,clock:number){
 const db=fenced(runtime,settings,epoch),now=new Date(clock).toISOString()
 const sources=(await db.prepare("SELECT * FROM penny_discord_sources WHERE source_state IN('current','changed') AND next_check<=? ORDER BY next_check,evidence_id LIMIT 10").bind(now).all<Source>()).results
 for(const source of sources){
  if(!selected(settings,source.guild_id,source.channel_id))continue
  try{
   const response=await discordMessage(runtime,source.channel_id,source.message_id)
   if([401,403,404].includes(response.status)){
    await db.prepare("UPDATE penny_discord_sources SET source_state='removed',removed_at=?,purge_at=?,check_failure=NULL WHERE evidence_id=? AND source_state IN('current','changed')").bind(now,new Date(clock+settings.purge_days*86400000).toISOString(),source.evidence_id).run()
   }else{
    if(response.status!==200)throw new NativeError(response.status===429?'discord_rate_limited':'discord_provider_unavailable',503)
    const parsed=sourceMessage.safeParse(JSON.parse(response.body))
    if(!parsed.success||parsed.data.id!==source.message_id||parsed.data.channel_id!==source.channel_id)throw new NativeError('discord_message_invalid',503)
    const changed=await sourceHash(parsed.data)!==source.source_hash
    await db.prepare("UPDATE penny_discord_sources SET source_state=CASE WHEN ? THEN 'changed' ELSE source_state END,next_check=?,check_failure=NULL WHERE evidence_id=?").bind(changed?1:0,new Date(clock+3600000).toISOString(),source.evidence_id).run()
   }
  }catch(error){await db.prepare('UPDATE penny_discord_sources SET check_failure=?,next_check=? WHERE evidence_id=?').bind(failure(error),new Date(clock+3600000).toISOString(),source.evidence_id).run()}
 }
}
/** Purging continues while capture is paused, without a provider read. */
export async function purgeDiscordSources(runtime:PennyRuntime,clock=Date.now()){
 const raw=runtime.database.binding,state=await raw.prepare("SELECT epoch FROM data_state WHERE singleton=1 AND phase='idle'").first<{epoch:number}>()
 if(!state)return
 const db=guardedDatabase(raw,{sql:"EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle' AND epoch=?)",params:[state.epoch]}),now=new Date(clock).toISOString()
 const sources=(await db.prepare("SELECT evidence_id FROM penny_discord_sources WHERE source_state='removed' AND purge_at<=? LIMIT 50").bind(now).all<{evidence_id:string}>()).results
 for(const source of sources)try{await db.batch([
  db.prepare("INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) SELECT ?,'system','discord-capture','discord.source_purged','evidence',?,?,?,? WHERE EXISTS(SELECT 1 FROM penny_discord_sources WHERE evidence_id=? AND source_state='removed' AND purge_at<=?)").bind(createUlid(),source.evidence_id,now,now,now,source.evidence_id,now),
  db.prepare("UPDATE evidence_versions SET wording='[Source removed]',updated_at=? WHERE evidence_id=? AND EXISTS(SELECT 1 FROM penny_discord_sources WHERE evidence_id=? AND source_state='removed' AND purge_at<=?)").bind(now,source.evidence_id,source.evidence_id,now),
  db.prepare("UPDATE evidence_items SET named_speaker=NULL,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM penny_discord_sources WHERE evidence_id=? AND source_state='removed' AND purge_at<=?)").bind(now,source.evidence_id,source.evidence_id,now),
  db.prepare("UPDATE penny_discord_sources SET source_state='purged',check_failure=NULL WHERE evidence_id=? AND source_state='removed' AND purge_at<=?").bind(source.evidence_id,now),
 ])}catch{
  await db.prepare("UPDATE penny_discord_sources SET check_failure='discord_purge_failed' WHERE evidence_id=? AND source_state='removed'").bind(source.evidence_id).run()
  throw new NativeError('discord_purge_failed',503)
 }
}
