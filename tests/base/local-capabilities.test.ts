import { applyD1Migrations, reset } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { beforeEach, expect, inject, it } from 'vitest'
import { createPennyApi } from '@/core/app/api'
import { createPennyRuntime } from '@/core/app/runtime'
import { authMail } from '@/core/features/auth/mail'
import { digest, opaqueToken } from '@/core/features/auth/native-tokens'
const app=createPennyApi()
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
it('[REQ-003 REQ-023 BASE-SECRET-002] already verified requesters can submit when deployed mail is absent',async()=>{
 const stamp=new Date().toISOString()
 await env.DB.batch([
 env.DB.prepare("INSERT INTO boards(id,slug,name,visibility,position,created_at,updated_at) VALUES('board','feedback','Feedback','public',0,?,?)").bind(stamp,stamp),
 env.DB.prepare("INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES('person','Person',?,?)").bind(stamp,stamp),
 env.DB.prepare("INSERT INTO requester_addresses(id,requester_id,email,verified_at,created_at,updated_at) VALUES('address','person','person@example.test',?,?,?)").bind(stamp,stamp,stamp),
 ])
 const bindings={...env,PENNY_ENVIRONMENT:'production',MAIL_PROVIDER:undefined,MAIL_FROM:undefined,SENDGRID_API_KEY:undefined}
 const session={token:opaqueToken()}
 await env.DB.prepare("INSERT INTO native_requester_sessions(id,requester_id,address_id,token_hash,expires_at,last_used_at,created_at,updated_at) VALUES('session','person','address',?,?,?,?,?)").bind(await digest(session.token),new Date(Date.now()+86400000).toISOString(),stamp,stamp,stamp).run()
 const response=await app.fetch(new Request('https://penny.test/api/public/requests',{method:'POST',headers:{Origin:'https://penny.test','Content-Type':'application/json',Authorization:`Bearer ${session.token}`},body:JSON.stringify({title:'Useful improvement',description:'A verified customer problem',boardSlug:'feedback',idempotencyKey:crypto.randomUUID()})}),bindings)
 expect(response.status).toBe(201)
 expect(await env.DB.prepare('SELECT count(*) n FROM requests').first('n')).toBe(1)
})
for(const mode of ['preview','production'])it(`[BASE-ACCESS-001 REQ-023] ${mode} refuses development capture and viewer`,async()=>{
 const deployed={...env,PENNY_ENVIRONMENT:mode,MAIL_PROVIDER:undefined,MAIL_FROM:undefined,SENDGRID_API_KEY:undefined}
 const rt=createPennyRuntime(deployed)
 const forced={...rt,configuration:{...rt.configuration,mailProvider:'development'}}
 expect(authMail(forced)).toBeUndefined()
 for(const path of ['/__dev/outbox','/__dev/outbox?message=anything']) expect((await app.fetch(new Request('https://penny.test'+path),deployed)).status).toBe(404)
 expect(()=>createPennyRuntime({...deployed,MAIL_PROVIDER:'development',MAIL_FROM:'auth@localhost.test'})).toThrow('MAIL_PROVIDER')
 expect(await env.DB.prepare('SELECT count(*) n FROM rer_mail_development_outbox').first('n')).toBe(0)
})

it('[REQ-003 REQ-023 BASE-SECRET-002] missing mail cannot provision or hold an unverified submission',async()=>{
 const bindings={...env,PENNY_ENVIRONMENT:'production',MAIL_PROVIDER:undefined,MAIL_FROM:undefined,SENDGRID_API_KEY:undefined}
 const payload={title:'Unverified request',description:'Cannot establish identity',boardSlug:'feedback',idempotencyKey:crypto.randomUUID()}
 const cases:{headers:Record<string,string>;error:string}[]=[{headers:{},error:'mail_unavailable'},{headers:{'X-Penny-Pending-Token':opaqueToken()},error:'mail_unavailable'},{headers:{'X-Penny-Identity':'unsigned','X-Penny-Identity-Signature':'unsigned'},error:'auth_unavailable'}]
 for(const {headers,error} of cases){
  const response=await app.fetch(new Request('https://penny.test/api/public/requests',{method:'POST',headers:{Origin:'https://penny.test','Content-Type':'application/json',...headers},body:JSON.stringify(payload)}),bindings)
  expect(response.status).toBe(503);expect(await response.json()).toEqual({error})
 }
 const invalid=await app.fetch(new Request('https://penny.test/api/public/requests',{method:'POST',headers:{Origin:'https://penny.test','Content-Type':'application/json',Authorization:`Bearer ${opaqueToken()}`},body:JSON.stringify(payload)}),bindings)
 expect(invalid.status).toBe(401)
 for(const table of ['requests','requesters','evidence_items','requester_pending_actions'])expect(await env.DB.prepare(`SELECT count(*) n FROM ${table}`).first('n')).toBe(0)
})
it('[BASE-ACCESS-001 BASE-SECRET-002] existing operator authority remains usable without a mail provider',async()=>{
 const bindings={...env,PENNY_ENVIRONMENT:'production',MAIL_PROVIDER:undefined,MAIL_FROM:undefined,SENDGRID_API_KEY:undefined}
 const bootstrap=await app.fetch(new Request('https://penny.test/auth/bootstrap',{method:'POST',headers:{Origin:'https://penny.test','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.27'},body:JSON.stringify({token:'synthetic-base-setup-token-for-worker-tests',displayName:'Owner'})}),bindings)
 expect(bootstrap.status).toBe(303)
 const cookie=bootstrap.headers.get('set-cookie')!.split(';')[0]
 const session=await app.fetch(new Request('https://penny.test/api/auth/session',{headers:{Cookie:cookie}}),bindings)
 expect(session.status).toBe(200);expect(await session.json()).toMatchObject({authenticated:true})
 expect((await app.fetch(new Request('https://penny.test/api/operator/moderation',{headers:{Cookie:cookie}}),bindings)).status).toBe(200)
})
