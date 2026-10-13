import { applyD1Migrations, reset } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { beforeEach, expect, inject, it } from 'vitest'
import { createPennyApi } from '@/core/app/api'
import { createPennyRuntime } from '@/core/app/runtime'
import { operatorAuth } from '@/core/features/auth/operator'
import { localOutbox } from '@/core/features/auth/local-outbox'
import { authMail } from '@/core/features/auth/mail'
import { exportArchive, planErasure, eraseEntity } from '@/core/features/data/archive'
const origin='http://127.0.0.1:8787'
const devKey='synthetic-checkout-dev-key-for-worker-tests-0123456789'
const bindings=()=>({...env,PENNY_ENVIRONMENT:'local',APP_ORIGIN:origin,MAIL_PROVIDER:'development',SENDGRID_API_KEY:undefined,RESEND_API_KEY:undefined,RER_DEV_KEY:devKey})
const runtime=()=>createPennyRuntime(bindings())
const app=createPennyApi()
function call(path:string,body?:unknown,headers:Record<string,string>={},mode=bindings()) {
 return app.fetch(new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{Host:'127.0.0.1:8787',Origin:origin,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),mode)
}
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
it('[BASE-ACCESS-001 BASE-ACCESS-003 REQ-023] both identities use the real Base D1 outbox, confirm once, and retain private custody',async()=>{
 const owner=await call('/auth/bootstrap',{token:'synthetic-base-setup-token-for-worker-tests',displayName:'Owner'})
 expect(owner.status).toBe(303)
 expect((await call('/api/auth/magic-link',{email:'owner@penny.invalid'})).status).toBe(202)
 expect((await call('/api/public/identity/email',{email:'local-requester@example.test',displayName:'Local requester'})).status).toBe(202)
 const messages=await localOutbox(runtime())!.list();expect(messages).toHaveLength(2)
 const operator=messages.find(m=>m.message.to[0]==='owner@penny.invalid')!
 expect(operator.message.html).toContain('Penny');expect(operator.message.text).toContain('Penny')
 const url=new URL(operator.message.text!.match(/http:\/\/\S+/)![0]),token=url.searchParams.get('token')!
 const preview=await call(url.pathname+url.search)
 expect(preview.status).toBe(200);expect(preview.headers.get('Set-Cookie')).toBeNull()
 expect(preview.headers.get('Referrer-Policy')).toBe('strict-origin')
 const html=await preview.text();expect(html).toContain('Confirm sign-in to Penny');expect(html).toContain('#ad4a1f');expect(html).toContain('<style>')
 expect((await call('/auth/confirm',{token},{Origin:'https://foreign.test'})).status).toBe(403)
 expect((await call('/auth/confirm',{token})).status).toBe(303)
 expect((await call('/auth/confirm',{token})).status).toBe(400)
 const expired=await call(url.pathname+url.search);expect(expired.status).toBe(400);expect(await expired.text()).toContain('Request a new link')
 const requester=messages.find(m=>m.message.to[0]==='local-requester@example.test')!
 const requesterToken=new URL(requester.message.text!.match(/http:\/\/\S+/)![0]).hash.slice(7)
 expect((await call('/api/public/identity/email/verify',{token:requesterToken})).status).toBe(200)
 expect((await call('/api/public/identity/email/verify',{token:requesterToken})).status).toBe(401)
 // The outbox answers only behind the checkout's key gate (header, or the cookie /__dev/key trades for it).
 const gated={'x-rer-dev-key':devKey}
 expect((await call('/__dev/outbox')).status).toBe(404)
 expect((await call('/__dev/outbox',undefined,{'x-rer-dev-key':devKey.replace('0','1')})).status).toBe(404)
 expect((await call('/__dev/outbox',undefined,{},{...bindings(),RER_DEV_KEY:undefined} as never)).status).toBe(404)
 const view=await call('/__dev/outbox',undefined,gated);expect(view.status).toBe(200);expect(view.headers.get('Cache-Control')).toBe('no-store')
 expect(await view.text()).toContain('Verify your Penny email')
 const detail=await call('/__dev/outbox?message='+operator.id,undefined,gated);expect(await detail.text()).toContain('Open this link')
 expect((await call('/__dev/outbox',undefined,{...gated,Host:'foreign.test'})).status).toBe(404)
 expect((await call('/__dev/outbox',undefined,{...gated,'Sec-Fetch-Site':'cross-site'})).status).toBe(404)
 const exchange=await call('/__dev/key',{key:devKey});expect(exchange.status).toBe(204)
 const cookie=exchange.headers.get('Set-Cookie')!.split(';')[0]
 expect((await call('/__dev/outbox',undefined,{Cookie:cookie})).status).toBe(200)
 const snapshot=await exportArchive(env.DB,env.FILES)
 expect(snapshot.archive.tables).not.toHaveProperty('rer_mail_development_outbox')
 expect(JSON.stringify(snapshot)).not.toContain(token)
 const person=await env.DB.prepare('SELECT requester_id id FROM requester_addresses WHERE email=?').bind('local-requester@example.test').first<{id:string}>()
 const plan=await planErasure(env.DB,'requesters',person!.id)
 await eraseEntity(env.DB,env.FILES,'requesters',person!.id,plan.planHash)
 expect((await localOutbox(runtime())!.list()).map(m=>m.message.to[0])).toEqual(['owner@penny.invalid'])
})
it('[BASE-ACCESS-002 OPS-002] branded invitation is multipart and cancelled identities can receive a fresh same-role invitation',async()=>{
 const bootstrap=await call('/auth/bootstrap',{token:'synthetic-base-setup-token-for-worker-tests',displayName:'Owner'})
 const cookie=bootstrap.headers.get('set-cookie')!.split(';')[0]
 const rt=createPennyRuntime(bindings(),{operatorAllowlist:['owner@penny.invalid','invitee@example.test'],workspaceTimezone:'UTC',publicOriginAllowlist:[origin]})
 const auth=operatorAuth(rt),request=new Request(origin+'/auth/invite',{method:'POST',headers:{Host:'127.0.0.1:8787',Origin:origin,Cookie:cookie}})
 await auth.invite(request,{email:'invitee@example.test',displayName:'Invitee'})
 const first=(await localOutbox(rt)!.list())[0]
 expect(first.message.subject).toBe("You're invited to Penny");expect(first.message.text).toContain('Penny');expect(first.message.html).toContain('Penny')
 const person=await env.DB.prepare('SELECT id FROM oa_operators WHERE email=?').bind('invitee@example.test').first<{id:string}>()
 await auth.cancelInvitation(request,person!.id)
 await auth.invite(request,{email:'invitee@example.test',displayName:'Invitee'})
 expect((await localOutbox(rt)!.list())).toHaveLength(2)
 expect((await env.DB.prepare('SELECT id,status FROM oa_operators WHERE email=?').bind('invitee@example.test').first())).toEqual({id:person!.id,status:'invited'})
})
it('[BASE-ACCESS-001 REQ-023] deployed no-provider forms remain readable and never expose development capture',async()=>{
 const deployed={...bindings(),PENNY_ENVIRONMENT:'production',APP_ORIGIN:'https://penny.test',MAIL_PROVIDER:undefined,MAIL_FROM:undefined}
 const rt=createPennyRuntime(deployed)
 expect(authMail(rt)).toBeUndefined();expect(localOutbox(rt)).toBeUndefined()
 expect(localOutbox({...rt,configuration:{...rt.configuration,mailProvider:'development'}})).toBeUndefined()
 for(const path of ['/__dev/outbox','/__dev/outbox?message=anything']) {
  const response=await app.fetch(new Request('https://penny.test'+path,{headers:{Host:'penny.test'}}),deployed)
  expect(response.status).toBe(404)
 }
 const response=await app.fetch(new Request('https://penny.test/api/auth/capabilities'),deployed)
 expect(response.status).toBe(200);expect(await response.json()).toMatchObject({transport:'unavailable'})
})
