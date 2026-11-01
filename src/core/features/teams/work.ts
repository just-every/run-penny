import {createUlid} from '@/core/shared/ulid'
import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError,digest} from '../auth/native-tokens'
import {guardedDatabase} from '../integrations/guarded-database'
import {recordEvidence} from '../evidence/write-service'
import {redactCaptured,redactionFence} from '../redaction/settings'
import {captureGuard,readSettings,selected,type TeamsSettings} from './configuration'
import {sourceMessage,isDeletedMessage,sourceHash,teamsMessage,readMessage} from './provider'
type Job={id:string;team_id:string;channel_id:string;message_id:string;parent_message_id:string|null;capturer_id:string;capturer_name:string|null;revision:number;state:string;claim:string|null}
type Source={evidence_id:string;team_id:string;channel_id:string;message_id:string;parent_message_id:string|null;source_hash:string;source_state:string}
function fenced(runtime:PennyRuntime,settings:TeamsSettings,epoch:number){
 const guard=captureGuard(settings);guard.sql+=' AND EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND epoch=?)';guard.params.push(epoch)
 return guardedDatabase(runtime.database.binding,guard)
}
function failure(error:unknown){return error instanceof NativeError?error.code:'teams_read_failed'}
export async function drainTeams(runtime:PennyRuntime,clock=Date.now()){
 const raw=runtime.database.binding,state=await raw.prepare("SELECT epoch FROM data_state WHERE singleton=1 AND phase='idle'").first<{epoch:number}>()
 if(!state)return
 const settings=await readSettings(raw)
 if(!settings?.enabled)return
 const owner=await raw.prepare("SELECT 1 FROM oa_operators WHERE id=? AND version=? AND status='active' AND role='owner'").bind(settings.owner_id,settings.owner_version).first()
 if(!owner){
  const stopped=guardedDatabase(raw,{sql:"EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle' AND epoch=?) AND EXISTS(SELECT 1 FROM penny_teams_settings WHERE singleton=1 AND revision=?)",params:[state.epoch,settings.revision]})
  await stopped.prepare("UPDATE penny_teams_jobs SET state='failed',claim=NULL,failure='teams_owner_unavailable',updated_at=? WHERE state IN('pending','running')").bind(new Date(clock).toISOString()).run()
  return
 }
 const db=fenced(runtime,settings,state.epoch),now=new Date(clock).toISOString()
 // A killed read never resumes invisibly. Explicit retry uses the same source
 // identity, and an atomic receipt prevents a second item after any restart.
 await db.prepare("UPDATE penny_teams_jobs SET state='failed',failure='interrupted_read_retry_required',claim=NULL,updated_at=? WHERE state='running' AND started_at<?").bind(now,new Date(clock-300000).toISOString()).run()
 const jobs=(await db.prepare("SELECT * FROM penny_teams_jobs WHERE state='pending' ORDER BY created_at,id LIMIT 10").all<Job>()).results
 for(const job of jobs){
  if(!selected(settings,job.team_id,job.channel_id)||job.revision!==settings.revision){await db.prepare("UPDATE penny_teams_jobs SET state='stopped',failure='scope_changed',updated_at=? WHERE id=? AND state='pending'").bind(now,job.id).run();continue}
  const claim=crypto.randomUUID(),claimed=await db.prepare("UPDATE penny_teams_jobs SET state='running',claim=?,started_at=?,attempts=attempts+1,updated_at=? WHERE id=? AND state='pending' RETURNING id").bind(claim,now,now,job.id).all()
  if(!claimed.results.length)continue
  try{
   const response=await teamsMessage(runtime,job.team_id,job.channel_id,job.message_id,job.parent_message_id,()=>db.prepare("SELECT 1 FROM penny_teams_jobs WHERE id=? AND claim=? AND state='running'").bind(job.id,claim).first().then(row=>{if(!row)throw new NativeError('teams_capture_stopped',409)}))
   if(response.status!==200)throw new NativeError(response.status===429?'teams_rate_limited':response.status===401||response.status===403?'teams_access_revoked':response.status===404?'teams_source_removed':'teams_provider_unavailable',503)
   if(isDeletedMessage(response.body,job.message_id))throw new NativeError('teams_source_removed',503)
   const parsed=sourceMessage.safeParse(JSON.parse(response.body))
   if(!parsed.success||parsed.data.id!==job.message_id)throw new NativeError('teams_message_invalid',503)
   const message=parsed.data
   if(message.deletedDateTime)throw new NativeError('teams_source_removed',503)
   const content=await readMessage(message)
   if(!content.trim())throw new NativeError('teams_message_content_unavailable',503)
   const fingerprint=await sourceHash(message),sourceDigest=await digest(job.id),redacted=await redactCaptured(db,{name:message.from?.user?.displayName??null,capturerName:job.capturer_name},['name','capturerName'])
   const guard=captureGuard(settings);guard.sql+=" AND EXISTS(SELECT 1 FROM penny_teams_jobs WHERE id=? AND state='running' AND claim=?) AND EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND epoch=?)";guard.params.push(job.id,claim,state.epoch)
   const commit=guardedDatabase(raw,guard),fence=redactionFence(commit,redacted.revision)
   await recordEvidence(commit,{sourceType:'teams',sourceLabel:'Teams message '+job.message_id,wording:content,namedSpeaker:redacted.input.name,observedAt:message.createdDateTime},null,now,undefined,undefined,{systemActor:'teams-capture',statements:id=>[
    fence.before,fence.after,
    commit.prepare('INSERT INTO penny_teams_receipts(source_digest,created_at) VALUES(?,?)').bind(sourceDigest,now),
    commit.prepare(`INSERT INTO penny_teams_sources(evidence_id,job_id,team_id,channel_id,message_id,parent_message_id,jump_url,capturer_id,capturer_name,author_id,source_hash,source_state,next_check) VALUES(?,?,?,?,?,?,?,?,?,?,?,'current',?)`).bind(id,job.id,job.team_id,job.channel_id,job.message_id,job.parent_message_id,message.webUrl,job.capturer_id,redacted.input.capturerName,message.from?.user?.id??null,fingerprint,new Date(clock+3600000).toISOString()),
    commit.prepare("UPDATE penny_teams_jobs SET state='done',failure=NULL,claim=NULL,evidence_id=?,capturer_name=?,updated_at=? WHERE id=? AND claim=?").bind(id,redacted.input.capturerName,now,job.id,claim),
   ]})
  }catch(error){
   // Provider bodies, tokens, names and excerpts never enter failure records.
   await raw.prepare("UPDATE penny_teams_jobs SET state='failed',failure=?,claim=NULL,updated_at=? WHERE id=? AND state='running' AND claim=?").bind(failure(error),now,job.id,claim).run()
  }
 }
 const current=await readSettings(raw)
 if(current?.revision===settings.revision&&current.enabled)await refreshTeamsSources(runtime,settings,state.epoch,clock)
}
async function refreshTeamsSources(runtime:PennyRuntime,settings:TeamsSettings,epoch:number,clock:number){
 const db=fenced(runtime,settings,epoch),now=new Date(clock).toISOString()
 const sources=(await db.prepare("SELECT * FROM penny_teams_sources WHERE source_state IN('current','changed') AND check_claim IS NULL AND check_failure IS NULL AND next_check<=? ORDER BY next_check,evidence_id LIMIT 10").bind(now).all<Source>()).results
 for(const source of sources){
  if(!selected(settings,source.team_id,source.channel_id))continue
  const claim=crypto.randomUUID(),claimed=await db.prepare("UPDATE penny_teams_sources SET check_claim=?,check_started_at=?,check_failure='teams_source_check_in_progress' WHERE evidence_id=? AND source_state IN('current','changed') AND check_claim IS NULL AND check_failure IS NULL AND next_check<=? RETURNING evidence_id").bind(claim,now,source.evidence_id,now).all()
  if(!claimed.results.length)continue
  // The persisted claim is checked again in every completion transaction. A
  // lease recovery, scope change, removal or purge permanently fences this read.
  const guard=captureGuard(settings);guard.sql+=" AND EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND epoch=?) AND EXISTS(SELECT 1 FROM penny_teams_sources WHERE evidence_id=? AND check_claim=? AND source_state IN('current','changed'))";guard.params.push(epoch,source.evidence_id,claim)
  const commit=guardedDatabase(runtime.database.binding,guard)
  try{
   const response=await teamsMessage(runtime,source.team_id,source.channel_id,source.message_id,source.parent_message_id,()=>commit.prepare('SELECT 1').first())
   if([401,403,404].includes(response.status)||(response.status===200&&isDeletedMessage(response.body,source.message_id))){
    await commit.prepare("UPDATE penny_teams_sources SET source_state='removed',removed_at=?,purge_at=?,check_failure=NULL,check_claim=NULL,check_started_at=NULL WHERE evidence_id=?").bind(now,new Date(clock+settings.purge_days*86400000).toISOString(),source.evidence_id).run()
   }else{
    if(response.status!==200)throw new NativeError(response.status===429?'teams_rate_limited':'teams_provider_unavailable',503)
    const parsed=sourceMessage.safeParse(JSON.parse(response.body))
    if(!parsed.success||parsed.data.id!==source.message_id)throw new NativeError('teams_message_invalid',503)
    const changed=await sourceHash(parsed.data)!==source.source_hash
    await commit.prepare("UPDATE penny_teams_sources SET source_state=CASE WHEN ? THEN 'changed' ELSE source_state END,next_check=?,check_failure=NULL,check_claim=NULL,check_started_at=NULL WHERE evidence_id=?").bind(changed?1:0,new Date(clock+3600000).toISOString(),source.evidence_id).run()
   }
  }catch(error){
   await runtime.database.binding.prepare("UPDATE penny_teams_sources SET check_failure=?,check_claim=NULL,check_started_at=NULL WHERE evidence_id=? AND check_claim=? AND source_state IN('current','changed')").bind(failure(error),source.evidence_id,claim).run()
  }
 }
}
/** Purging continues while capture is paused, without a provider read. */
export async function purgeTeamsSources(runtime:PennyRuntime,clock=Date.now()){
 const raw=runtime.database.binding,state=await raw.prepare("SELECT epoch FROM data_state WHERE singleton=1 AND phase='idle'").first<{epoch:number}>()
 if(!state)return
 const db=guardedDatabase(raw,{sql:"EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle' AND epoch=?)",params:[state.epoch]}),now=new Date(clock).toISOString()
 // Recovery also runs while paused, so a killed check always becomes visible.
 await db.prepare("UPDATE penny_teams_sources SET check_failure='interrupted_source_check_retry_required',check_claim=NULL,check_started_at=NULL WHERE check_claim IS NOT NULL AND check_started_at<=? AND source_state IN('current','changed')").bind(new Date(clock-300000).toISOString()).run()
 const sources=(await db.prepare("SELECT evidence_id FROM penny_teams_sources WHERE source_state='removed' AND purge_at<=? LIMIT 50").bind(now).all<{evidence_id:string}>()).results
 for(const source of sources)try{await db.batch([
  db.prepare("INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) SELECT ?,'system','teams-capture','teams.source_purged','evidence',?,?,?,? WHERE EXISTS(SELECT 1 FROM penny_teams_sources WHERE evidence_id=? AND source_state='removed' AND purge_at<=?)").bind(createUlid(),source.evidence_id,now,now,now,source.evidence_id,now),
  db.prepare("UPDATE evidence_versions SET wording='[Source removed]',updated_at=? WHERE evidence_id=? AND EXISTS(SELECT 1 FROM penny_teams_sources WHERE evidence_id=? AND source_state='removed' AND purge_at<=?)").bind(now,source.evidence_id,source.evidence_id,now),
  db.prepare("UPDATE evidence_items SET named_speaker=NULL,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM penny_teams_sources WHERE evidence_id=? AND source_state='removed' AND purge_at<=?)").bind(now,source.evidence_id,source.evidence_id,now),
  db.prepare("UPDATE penny_teams_sources SET source_state='purged',check_failure=NULL,check_claim=NULL,check_started_at=NULL WHERE evidence_id=? AND source_state='removed' AND purge_at<=?").bind(source.evidence_id,now),
 ])}catch{
  await db.prepare("UPDATE penny_teams_sources SET check_failure='teams_purge_failed' WHERE evidence_id=? AND source_state='removed'").bind(source.evidence_id).run()
  throw new NativeError('teams_purge_failed',503)
 }
}
