import {mockMail} from './support'
import { applyD1Migrations, reset } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { beforeEach, afterEach, expect, inject, it, vi } from 'vitest'
import { createPennyApi } from '@/core/app/api'
import { createPennyRuntime } from '@/core/app/runtime'
import { providerMessages } from './provider-messages'
import { authMail } from '@/core/features/auth/mail'
import { exportArchive, planErasure, eraseEntity } from '@/core/features/data/archive'
const origin='https://127.0.0.1:8787'
const devKey='synthetic-checkout-dev-key-for-worker-tests-0123456789'
const bindings=()=>({...env,PENNY_ENVIRONMENT:'test',APP_ORIGIN:origin,MAIL_PROVIDER:'sendgrid',SENDGRID_API_KEY:'synthetic-provider-test-key',RESEND_API_KEY:undefined,RER_DEV_KEY:devKey})
const runtime=()=>createPennyRuntime(bindings())
const app=createPennyApi()
function call(path:string,body?:unknown,headers:Record<string,string>={},mode=bindings(),method=body===undefined?'GET':'POST') {
 return app.fetch(new Request(origin+path,{method,headers:{Host:'127.0.0.1:8787',Origin:origin,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),mode)
}
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'));mockMail()})
afterEach(()=>vi.restoreAllMocks())
it('[BASE-ACCESS-001 BASE-ACCESS-003 REQ-023] both identities use the provider transport, confirm once, and retain private custody',async()=>{
 const owner=await call('/auth/bootstrap',{token:'synthetic-base-setup-token-for-worker-tests',displayName:'Owner'})
 expect(owner.status).toBe(303)
 expect((await call('/api/auth/magic-link',{email:'owner@penny.invalid'})).status).toBe(202)
 expect((await call('/api/public/identity/email',{email:'local-requester@example.test',displayName:'Local requester'})).status).toBe(202)
 const messages=await providerMessages(runtime())!.list();expect(messages).toHaveLength(2)
 const operator=messages.find(m=>m.message.to[0]==='owner@penny.invalid')!
 expect(operator.message.html).toContain('Penny');expect(operator.message.text).toContain('Penny')
 const url=new URL(operator.message.text!.match(/https?:\/\/\S+/)![0]),token=url.searchParams.get('token')!
 const preview=await call(url.pathname+url.search)
 expect(preview.status).toBe(200);expect(preview.headers.get('Set-Cookie')).toBeNull()
 expect(preview.headers.get('Referrer-Policy')).toBe('strict-origin')
 const html=await preview.text();expect(html).toContain('Confirm sign-in to Penny');expect(html).toContain('#ad4a1f');expect(html).toContain('<style>')
 expect((await call('/auth/confirm',{token},{Origin:'https://foreign.test'})).status).toBe(403)
 expect((await call('/auth/confirm',{token})).status).toBe(303)
 expect((await call('/auth/confirm',{token})).status).toBe(400)
 const expired=await call(url.pathname+url.search);expect(expired.status).toBe(400);expect(await expired.text()).toContain('Request a new link')
 const requester=messages.find(m=>m.message.to[0]==='local-requester@example.test')!
 const requesterToken=new URL(requester.message.text!.match(/https?:\/\/\S+/)![0]).hash.slice(7)
 expect((await call('/api/public/identity/email/verify',{token:requesterToken})).status).toBe(200)
 expect((await call('/api/public/identity/email/verify',{token:requesterToken})).status).toBe(401)
 const snapshot=await exportArchive(env.DB,env.FILES)
 expect(snapshot.archive.tables).not.toHaveProperty('rer_mail_development_outbox')
 expect(JSON.stringify(snapshot)).not.toContain(token)
 const person=await env.DB.prepare('SELECT requester_id id FROM requester_addresses WHERE email=?').bind('local-requester@example.test').first<{id:string}>()
 const plan=await planErasure(env.DB,'requesters',person!.id)
 await eraseEntity(env.DB,env.FILES,'requesters',person!.id,plan.planHash)
})
it('[BASE-ACCESS-002 OPS-002] branded invitation is multipart and cancelled identities can receive a fresh same-role invitation',async()=>{
 const bootstrap=await call('/auth/bootstrap',{token:'synthetic-base-setup-token-for-worker-tests',displayName:'Owner'})
 expect(bootstrap.status).toBe(303)
 const owner={Cookie:bootstrap.headers.get('set-cookie')!.split(';')[0]}
 const management='/api/operator/settings/operators'
 const invite=()=>call(management,{email:'invitee@example.test'},owner)
 const invitation=await invite();expect(invitation.status,await invitation.clone().text()).toBe(202)
 const first=(await providerMessages()!.list())[0]
 expect(first.message.subject).toBe("You're invited to Penny");expect(first.message.text).toContain('Penny');expect(first.message.html).toContain('Penny')
 const person=await env.DB.prepare('SELECT id,role FROM oa_operators WHERE email=?').bind('invitee@example.test').first<{id:string;role:string}>()
 expect((await call(`${management}/${person!.id}`,{},owner,bindings(),'DELETE')).status).toBe(200)
 expect(await env.DB.prepare('SELECT status FROM oa_operators WHERE id=?').bind(person!.id).first()).toEqual({status:'inactive'})
 const reinvitation=await invite();expect(reinvitation.status,await reinvitation.clone().text()).toBe(202)
 const invitations=await providerMessages()!.list();expect(invitations).toHaveLength(2)
 expect(await env.DB.prepare('SELECT id,status,role FROM oa_operators WHERE email=?').bind('invitee@example.test').first()).toEqual({...person,status:'invited'})
 const token=(text:string)=>new URL(text.match(/https?:\/\/\S+/)![0]).searchParams.get('token')!
 expect((await call('/auth/confirm',{token:token(first.message.text!)})).status).toBe(400)
 const fresh=invitations.find(message=>message.id!==first.id)!
 expect(fresh.message.text).toContain('Penny');expect(fresh.message.html).toContain('Penny')
 const confirmation=await call('/auth/confirm',{token:token(fresh.message.text!)})
 expect(confirmation.status).toBe(303)
 const invitee={Cookie:confirmation.headers.get('set-cookie')!.split(';')[0]}
 expect((await call(management,undefined,invitee)).status).toBe(200)
 // An accepted native member can invite a peer with the same product authority.
 expect((await call(management,{email:'peer@example.test'},invitee)).status).toBe(202)
 expect(await env.DB.prepare('SELECT status,role FROM oa_operators WHERE id=?').bind(person!.id).first()).toEqual({status:'active',role:person!.role})
})
it('[BASE-ACCESS-001 REQ-023] deployed no-provider forms remain readable and never expose development capture',async()=>{
 const deployed={...bindings(),PENNY_ENVIRONMENT:'production',APP_ORIGIN:'https://penny.test',MAIL_PROVIDER:undefined,MAIL_FROM:undefined}
 const rt=createPennyRuntime(deployed)
 expect(authMail(rt)).toBeUndefined()
 for(const path of ['/__dev/outbox','/__dev/outbox?message=anything']) {
  const response=await app.fetch(new Request('https://penny.test'+path,{headers:{Host:'penny.test'}}),deployed)
  expect(response.status).toBe(404)
 }
 const response=await app.fetch(new Request('https://penny.test/api/auth/capabilities'),deployed)
 expect(response.status).toBe(200);expect(await response.json()).toMatchObject({transport:'unavailable'})
})
