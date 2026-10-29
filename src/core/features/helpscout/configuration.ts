import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError} from '../auth/native-tokens'
import {guardedDatabase,type AuthorityGuard} from '../integrations/guarded-database'
export interface HelpScoutEgress {send(request:{url:string;method:'GET'|'POST';headers:Record<string,string>;body:string}):Promise<{status:number;headers:Record<string,string>;body:string}>}
export const sourceId=z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const secret=z.string().min(16).max(4096).regex(/^[^\r\n\0]+$/)
export const installInput=z.object({mailboxId:sourceId,tag:z.string().trim().min(1).max(100),sidebarUserId:sourceId,purgeDays:z.number().int().min(0).max(365),clientId:secret,clientSecret:secret,appSecret:secret.max(40),webhookSecret:secret.max(40)}).strict()
export interface Connection {id:string;mailbox_id:number;tag:string;sidebar_user_id:number;owner_id:string;owner_version:number;actor_id:string;revision:number;enabled:number;purge_days:number}
export interface Secrets {client_id:string;client_secret:string;app_secret:string;webhook_secret:string;access_token:string|null;expires_at:number|null}
export const readConnection=(db:D1Database)=>db.prepare('SELECT * FROM penny_helpscout_connection LIMIT 1').first<Connection>()
export function connectionGuard(c:Connection):AuthorityGuard{return {sql:`EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle') AND EXISTS(SELECT 1 FROM penny_helpscout_connection c JOIN oa_operators o ON o.id=c.owner_id JOIN penny_helpscout_secrets s ON s.connection_id=c.id WHERE c.id=? AND c.revision=? AND c.enabled=1 AND o.status='active' AND o.role='owner' AND o.version=c.owner_version)`,params:[c.id,c.revision]}}
export function connectionDb(runtime:PennyRuntime,c:Connection,extra?:AuthorityGuard){
 const guard=connectionGuard(c)
 if(extra){guard.sql+=' AND ('+extra.sql+')';guard.params.push(...extra.params)}
 return guardedDatabase(runtime.database.binding,guard)
}
export async function activeConnection(runtime:PennyRuntime){const c=await readConnection(runtime.database.binding);if(!c?.enabled)throw new NativeError('helpscout_disconnected',409);await connectionDb(runtime,c).prepare('SELECT 1').first();return c}
export async function wire(runtime:PennyRuntime,path:string,method:'GET'|'POST',body:string,headers:Record<string,string>={}){
 const port=runtime.bindings.PENNY_HELPSCOUT_EGRESS
 if(!port)throw new NativeError('helpscout_transport_unconfigured',503)
 if(!/^\/(oauth2\/token|conversations\/[0-9]+(?:\/threads|\/reply)?|customers\/[0-9]+|organizations\/[0-9]+)$/.test(path))throw new NativeError('helpscout_path_refused',400)
 let timer:ReturnType<typeof setTimeout>|undefined
 const response=await Promise.race([port.send({url:'https://api.helpscout.net/v2'+path,method,headers,body}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new NativeError('helpscout_provider_timeout',503)),15000)})]).finally(()=>clearTimeout(timer))
 if(!Number.isInteger(response.status)||response.status<100||response.status>599||typeof response.body!=='string'||new TextEncoder().encode(response.body).length>65536)throw new NativeError('helpscout_response_invalid',503)
 return response
}
export async function issueToken(runtime:PennyRuntime,clientId:string,clientSecret:string){
 const r=await wire(runtime,'/oauth2/token','POST',new URLSearchParams({grant_type:'client_credentials',client_id:clientId,client_secret:clientSecret}).toString(),{'Content-Type':'application/x-www-form-urlencoded'})
 if(r.status!==200)throw new NativeError('helpscout_oauth_refused',503)
 try{return z.object({access_token:secret,token_type:z.string().regex(/^bearer$/i),expires_in:z.number().int().min(1).max(604800)}).parse(JSON.parse(r.body))}catch{throw new NativeError('helpscout_oauth_invalid',503)}
}
export async function provider(runtime:PennyRuntime,c:Connection,path:string,method:'GET'|'POST'='GET',body=''){
 const db=connectionDb(runtime,c),s=await db.prepare('SELECT * FROM penny_helpscout_secrets WHERE connection_id=?').bind(c.id).first<Secrets>()
 if(!s)throw new NativeError('helpscout_disconnected',409)
 let token=s.access_token
 if(!token||!s.expires_at||s.expires_at<=Date.now()){
  const next=await issueToken(runtime,s.client_id,s.client_secret);token=next.access_token
  await db.prepare('UPDATE penny_helpscout_secrets SET access_token=?,expires_at=? WHERE connection_id=?').bind(token,Date.now()+next.expires_in*1000-30000,c.id).run()
 }
 // Re-check the current grant immediately before crossing the network edge.
 await db.prepare('SELECT 1').first()
 const r=await wire(runtime,path,method,body,{Authorization:'Bearer '+token,'Content-Type':'application/json'})
 if(r.status===401){await db.prepare('UPDATE penny_helpscout_secrets SET access_token=NULL,expires_at=NULL WHERE connection_id=?').bind(c.id).run();throw new NativeError('helpscout_reconnect_required',503)}
 return r
}
export function providerFailure(status:number):never{throw new NativeError(status===429?'helpscout_rate_limited':status===403?'helpscout_access_revoked':'helpscout_provider_unavailable',503)}
export const sourceUrl=(id:number)=>`https://secure.helpscout.net/conversation/${id}/`
