import type { PennyRuntime } from '@/core/app/runtime'
import { NativeError } from '@/core/features/auth/native-tokens'
import { epochSql, linkEpoch } from './link-epochs'
interface Claims {v:1|2;epoch?:number;resolvedEmail?:string;requesterId:string;addressId:string;emailHash:string;scope:string}
const encode=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
function decode(text:string){return Uint8Array.from(atob(text.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))}
async function emailHash(runtime:PennyRuntime,email:string,version=2){
 const bytes=new TextEncoder().encode(email)
 return encode(new Uint8Array(version===1?await crypto.subtle.digest('SHA-256',bytes):await crypto.subtle.sign('HMAC',await key(runtime),new TextEncoder().encode(`email:${email}`))))
}
async function key(runtime:PennyRuntime){
 const secret=runtime.configuration.authSecret
 if(!secret || secret.length<32)throw new NativeError('AUTH_SECRET_required',503)
 return crypto.subtle.importKey('raw',new TextEncoder().encode(`penny-unsubscribe-v1:${secret}`),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])
}
export async function unsubscribeUrl(runtime:PennyRuntime, recipient:{requesterId:string;addressId:string;email:string},scope:string) {
 const claims:Claims={v:2,epoch:await linkEpoch(runtime.database.binding,recipient.addressId,scope),requesterId:recipient.requesterId,addressId:recipient.addressId,emailHash:await emailHash(runtime,recipient.email),scope}
 const payload=encode(new TextEncoder().encode(JSON.stringify(claims)))
 const signature=encode(new Uint8Array(await crypto.subtle.sign('HMAC',await key(runtime),new TextEncoder().encode(payload))))
 if(!runtime.configuration.appOrigin)throw new NativeError('APP_ORIGIN_required',503)
 return `${runtime.configuration.appOrigin}/api/public/notifications/unsubscribe?token=${payload}.${signature}`
}
export async function readUnsubscribe(runtime:PennyRuntime, token:string):Promise<Claims> {
 let claims:Claims
 try {
  if(token.length>2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))throw new Error('invalid')
  const [payload,signature]=token.split('.')
  if(!await crypto.subtle.verify('HMAC',await key(runtime),decode(signature),new TextEncoder().encode(payload)))throw new Error('invalid')
  claims=JSON.parse(new TextDecoder().decode(decode(payload))) as Claims
  if(![1,2].includes(claims.v)||(claims.v===2&&(!Number.isSafeInteger(claims.epoch)||claims.epoch!<0))||typeof claims.scope!=='string'||!claims.scope||typeof claims.requesterId!=='string'||!claims.requesterId||typeof claims.addressId!=='string'||!claims.addressId||typeof claims.emailHash!=='string')throw new Error('invalid')
 }catch(error){if(error instanceof NativeError && error.status===503)throw error;throw new NativeError('invalid_unsubscribe_link',400)}
 // Storage failure is unavailable, never a claim that the person's link expired.
 const db=runtime.database.binding
 if((await db.prepare('SELECT phase FROM data_state WHERE singleton=1').first<{phase:string}>())?.phase!=='idle')throw new NativeError('data_maintenance',503)
 const row=await db.prepare(`WITH RECURSIVE identity(id) AS (SELECT ? UNION SELECT m.target_requester_id FROM requester_identity_merges m JOIN identity ON m.source_requester_id=identity.id)
 SELECT email,requester_id AS requesterId FROM requester_addresses WHERE id=? AND requester_id IN(SELECT id FROM identity)`).bind(claims.requesterId,claims.addressId).first<{email:string;requesterId:string}>()
 if(!row||await emailHash(runtime,row.email,claims.v)!==claims.emailHash||await linkEpoch(db,claims.addressId,claims.scope)!==(claims.epoch??0))throw new NativeError('invalid_unsubscribe_link',400)
 if(claims.scope!=='all'&&!await db.prepare('SELECT id FROM requests WHERE id=?').bind(claims.scope).first())throw new NativeError('invalid_unsubscribe_link',400)
 return {...claims,requesterId:row.requesterId,resolvedEmail:row.email}
}
export function globalMuteStatement(db:D1Database, requesterId:string, muted:boolean, now:string){
 return db.prepare(`INSERT INTO requester_notification_preferences(requester_id,muted_at,created_at,updated_at) VALUES(?,?,?,?)
 ON CONFLICT(requester_id) DO UPDATE SET muted_at=excluded.muted_at,updated_at=excluded.updated_at`).bind(requesterId,muted?now:null,now,now)
}
export async function applyUnsubscribe(runtime:PennyRuntime,token:string){
 const c=await readUnsubscribe(runtime,token),db=runtime.database.binding,now=new Date().toISOString()
 // Request-scoped links mute only that request. The global link also withdraws
 // this address's update subscription; follows and votes remain in either case.
 const action=c.scope==='all'?globalMuteStatement(db,c.requesterId,true,now):db.prepare(`INSERT INTO request_notification_mutes(requester_id,request_id,created_at,updated_at) VALUES(?,?,?,?)
 ON CONFLICT(requester_id,request_id) DO UPDATE SET updated_at=excluded.updated_at`).bind(c.requesterId,c.scope,now,now)
 const guard=crypto.randomUUID()
 try {await db.batch([
  db.prepare(`INSERT INTO requester_write_guards(id,permitted) VALUES(?,CASE WHEN ${epochSql}=? AND EXISTS(SELECT 1 FROM requester_addresses WHERE id=? AND requester_id=? AND email=?) THEN 1 ELSE 0 END)`).bind(guard,c.addressId,c.scope,c.epoch??0,c.addressId,c.requesterId,c.resolvedEmail!),
  action,...(c.scope==='all'?[db.prepare("UPDATE requester_update_permissions SET revoked_at=?,updated_at=? WHERE requester_id=? AND requester_address_id=? AND source='subscription' AND request_id IS NULL AND revoked_at IS NULL").bind(now,now,c.requesterId,c.addressId)]:[]),db.prepare('DELETE FROM requester_write_guards WHERE id=?').bind(guard),
 ])}catch(error){if(String(error).includes('requester_write_admitted'))throw new NativeError('invalid_unsubscribe_link',400);throw error}
 return c.scope
}
