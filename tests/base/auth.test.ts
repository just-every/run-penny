import {proveRequesterOAuth} from './requester-oauth-fixture'
import { applyD1Migrations,reset } from 'cloudflare:test'
import {  beforeEach, afterEach, vi, expect, inject, it } from 'vitest'
import { toJSONAsync } from 'seroval'
import { createPennyApi } from '../../src/core/app/api'
import { createDatabaseConnection } from '../../src/core/platform/database'
import { importPennySample } from '../../src/core/features/sample-data/service'
import sample from '../../sample-data/penny.v1.json'
import { call,env,owner,mockMail,messages,origin } from './support'
import { observeD1 } from './review-race-storage'
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
it('[BASE-ACCESS-001/002] expired links and expired sessions deny access; membership survives configuration changes',async()=>{
 const cookie=await owner();await call('/api/auth/magic-link',{email:'owner@penny.invalid'})
 const token=new URL(messages[0].url).searchParams.get('token')!
 await env.DB.prepare('UPDATE oa_tokens SET expires_at=1').run();expect((await call('/auth/confirm',{token})).status).toBe(400)
 const app=createPennyApi({runtimeConfiguration:{operatorAllowlist:['other@example.test'],workspaceTimezone:'UTC',publicOriginAllowlist:[origin]}});const response=await app.fetch(new Request(origin+'/api/auth/session',{headers:cookie}),{...env,OPERATOR_EMAIL:'other@example.test'})
 expect(response.status).toBe(200)
 await env.DB.prepare('UPDATE oa_sessions SET expires_at=1').run();expect((await call('/api/auth/session',undefined,cookie)).status).toBe(401)
})
it('[REQ-039 BASE-ACCESS-001 REQ-023] requester OAuth verifies at the provider edge without cookies or operator authority; missing mail fails closed',async()=>{
 const app=createPennyApi();for(const path of ['/api/auth/magic-link','/api/public/identity/email']){
  const response=await app.fetch(new Request(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(path.includes('public')?{email:'test@example.test',displayName:'Test'}:{email:'owner@penny.invalid'})}),{...env,MAIL_API_KEY:undefined,PENNY_AUTH_TRANSPORT:'local-outbox'})
  expect(response.status).toBe(503)
 }
 expect(messages).toHaveLength(0)
 await proveRequesterOAuth()
})

it('[BASE-ACCESS-001 REQ-023] rejected provider sends invalidate both operator and requester verification links',async()=>{
 await owner();vi.mocked(fetch).mockResolvedValue(new Response(null,{status:503}))
 expect((await call('/api/auth/magic-link',{email:'owner@penny.invalid'})).status).toBe(503)
 expect(await env.DB.prepare('SELECT revoked_at FROM oa_tokens').first()).toMatchObject({revoked_at:expect.any(Number)})
 expect((await call('/api/public/identity/email',{email:'recipient@example.test',displayName:'Recipient'})).status).toBe(503)
 expect(await env.DB.prepare('SELECT id FROM native_magic_links').first()).toBeNull()
})

it('[OPS-001 BASE-ACCESS-001] configuring a bootstrap owner preserves existing explicitly allowlisted operators',async()=>{
 const cookie=await owner()
 const app=createPennyApi({runtimeConfiguration:{operatorAllowlist:['owner@penny.invalid'],workspaceTimezone:'UTC',publicOriginAllowlist:[origin]}})
 const response=await app.fetch(new Request(origin+'/api/auth/session',{headers:cookie}),{...env,OPERATOR_EMAIL:'new-owner@example.test'})
 expect(response.status).toBe(200)
})

