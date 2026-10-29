import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError,digest} from '../auth/native-tokens'
import {guardedDatabase} from '../integrations/guarded-database'
import {recordEvidence} from '../evidence/write-service'
import {connectionDb,readConnection,type Connection} from './configuration'
import {readSource,mapCustomer} from './source'
import {prepareReplies} from './replies'
export interface Capture {connection_id:string;conversation_id:number;state:string;failure:string|null;revision:number;trigger_kind:string;mailbox_id:number;capture_tag:string;claim:string|null;evidence_id:string|null;request_id:string|null;customer_id:number|null;source_hash:string|null;source_state:string;next_check:string|null}
export const sourceDigest=(c:Connection,id:number)=>digest(c.id+':'+id)
export async function enqueue(runtime:PennyRuntime,c:Connection,id:number,kind='tag'){
 const db=connectionDb(runtime,c),now=new Date().toISOString()
 if(await db.prepare('SELECT 1 FROM penny_helpscout_receipts WHERE source_digest=?').bind(await sourceDigest(c,id)).first())return
 await db.prepare("INSERT INTO penny_helpscout_captures(connection_id,conversation_id,revision,trigger_kind,mailbox_id,capture_tag,state,created_at,updated_at) VALUES(?,?,?,?,?,?,'pending',?,?) ON CONFLICT DO NOTHING").bind(c.id,id,c.revision,kind,c.mailbox_id,c.tag,now,now).run()
}
export async function drainHelpScout(runtime:PennyRuntime,clock=Date.now()){
 const raw=runtime.database.binding,c=await readConnection(raw),now=new Date(clock).toISOString(),epoch=await raw.prepare("SELECT epoch FROM data_state WHERE singleton=1 AND phase='idle'").first<number>('epoch')
 if(epoch===null)return
 if(!c)return
 // Purge due removals even after disconnection. The installation's data fence
 // still applies, while connector authority is needed for every provider read.
 const purgeDb=guardedDatabase(raw,{sql:"EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle' AND epoch=?)",params:[epoch]})
 const due=(await purgeDb.prepare("SELECT evidence_id FROM penny_helpscout_captures WHERE source_state='removed' AND purge_at<=? LIMIT 20").bind(now).all<{evidence_id:string}>()).results
 for(const row of due)await purgeDb.batch([
  purgeDb.prepare("UPDATE evidence_versions SET wording='[Source removed]',updated_at=? WHERE evidence_id=?").bind(now,row.evidence_id),
  purgeDb.prepare("UPDATE evidence_items SET named_speaker=NULL,updated_at=? WHERE id=?").bind(now,row.evidence_id),
  purgeDb.prepare("UPDATE penny_helpscout_captures SET source_state='purged',updated_at=? WHERE evidence_id=? AND source_state='removed'").bind(now,row.evidence_id),
  purgeDb.prepare("UPDATE penny_helpscout_replies SET body='[Source removed]',edited_body=NULL,state='held',updated_at=? WHERE evidence_id=?").bind(now,row.evidence_id),
 ])
 await purgeDb.prepare("UPDATE penny_helpscout_replies SET state='unknown' WHERE state='sending' AND updated_at<?").bind(new Date(clock-300000).toISOString()).run()
 if(!c.enabled)return
 let db:D1Database
 try{db=connectionDb(runtime,c);await db.prepare('SELECT 1').first()}catch{return}
 // One durable claim across capture, source checks and background draft work.
 // Interrupted reads are visible and require an explicit owner retry.
 await db.prepare("UPDATE penny_helpscout_captures SET state='failed',claim=NULL,failure='interrupted_read_retry_required',updated_at=? WHERE state='running' AND started_at<?").bind(now,new Date(clock-300000).toISOString()).run()
 const rows=(await db.prepare("SELECT * FROM penny_helpscout_captures WHERE state='pending' OR (state='done' AND source_state IN('current','changed') AND next_check<=?) ORDER BY updated_at,conversation_id LIMIT 10").bind(now).all<Capture>()).results
 for(const row of rows){
  if(row.mailbox_id!==c.mailbox_id||(row.trigger_kind==='tag'&&row.capture_tag!==c.tag))continue
  const claim=crypto.randomUUID(),claimed=await db.prepare("UPDATE penny_helpscout_captures SET state='running',claim=?,started_at=?,attempts=attempts+1,updated_at=? WHERE connection_id=? AND conversation_id=? AND state IN('pending','done') AND revision=? RETURNING 1").bind(claim,now,now,c.id,row.conversation_id,c.revision).all()
  if(!claimed.results.length)continue
  const commit=connectionDb(runtime,c,{sql:"EXISTS(SELECT 1 FROM penny_helpscout_captures WHERE connection_id=? AND conversation_id=? AND state='running' AND claim=?) AND EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND epoch=?)",params:[c.id,row.conversation_id,claim,epoch]})
  try{
   const value=await readSource(runtime,c,row.conversation_id,row.trigger_kind==='tag')
   if(!value){
    await commit.prepare("UPDATE penny_helpscout_captures SET state=CASE WHEN evidence_id IS NULL THEN 'stopped' ELSE 'done' END,source_state='removed',removed_at=?,purge_at=?,claim=NULL,failure='source_removed',updated_at=? WHERE connection_id=? AND conversation_id=?").bind(now,new Date(clock+c.purge_days*86400000).toISOString(),now,c.id,row.conversation_id).run();continue
   }
   if(!row.evidence_id){
    const person=await mapCustomer(runtime,c,commit,value.source.primaryCustomer,now),awaitDigest=await sourceDigest(c,row.conversation_id)
    await recordEvidence(commit,{sourceType:'support_conversation',sourceLabel:'Help Scout conversation '+row.conversation_id,wording:value.wording,namedSpeaker:person.name,observedAt:value.observedAt,accountId:person.accountId},c.actor_id,now,undefined,undefined,{systemActor:'helpscout-capture',statements:id=>[
     commit.prepare('UPDATE evidence_items SET requester_id=? WHERE id=?').bind(person.requesterId,id),
     commit.prepare('INSERT INTO penny_helpscout_receipts(source_digest) VALUES(?)').bind(awaitDigest),
     commit.prepare("UPDATE penny_helpscout_captures SET state='done',claim=NULL,evidence_id=?,customer_id=?,source_hash=?,next_check=?,failure=NULL,updated_at=? WHERE connection_id=? AND conversation_id=?").bind(id,value.source.primaryCustomer.id,value.hash,new Date(clock+3600000).toISOString(),now,c.id,row.conversation_id),
    ]})
   }else await commit.prepare("UPDATE penny_helpscout_captures SET state='done',claim=NULL,source_state=CASE WHEN source_hash<>? THEN 'changed' ELSE source_state END,next_check=?,failure=NULL,updated_at=? WHERE connection_id=? AND conversation_id=?").bind(value.hash,new Date(clock+3600000).toISOString(),now,c.id,row.conversation_id).run()
   await db.prepare('UPDATE penny_helpscout_connection SET last_success=?,failure=NULL WHERE id=?').bind(now,c.id).run()
  }catch(error){
   const failure=error instanceof NativeError?error.code:'helpscout_source_invalid'
   await raw.batch([raw.prepare("UPDATE penny_helpscout_captures SET state='failed',claim=NULL,failure=?,updated_at=? WHERE connection_id=? AND conversation_id=? AND claim=?").bind(failure,now,c.id,row.conversation_id,claim),raw.prepare('UPDATE penny_helpscout_connection SET failure=? WHERE id=? AND revision=?').bind(failure,c.id,c.revision)])
  }
 }
 try{await prepareReplies(runtime,c,now)}catch(error){if(!(error instanceof NativeError&&['integration_authority_changed','helpscout_disconnected'].includes(error.code)))throw error}
}
