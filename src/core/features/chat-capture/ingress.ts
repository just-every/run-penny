import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError,digest} from '../auth/native-tokens'
import {boundedRawBody} from '../integrations/raw-body'
import {guardedDatabase} from '../integrations/guarded-database'
import {channels,connection} from './configuration'
import {messageTimestamp} from './slack'

export async function receive(runtime:PennyRuntime,request:Request,id:string,interactivity:boolean){
 const config=await connection(runtime,id)
 if(!config)throw new NativeError('capture_unavailable',404)
 const timestamp=request.headers.get('x-slack-request-timestamp')??'',signature=request.headers.get('x-slack-signature')??''
 if(!/^\d{10}$/.test(timestamp)||Math.abs(Date.now()/1000-Number(timestamp))>300||!/^v0=[a-f0-9]{64}$/.test(signature))throw new NativeError('invalid_slack_signature',401)
 const raw=await boundedRawBody(request),prefix=new TextEncoder().encode('v0:'+timestamp+':'),signed=new Uint8Array(prefix.length+raw.length)
 signed.set(prefix);signed.set(raw,prefix.length)
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(config.signing_secret),{name:'HMAC',hash:'SHA-256'},false,['verify'])
 if(!await crypto.subtle.verify('HMAC',key,Uint8Array.from(signature.slice(3).match(/../g)!,byte=>parseInt(byte,16)),signed))throw new NativeError('invalid_slack_signature',401)
 let payload;try{const body=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(raw);payload=JSON.parse(interactivity?new URLSearchParams(body).get('payload')??'':body)}catch{throw new NativeError('invalid_slack_payload',400)}
 if(!payload||typeof payload!=='object')throw new NativeError('invalid_slack_payload',400)
 if(!interactivity&&payload.type==='url_verification'){
  if(typeof payload.challenge!=='string'||payload.challenge.length>1000)throw new NativeError('invalid_slack_payload',400)
  return {challenge:payload.challenge}
 }
 if((interactivity?payload.team?.id:payload.team_id)!==config.team_id||payload.api_app_id!==config.app_id)throw new NativeError('slack_workspace_mismatch',403)
 let channel:unknown,stamp:unknown,capturer:unknown,receipt:unknown,kind:'capture'|'refresh'|'remove'='capture'
 if(interactivity){
  if(payload.type!=='message_action'||payload.callback_id!=='send_to_penny')return {ignored:true}
  channel=payload.channel?.id;stamp=payload.message?.ts;capturer=payload.user?.id;receipt=payload.trigger_id
 }else{
  if(payload.type!=='event_callback')return {ignored:true}
  const event=payload.event
  if(event?.type==='reaction_added'&&event.reaction===config.reaction&&event.item?.type==='message'){
   channel=event.item.channel;stamp=event.item.ts;capturer=event.user
  }else if(event?.type==='message'&&['message_changed','message_deleted'].includes(event.subtype)){
   channel=event.channel;stamp=event.deleted_ts??event.message?.ts;kind=event.subtype==='message_deleted'?'remove':'refresh'
  }else if(event?.type==='app_uninstalled'||event?.type==='tokens_revoked'){
   const db=runtime.database.binding,now=Date.now()
   await guardedDatabase(db,{sql:"EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle') AND EXISTS(SELECT 1 FROM penny_chat_connections WHERE id=? AND state='active')",params:[id]}).batch([
    db.prepare("UPDATE penny_chat_sources SET state='removed',removed_at=?,purge_at=?+?*86400000 WHERE connection_id=? AND state NOT IN('removed','purged')").bind(now,now,config.purge_days,id),
    db.prepare("UPDATE penny_chat_connections SET state='revoked',last_failure='slack_access_revoked' WHERE id=?").bind(id),
    db.prepare('DELETE FROM penny_chat_secrets WHERE connection_id=?').bind(id),
    db.prepare("UPDATE penny_chat_jobs SET state='stopped',failure='slack_access_revoked',lease=NULL,lease_until=NULL WHERE connection_id=? AND state IN('pending','running','failed')").bind(id),
   ])
   return {stopped:true}
  }else return {ignored:true}
  receipt=payload.event_id
 }
 if(typeof channel!=='string'||!channels(config).includes(channel))return {ignored:true}
 if(!messageTimestamp(stamp)||typeof receipt!=='string'||!receipt.length||receipt.length>300||kind==='capture'&&(typeof capturer!=='string'||!/^[A-Z][A-Z0-9]{1,79}$/.test(capturer)))throw new NativeError('invalid_slack_payload',400)
 const db=guardedDatabase(runtime.database.binding,{sql:"EXISTS(SELECT 1 FROM penny_chat_connections c JOIN oa_operators o ON o.id=c.native_operator_id WHERE c.id=? AND c.state='active' AND o.status='active' AND o.role='owner' AND o.version=c.operator_version) AND EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle')",params:[id]})
 if(kind!=='capture'&&!await db.prepare('SELECT 1 FROM penny_chat_sources WHERE workspace_id=? AND channel_id=? AND message_ts=?').bind(config.team_id,channel,stamp).first())return {ignored:true}
 const now=Date.now()
 await db.prepare('INSERT INTO penny_chat_jobs(id,connection_id,receipt,channel_id,message_ts,capturer,kind,due_at,created_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(connection_id,receipt) DO NOTHING').bind(crypto.randomUUID(),id,await digest(receipt),channel,stamp,capturer??null,kind,now,now).run()
 return {accepted:true}
}
