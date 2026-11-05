import { applyD1Migrations, reset } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { beforeEach, afterEach, expect, inject, it, vi } from 'vitest'
import { createPennyApi } from '@/core/app/api'
import { base64urlEncode, sign } from '@/core/features/auth/tokens'
import { opaqueToken } from '@/core/features/auth/native-tokens'
import { owner } from './support'
import type { PublicRequestCard, PublicRequestDetail } from '@/core/shared/api/public'
const app=createPennyApi(), origin='https://penny.test'
const full=()=>({...env,PENNY_ENVIRONMENT:'production',PORTAL_IDENTITY_SECRET:'synthetic-host-identity-secret'})
const noMail=()=>({...full(),MAIL_PROVIDER:undefined,MAIL_FROM:undefined,MAIL_API_KEY:undefined})
function call(path:string,body:unknown,headers:Record<string,string>={},bindings=full()) {
 return app.fetch(new Request(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.29',...headers},body:JSON.stringify(body)}),bindings)
}
function payload(title:string,emailUpdates=false){return {title,description:'An independently verified customer problem',boardSlug:'feedback',emailUpdates,idempotencyKey:crypto.randomUUID()}}
const hostClaims={displayName:'Synthetic Penny requester',email:['synthetic-penny-1','example.test'].join('@'),accountId:'synthetic-penny-private-account-1',accountName:'Synthetic Penny private account',revenueCents:92345678}
async function host(email=hostClaims.email,issuedAt=new Date().toISOString(),secret=full().PORTAL_IDENTITY_SECRET){
 const encoded=base64urlEncode(new TextEncoder().encode(JSON.stringify({...hostClaims,aud:origin,issuedAt,email})))
 return {'X-Penny-Identity':encoded,'X-Penny-Identity-Signature':base64urlEncode(await sign(secret,encoded))}
}
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'));const stamp=new Date().toISOString();await env.DB.prepare("INSERT INTO boards(id,slug,name,visibility,position,created_at,updated_at) VALUES('board','feedback','Feedback','public',0,?,?)").bind(stamp,stamp).run()})
afterEach(()=>vi.restoreAllMocks())
it('[G.3 REQ-002 REQ-003 REQ-031 DATA-002] host identities publish chosen names without private address or account data, with and without outbound mail',async()=>{
 const headers=await host(),operator=await owner(),submitted:{slug:string;title:string}[]=[]
 for(const [bindings,title] of [[full(),'Provider configured control'],[noMail(),'Same identity without mail']] as const){
  const response=await call('/api/public/requests',payload(title),headers,bindings)
  expect(response.status).toBe(201)
  const {slug}=await response.json() as {slug:string}
  submitted.push({slug,title})
  expect((await app.fetch(new Request(origin+`/api/public/requests/${slug}`),bindings)).status).toBe(404)
  expect((await call(`/api/operator/moderation/${slug}`,{verdict:'approved',title,description:'Approved customer problem',boardSlug:'feedback',displayName:hostClaims.displayName},operator,bindings)).status).toBe(200)
 }
 const privateIdentity=await env.DB.prepare(`SELECT a.id AS addressId,a.requester_id AS requesterId,a.email,h.host_account_id AS hostAccountId,h.account_id AS accountId,c.slug AS accountSlug,c.name AS accountName,c.revenue_cents AS revenueCents
  FROM requester_addresses a JOIN requester_account_links l ON l.requester_id=a.requester_id JOIN accounts c ON c.id=l.account_id JOIN host_identity_accounts h ON h.account_id=c.id`).first<Record<string,string|number>>()
 expect(privateIdentity).toMatchObject({email:hostClaims.email,hostAccountId:hostClaims.accountId,accountName:hostClaims.accountName,revenueCents:hostClaims.revenueCents})
 for(const bindings of [full(),noMail()]){
  const published=await app.fetch(new Request(origin+'/api/public/requests'),bindings)
  expect(published.status).toBe(200)
  const list=await published.json() as PublicRequestCard[]
  expect(list).toHaveLength(2)
  expect(list.map(({slug,title})=>({slug,title}))).toEqual(expect.arrayContaining(submitted))
  const payloads:unknown[]=[list]
  for(const {slug,title} of submitted){
   const response=await app.fetch(new Request(origin+`/api/public/requests/${slug}`),bindings)
   expect(response.status).toBe(200)
   const detail=await response.json() as PublicRequestDetail
   expect(detail).toMatchObject({slug,title,authorDisplayName:hostClaims.displayName})
   payloads.push(detail)
  }
  for(const publicPayload of payloads){
   const text=JSON.stringify(publicPayload)
   for(const field of ['email','emailAddress','verifiedEmail','requesterId','requester_id','addressId','address_id','requester_address_id','account','accountId','account_id','hostAccountId','host_account_id','accountName','account_name','revenueCents','revenue_cents'])expect(text).not.toContain(`"${field}"`)
   for(const value of Object.values(privateIdentity!))expect(text).not.toContain(String(value))
  }
 }
 for(const invalid of [await host(hostClaims.email,new Date().toISOString(),'different-authority'),await host(hostClaims.email,new Date(Date.now()-25*3600000).toISOString())])expect((await call('/api/public/requests',payload('Invalid existing identity'),invalid,noMail())).status).toBe(503)
 expect((await call('/api/public/requests',payload('New host identity without mail'),await host('new-host@example.test'),noMail())).status).toBe(503)
 expect(await env.DB.prepare('SELECT count(*) n FROM requests').first('n')).toBe(2)
 expect(await env.DB.prepare('SELECT count(*) n FROM evidence_items').first('n')).toBe(2)
 expect(await env.DB.prepare('SELECT count(*) n FROM requester_addresses').first('n')).toBe(1)
 expect(await env.DB.prepare('SELECT count(*) n FROM requester_update_permissions').first('n')).toBe(0)
})
it('[G.3 REQ-023 REQ-003] delivered verification consumes once and replays its held submission after outbound mail is removed',async()=>{
 let delivered=''
 const provider=vi.spyOn(globalThis,'fetch').mockImplementation(async(url,options)=>{expect(String(url)).toBe('https://api.sendgrid.com/v3/mail/send');const message=JSON.parse(String(options?.body));delivered=message.content.find((part:{type:string})=>part.type==='text/plain').value;return new Response(null,{status:202})})
 const pending=opaqueToken(),input=payload('Held before provider removal')
 expect((await call('/api/public/requests',input,{'X-Penny-Pending-Token':pending})).status).toBe(202)
 expect((await call('/api/public/identity/email',{email:'pending@example.test',displayName:'Pending customer',pendingToken:pending})).status).toBe(202)
 const token=new URLSearchParams(new URL(delivered.match(/https:\/\/[^\s]+/)![0]).hash.slice(1)).get('token')
 const verified=await call('/api/public/identity/email/verify',{token},{},noMail())
 expect(verified.status).toBe(200)
 const session=await verified.json() as {token:string}
 expect((await call('/api/public/requests',input,{Authorization:`Bearer ${session.token}`},noMail())).status).toBe(201)
 expect((await call('/api/public/identity/email/verify',{token},{},noMail())).status).toBe(401)
 expect(await env.DB.prepare('SELECT count(*) n FROM requests').first('n')).toBe(1)
 expect(await env.DB.prepare('SELECT count(*) n FROM evidence_items').first('n')).toBe(1)
 expect(await env.DB.prepare('SELECT count(*) n FROM requester_pending_actions').first('n')).toBe(0)
 expect(await env.DB.prepare('SELECT count(*) n FROM requester_update_permissions').first('n')).toBe(0)
 expect(provider).toHaveBeenCalledTimes(1)
})
it('[G.3 REQ-014 REQ-023 BASE-ACCESS-003] no mail admits neither invalid trust, first-time provisioning nor an unverified hold',async()=>{
 const valid=await host()
 const cases:Record<string,string>[]=[{}, {'X-Penny-Pending-Token':opaqueToken()},await host('forged@example.test',new Date().toISOString(),'different-authority'),await host('old@example.test',new Date(Date.now()-25*3600000).toISOString()),{'X-Penny-Identity':valid['X-Penny-Identity']},{...valid,Origin:''}]
 for(const headers of cases)expect((await call('/api/public/requests',payload('Rejected'),headers,noMail())).status).toBe(503)
 const withoutOrigin=new Request(origin+'/api/public/requests',{method:'POST',headers:{'Content-Type':'application/json',...valid},body:JSON.stringify(payload('No origin first-time host'))})
 expect((await app.fetch(withoutOrigin,noMail())).status).toBe(503)
 expect((await call('/api/public/requests',payload('Foreign'),{...valid,Origin:'https://foreign.invalid'},noMail())).status).toBe(403)
 expect((await call('/api/public/requests',payload('Fake native'),{Authorization:`Bearer ${opaqueToken()}`},noMail())).status).toBe(401)
 expect((await call('/api/public/identity/email',{email:'new@example.test',displayName:'New'},{},noMail())).status).toBe(503)
 expect((await call('/api/public/identity/email/verify',{token:opaqueToken()},{},noMail())).status).toBe(401)
 for(const table of ['requests','evidence_items','requesters','requester_pending_actions','native_magic_links'])expect(await env.DB.prepare(`SELECT count(*) n FROM ${table}`).first('n')).toBe(0)
})
it('[G.3 REQ-010 REL-011 BASE-ACCESS-003] signed no-mail writes keep blocking, suppression, consent and rate limits',async()=>{
 const headers=await host()
 expect((await call('/api/public/requests',payload('First'),headers)).status).toBe(201)
 const stamp=new Date().toISOString()
 await env.DB.prepare('UPDATE requester_addresses SET suppressed_at=?').bind(stamp).run()
 expect((await call('/api/public/requests',payload('Suppressed access',true),headers,noMail())).status).toBe(201)
 expect(await env.DB.prepare('SELECT suppressed_at FROM requester_addresses').first('suppressed_at')).toBe(stamp)
 expect(await env.DB.prepare('SELECT count(*) n FROM requester_update_permissions').first('n')).toBe(1)
 expect(await env.DB.prepare('SELECT suppressed_at FROM requester_update_permissions').first('suppressed_at')).toBe(stamp)
 for(let i=2;i<10;i++)expect((await call('/api/public/requests',payload(`Within limit ${i}`),{...headers,'CF-Connecting-IP':`192.0.2.${i}`},noMail())).status).toBe(201)
 expect((await call('/api/public/requests',payload('Rate limited'),headers,noMail())).status).toBe(429)
 await env.DB.prepare('UPDATE requesters SET blocked_at=?').bind(stamp).run()
 expect((await call('/api/public/requests',payload('Blocked'),headers,noMail())).status).toBe(403)
 expect(await env.DB.prepare('SELECT count(*) n FROM requests').first('n')).toBe(10)
})