const management='/api/operator/settings/operators'
async function invited(cookie:Record<string,string>,email:string){
 const response=await call(management,{email},cookie);expect(response.status,await response.clone().text()).toBe(202)
 const message=messages.findLast(m=>m.to===email)!;expect(message).toBeDefined()
 const url=new URL(message.url),token=url.searchParams.get('token')!
 expect((await call(url.pathname+url.search)).status).toBe(200)
 expect((await call(url.pathname+url.search)).status).toBe(200)
 expect((await call('/auth/confirm',{token},{Origin:'https://evil.test'})).status).toBe(403)
 const confirmation=await call('/auth/confirm',{token});expect(confirmation.status).toBe(303)
 const operator={Cookie:confirmation.headers.get('Set-Cookie')!.split(';')[0]}
 const listing=await call(management,undefined,operator);expect(listing.status).toBe(200)
 const operators=(await listing.json() as {operators:{id:string;email:string}[]}).operators
 return {cookie:operator,id:operators.find(o=>o.email===email)!.id,token,operators}
}
it('[OPS-001/002] equal native invitees operate and manage peers; removal revokes cookies, links, generated functions and keys with durable audit',async()=>{
 const first=await owner(),peer=await invited(first,'peer@example.test')
 expect((await call('/api/operator/moderation',undefined,peer.cookie)).status).toBe(200)
 expect((await call('/api/operator/catalog/tags',{name:'Peer managed tag'},peer.cookie)).status).toBe(201)
 const page=await call('/app/overview',undefined,{...peer.cookie,Accept:'text/html'});expect(page.status).toBe(200)
 const privateName='Revocation private account marker',privateHealth='Revocation private health marker'
 const actor=await env.DB.prepare('SELECT id FROM operators WHERE email=?').bind('peer@example.test').first<string>('id')
 const created=await call('/api/operator/accounts',{name:privateName,health:privateHealth,internalOwnerId:actor},peer.cookie)
 expect(created.status).toBe(201);const account=await created.json() as {slug:string}
 const wire=inject('generatedTransport') as Record<string,string>
 const generated=new URL(wire.loadOperatorResources,origin)
 generated.searchParams.set('payload',JSON.stringify(await toJSONAsync({data:`/app/customers/${account.slug}`})))
 const generatedPath=generated.pathname+generated.search,generatedHeaders={...peer.cookie,'x-tsr-serverFn':'true',Accept:'application/json','Sec-Fetch-Site':'same-origin'}
 const admitted=await call(generatedPath,undefined,generatedHeaders);expect(admitted.status).toBe(200)
 const admittedBody=await admitted.text();expect(admittedBody).toContain(privateName);expect(admittedBody).toContain(privateHealth)
 const initial=peer.operators.find(o=>o.email==='owner@penny.invalid')!
 expect((await call(`${management}/${initial.id}`,{},peer.cookie,'DELETE')).status).toBe(403)
 const longEmail=`${'invitee'.repeat(8)}@${'team'.repeat(12)}.${'workspace'.repeat(5)}.example.test`
 const third=await invited(peer.cookie,longEmail)
 expect((await call(`${management}/${third.id}`,{},peer.cookie,'DELETE')).status).toBe(200)
 expect((await call(management,undefined,third.cookie)).status).toBe(401)
 const issued=await call('/api/operator/integrations/keys',{name:'Peer key',scopes:['requests:read']},peer.cookie)
 expect(issued.status).toBe(201);const key=await issued.json() as {token:string}
 expect((await call('/api/v1/requests',undefined,{Authorization:`Bearer ${key.token}`})).status).toBe(200)
 await call('/api/auth/magic-link',{email:'peer@example.test'})
 const staleToken=new URL(messages.findLast(m=>m.to==='peer@example.test')!.url).searchParams.get('token')!
 expect((await call(management,{email:'pending@example.test'},peer.cookie)).status).toBe(202)
 const pendingToken=new URL(messages.findLast(m=>m.to==='pending@example.test')!.url).searchParams.get('token')!
 expect((await call(`${management}/${peer.id}`,{}, {...first,Origin:'https://evil.test'},'DELETE')).status).toBe(403)
 expect((await call(`${management}/${peer.id}`,{},first,'DELETE')).status).toBe(200)
 expect((await call(management,undefined,peer.cookie)).status).toBe(401)
 expect((await call('/api/operator/moderation',undefined,peer.cookie)).status).toBe(401)
 expect((await call('/app/overview',undefined,{...peer.cookie,Accept:'text/html'})).status).not.toBe(200)
 const rpc=await call(generatedPath,undefined,generatedHeaders)
 // TanStack serializes server-function redirects inside an HTTP 200 response.
 expect(rpc.status).toBe(200)
 const denied=await rpc.json();expect(denied).toMatchObject({isSerializedRedirect:true,to:'/signin'})
 expect(denied).not.toHaveProperty('resources');expect(denied).not.toHaveProperty('result')
 const deniedBody=JSON.stringify(denied);expect(deniedBody).not.toContain(privateName);expect(deniedBody).not.toContain(privateHealth);expect(deniedBody).not.toContain('/api/operator/')
 expect((await call('/api/v1/requests',undefined,{Authorization:`Bearer ${key.token}`})).status).toBe(401)
 for(const token of [staleToken,pendingToken,peer.token])expect((await call('/auth/confirm',{token})).status).toBe(400)
 const before=messages.length;expect((await call('/api/auth/magic-link',{email:'peer@example.test'})).status).toBe(202);expect(messages.length).toBe(before)
 const audit=(await env.DB.prepare('SELECT actor_id,action,entity_id,details_json FROM audit_entries WHERE entity_type=?').bind('operator').all()).results
 expect(audit).toEqual(expect.arrayContaining([expect.objectContaining({actor_id:initial.id,action:'operator.removed',entity_id:peer.id}),expect.objectContaining({actor_id:initial.id,action:'operator.invitation_issued',entity_id:peer.id}),expect.objectContaining({action:'operator.invitation_delivery',entity_id:peer.id})]))
 const serialized=JSON.stringify(audit);expect(serialized).not.toContain(staleToken);expect(serialized).not.toContain(key.token);expect(serialized).not.toContain('peer@example.test')
 // A new explicit invitation may restore a peer, but their old links/cookies do not return.
 const restored=await invited(first,'peer@example.test');expect(restored.id).toBe(peer.id)
 expect((await call(management,undefined,peer.cookie)).status).toBe(401)
})
it('[OPS-002] initial owner self-removal requires a verified successor and survives configuration/bootstrap admission',async()=>{
 const first=await owner(),initial=(await (await call(management,undefined,first)).json() as {operators:{id:string}[]}).operators[0]
 expect((await call(`${management}/${initial.id}`,{},first,'DELETE')).status).toBe(409)
 expect((await call(management,{email:'pending-owner@example.test'},first)).status).toBe(202)
 expect((await call(`${management}/${initial.id}`,{},first,'DELETE')).status).toBe(409)
 const peer=await invited(first,'successor@example.test')
 const issued=await call('/api/operator/integrations/keys',{name:'Successor key',scopes:['requests:read']},peer.cookie)
 expect(issued.status).toBe(201);const key=await issued.json() as {token:string}
 await call('/api/auth/magic-link',{email:'owner@penny.invalid'})
 const held=new URL(messages.findLast(m=>m.to==='owner@penny.invalid')!.url).searchParams.get('token')!
 expect((await call(`${management}/${initial.id}`,{successorId:peer.id},first,'DELETE')).status).toBe(200)
 expect((await call(management,undefined,first)).status).toBe(401)
 expect((await call('/auth/confirm',{token:held})).status).toBe(400)
 expect((await call('/auth/bootstrap',{token:'synthetic-base-setup-token-for-worker-tests',displayName:'Reclaim'})).status).toBe(409)
 const count=messages.length;await call('/api/auth/magic-link',{email:'owner@penny.invalid'});expect(messages.length).toBe(count)
 await call('/api/auth/magic-link',{email:'successor@example.test'})
 const token=new URL(messages.findLast(m=>m.to==='successor@example.test')!.url).searchParams.get('token')!
 const response=await call('/auth/confirm',{token});expect(response.status).toBe(303)
 const successor={Cookie:response.headers.get('Set-Cookie')!.split(';')[0]}
 expect((await call(management,undefined,successor)).status).toBe(200)
 expect((await call('/api/operator/settings/branding',undefined,successor)).status).toBe(200)
 expect((await call(`${management}/${initial.id}`,{},successor,'DELETE')).status).toBe(403)
 expect((await call(management,undefined,peer.cookie)).status).toBe(401)
 // Taking over ownership keeps the successor's own keys working.
 expect((await call('/api/v1/requests',undefined,{Authorization:`Bearer ${key.token}`})).status).toBe(200)
 // The former owner can be invited back as an equal operator.
 expect((await invited(successor,'owner@penny.invalid')).id).toBe(initial.id)
})
it('[OPS-002] ownership moves only by the owner handing over to a successor they name',async()=>{
 const first=await owner(),earlier=await invited(first,'earlier@example.test'),named=await invited(first,'named@example.test')
 const initial=named.operators.find(o=>o.email==='owner@penny.invalid')!
 expect((await call(`${management}/${initial.id}`,{successorId:earlier.id},earlier.cookie,'DELETE')).status).toBe(403)
 expect((await call(`${management}/${initial.id}`,{successorId:named.id},first,'DELETE')).status).toBe(200)
 const role=(id:string)=>env.DB.prepare('SELECT role FROM oa_operators WHERE id=?').bind(id).first<string>('role')
 expect(await role(named.id)).toBe('owner');expect(await role(earlier.id)).toBe('member')
 await call('/api/auth/magic-link',{email:'earlier@example.test'})
 const member={Cookie:(await call('/auth/confirm',{token:new URL(messages.findLast(m=>m.to==='earlier@example.test')!.url).searchParams.get('token')!})).headers.get('Set-Cookie')!.split(';')[0]}
 // A member can neither depose the current owner nor name themselves as successor.
 expect((await call(`${management}/${named.id}`,{},member,'DELETE')).status).toBe(403)
 expect((await call(`${management}/${named.id}`,{successorId:earlier.id},member,'DELETE')).status).toBe(403)
 expect(await role(named.id)).toBe('owner');expect(await role(earlier.id)).toBe('member')
 expect((await call(management,undefined,member)).status).toBe(200)
})
it('[OPS-002 BASE-OPS-005] management refuses maintenance and audit failure without leaving membership changes',async()=>{
 const first=await owner(),peer=await invited(first,'retained@example.test')
 await env.DB.prepare("UPDATE data_state SET phase='locked' WHERE singleton=1").run()
 expect((await call(management,{email:'maintenance@example.test'},first)).status).toBe(409)
 expect((await call(`${management}/${peer.id}`,{},first,'DELETE')).status).toBe(409)
 await env.DB.prepare("UPDATE data_state SET phase='idle' WHERE singleton=1").run()
 await env.DB.exec("CREATE TRIGGER test_operator_audit_failure BEFORE INSERT ON audit_entries WHEN NEW.entity_type='operator' BEGIN SELECT RAISE(ABORT,'test_audit_failure'); END")
 expect((await call(`${management}/${peer.id}`,{},first,'DELETE')).status).toBe(503)
 expect((await call(management,undefined,peer.cookie)).status).toBe(200)
 const count=messages.length
 expect((await call(management,{email:'no-audit@example.test'},first)).status).toBe(503)
 expect(messages.length).toBe(count)
 expect(await env.DB.prepare('SELECT id FROM oa_operators WHERE email=?').bind('no-audit@example.test').first()).toBeNull()
})

it('[OPS-002 BASE-ACCESS-004] an actor revoked after admission cannot commit an invitation',async()=>{
 const first=await owner();let raced=false
 const db=observeD1(env.DB,{before:async sql=>{
  if(!raced&&sql.some(statement=>statement.includes('INSERT INTO oa_operators'))){raced=true;await env.DB.prepare('UPDATE oa_sessions SET revoked_at=1').run()}
 }})
 const app=createPennyApi()
 const response=await app.fetch(new Request(origin+management,{method:'POST',headers:{...first,Origin:origin,'CF-Connecting-IP':'192.0.2.240','Content-Type':'application/json'},body:JSON.stringify({email:'raced@example.test'})}),{...env,DB:db})
 expect(raced).toBe(true);expect(response.status).toBe(401);expect(messages).toHaveLength(0)
 expect(await env.DB.prepare('SELECT id FROM oa_operators WHERE email=?').bind('raced@example.test').first()).toBeNull()
})
