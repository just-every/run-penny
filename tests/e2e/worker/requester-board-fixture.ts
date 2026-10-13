import { env } from 'cloudflare:workers'
import { createPennyApi } from '../../../src/core/app/api'
import { createUlid } from '../../../src/core/shared/ulid'
import { digest, opaqueToken } from '../../../src/core/features/auth/native-tokens'
import { nativeAuthoritySettings, nativeOwnerCookie } from '../../predecessor-native-authority'
export {env,createUlid,opaqueToken,digest}
export const bindings={...env,...nativeAuthoritySettings,PENNY_ENVIRONMENT:'test',PENNY_AUTH_TRANSPORT:'local-outbox',PORTAL_IDENTITY_SECRET:'isolated-host-fixture-key'}
export const app=createPennyApi({runtimeConfiguration:{operatorAllowlist:['reviewer@example.test'],workspaceTimezone:'UTC',publicOriginAllowlist:[bindings.APP_ORIGIN]}})
let nativeCookie=''
// Preserve caller headers so absent and foreign Origin requests remain testable.
export async function call(path:string,body?:unknown,headers:Record<string,string>={},method=body===undefined?'GET':'POST') {
 return app.fetch(new Request(`${bindings.APP_ORIGIN}${path}`,{method,headers:{...headers,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)}),bindings)
}
export const auth=(token:string)=>({Authorization:`Bearer ${token}`})
export async function fixture() {
 const now=new Date().toISOString(),board=createUlid(),operator=createUlid(),cookie=opaqueToken()
 await env.DB.batch([
  env.DB.prepare("INSERT INTO boards(id,slug,name,visibility,position,created_at,updated_at) VALUES(?,?,?,'public',0,?,?)").bind(board,`board-${board.toLowerCase()}`,'Feedback board',now,now),
  env.DB.prepare('INSERT INTO operators(id,email,display_name,created_at,updated_at) VALUES(?,?,?,?,?)').bind(operator,'reviewer@example.test','Reviewer',now,now),
  env.DB.prepare('INSERT INTO operator_sessions(id,operator_id,token_hash,expires_at,last_used_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(createUlid(),operator,await digest(cookie),new Date(Date.now()+86400000).toISOString(),now,now,now),
 ])
 // Current transaction guards require independently issued native authority;
 // the historical session alone must never authorize those mutations.
 nativeCookie=await nativeOwnerCookie(bindings,nativeCookie)
 return {board:`board-${board.toLowerCase()}`,operator,headers:{Cookie:`penny_operator_session=${cookie}; ${nativeCookie}`,Origin:bindings.APP_ORIGIN}}
}
export async function person() {
 const email=`${createUlid().toLowerCase()}@example.test`
 const issued=await call('/api/public/identity/email',{email,displayName:'Private requester'})
 if(issued.status!==202)throw new Error(`Issue identity: ${issued.status}`)
 const row=await env.DB.prepare("SELECT token FROM local_auth_outbox WHERE recipient=? AND purpose='requester'").bind(email).first<{token:string}>()
 const verified=await call('/api/public/identity/email/verify',{token:row!.token})
 if(verified.status!==200)throw new Error(`Verify identity: ${verified.status}`)
 const {token}=await verified.json() as {token:string}
 const record=await env.DB.prepare('SELECT requester_id AS id FROM requester_addresses WHERE email=?').bind(email).first<{id:string}>()
 return {email,token,id:record!.id}
}
export async function submit(board:string,token:string,title='Private problem wording') {
 const response=await call('/api/public/requests',{title,description:'Original observation, retained as evidence.',boardSlug:board,idempotencyKey:crypto.randomUUID()},auth(token))
 if(response.status!==201)throw new Error(`Submit: ${response.status} ${await response.text()}`)
 return await response.json() as {slug:string}
}
export async function publish(slug:string,board:string,headers:Record<string,string>,title='Published request') {
 const response=await call(`/api/operator/moderation/${slug}`,{verdict:'approved',title,description:'Approved public wording.',boardSlug:board,displayName:'Public requester'},headers)
 if(response.status!==200)throw new Error(`Approve: ${response.status} ${await response.text()}`)
}
