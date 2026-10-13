import { applyD1Migrations,reset } from 'cloudflare:test'
import {  beforeEach, afterEach, vi, expect, inject, it } from 'vitest'
import { createPennyApi } from '../../src/core/app/api'
import { createDatabaseConnection } from '../../src/core/platform/database'
import { importPennySample } from '../../src/core/features/sample-data/service'
import sample from '../../sample-data/penny.v1.json'
import { call,env,owner,mockMail,messages,origin } from './support'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'));mockMail()})
afterEach(()=>vi.restoreAllMocks())
it('[BASE-ACCESS-001/002/004] Base bootstrap, real cookie, private API and generated Start authorization, sign-out',async()=>{
 await importPennySample(createDatabaseConnection(env.DB),sample)
 expect((await call('/app',undefined,{Accept:'text/html'})).status).not.toBe(200)
 const cookie=await owner();expect(cookie.Cookie).toMatch(/^__Host-operator_session=[A-Za-z0-9_-]{43}$/)
 expect((await call('/api/operator/moderation',undefined,cookie)).status).toBe(200)
 const page=await call('/app/overview',undefined,{...cookie,Accept:'text/html'});expect(page.status).toBe(200);expect(await page.text()).toContain('Overview')
 const wire=inject('generatedTransport') as Record<string,string>
 const headers={...cookie,'x-tsr-serverFn':'true',Accept:'application/json','Sec-Fetch-Site':'same-origin'}
 const rpc=await call(wire.loadOperatorResources,undefined,headers);expect(rpc.status).toBe(200);expect(await rpc.text()).toContain('Northstar Health')
 expect((await call('/api/auth/sign-out',{}, {...cookie,Origin:'https://evil.test'})).status).toBe(403)
 expect((await call('/api/auth/sign-out',{},cookie)).status).toBe(204)
 expect((await call('/api/operator/moderation',undefined,cookie)).status).toBe(401)
 const denied=await call(wire.loadOperatorResources,undefined,headers);expect(await denied.text()).not.toContain('Northstar Health')
 expect((await call('/api/operator/moderation',undefined,{Cookie:'penny_operator_session=legacy'})).status).toBe(401)
})
it('[BASE-ACCESS-001/003] SendGrid mail uses Base, admission does not enumerate, GET preview cannot consume, confirmation races once',async()=>{
 await owner()
 for(const email of ['unknown@example.test','owner@penny.invalid']){const r=await call('/api/auth/magic-link',{email,returnTo:'/app'});expect(r.status).toBe(202);expect(await r.json()).toEqual({status:'accepted'})}
 expect(messages).toHaveLength(1);const url=new URL(messages[0].url),token=url.searchParams.get('token')!
 expect(url.pathname).toBe('/auth/confirm');expect((await call(url.pathname+url.search)).status).toBe(200)
 expect(await env.DB.prepare('SELECT consumed_at FROM oa_tokens').first()).toEqual({consumed_at:null})
 expect((await call('/auth/confirm',{token},{Origin:'https://evil.test'})).status).toBe(403)
 const results=await Promise.all(Array.from({length:4},()=>call('/auth/confirm',{token})))
 expect(results.map(r=>r.status).sort()).toEqual([303,400,400,400]);expect((await call('/auth/confirm',{token})).status).toBe(400)
 expect((await call('/api/auth/magic-link/consume?token='+token)).status).toBe(404)
})
it('[BASE-ACCESS-001/002] expired links, expired sessions and withdrawn allowlist deny access',async()=>{
 const cookie=await owner();await call('/api/auth/magic-link',{email:'owner@penny.invalid'})
 const token=new URL(messages[0].url).searchParams.get('token')!
 await env.DB.prepare('UPDATE oa_tokens SET expires_at=1').run();expect((await call('/auth/confirm',{token})).status).toBe(400)
 const app=createPennyApi({runtimeConfiguration:{operatorAllowlist:['other@example.test'],workspaceTimezone:'UTC',publicOriginAllowlist:[origin]}});const response=await app.fetch(new Request(origin+'/api/auth/session',{headers:cookie}),{...env,OPERATOR_EMAIL:'other@example.test'})
 expect(response.status).toBe(401)
 await env.DB.prepare('UPDATE oa_sessions SET expires_at=1').run();expect((await call('/api/auth/session',undefined,cookie)).status).toBe(401)
})
it('[BASE-ACCESS-001 REQ-023] missing mail config fails closed for both identity paths, no local production transport',async()=>{
 const app=createPennyApi();for(const path of ['/api/auth/magic-link','/api/public/identity/email']){
  const response=await app.fetch(new Request(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(path.includes('public')?{email:'test@example.test',displayName:'Test'}:{email:'owner@penny.invalid'})}),{...env,SENDGRID_API_KEY:undefined,PENNY_AUTH_TRANSPORT:'local-outbox'})
  expect(response.status).toBe(503)
 }
 expect(messages).toHaveLength(0)
})

it('[BASE-ACCESS-001 REQ-023] rejected provider sends invalidate both operator and requester verification links',async()=>{
 await owner();vi.mocked(fetch).mockResolvedValue(new Response(null,{status:503}))
 expect((await call('/api/auth/magic-link',{email:'owner@penny.invalid'})).status).toBe(503)
 expect(await env.DB.prepare('SELECT revoked_at FROM oa_tokens').first()).toMatchObject({revoked_at:expect.any(Number)})
 expect((await call('/api/public/identity/email',{email:'recipient@example.test',displayName:'Recipient'})).status).toBe(503)
 expect(await env.DB.prepare('SELECT consumed_at FROM native_magic_links').first()).toMatchObject({consumed_at:expect.any(String)})
})

it('[OPS-001 BASE-ACCESS-001] configuring a bootstrap owner preserves existing explicitly allowlisted operators',async()=>{
 const cookie=await owner()
 const app=createPennyApi({runtimeConfiguration:{operatorAllowlist:['owner@penny.invalid'],workspaceTimezone:'UTC',publicOriginAllowlist:[origin]}})
 const response=await app.fetch(new Request(origin+'/api/auth/session',{headers:cookie}),{...env,OPERATOR_EMAIL:'new-owner@example.test'})
 expect(response.status).toBe(200)
})
