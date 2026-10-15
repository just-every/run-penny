import { applyD1Migrations, reset } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { beforeEach, afterEach, expect, inject, it, vi } from 'vitest'
import { createPennyApi } from '@/core/app/api'
import { base64urlEncode, sign } from '@/core/features/auth/tokens'
import { opaqueToken } from '@/core/features/auth/native-tokens'
const app=createPennyApi(), origin='https://penny.test'
const full=()=>({...env,PENNY_ENVIRONMENT:'production',PORTAL_IDENTITY_SECRET:'synthetic-host-identity-secret'})
const noMail=()=>({...full(),MAIL_PROVIDER:undefined,MAIL_FROM:undefined,MAIL_API_KEY:undefined})
function call(path:string,body:unknown,headers:Record<string,string>={},bindings=full()) {
 return app.fetch(new Request(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.29',...headers},body:JSON.stringify(body)}),bindings)
}
function payload(title:string,emailUpdates=false){return {title,description:'An independently verified customer problem',boardSlug:'feedback',emailUpdates,idempotencyKey:crypto.randomUUID()}}
async function host(email='host-verified@example.test',issuedAt=new Date().toISOString(),secret=full().PORTAL_IDENTITY_SECRET){
 const encoded=base64urlEncode(new TextEncoder().encode(JSON.stringify({aud:origin,issuedAt,displayName:'Host verified',email,accountId:'private-account',accountName:'Private host account',revenueCents:123456})))
 return {'X-Penny-Identity':encoded,'X-Penny-Identity-Signature':base64urlEncode(await sign(secret,encoded))}
}
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'));const stamp=new Date().toISOString();await env.DB.prepare("INSERT INTO boards(id,slug,name,visibility,position,created_at,updated_at) VALUES('board','feedback','Feedback','public',0,?,?)").bind(stamp,stamp).run()})
afterEach(()=>vi.restoreAllMocks())
it('[G.3 REQ-002 REQ-003 REQ-031 DATA-002] valid host identities may submit without outbound mail and retain private commercial claims',async()=>{
 const headers=await host()
 expect((await call('/api/public/requests',payload('Provider configured control'),headers)).status).toBe(201)
 expect((await call('/api/public/requests',payload('Same identity without mail'),headers,noMail())).status).toBe(201)
 for(const invalid of [await host('host-verified@example.test',new Date().toISOString(),'different-authority'),await host('host-verified@example.test',new Date(Date.now()-25*3600000).toISOString())])expect((await call('/api/public/requests',payload('Invalid existing identity'),invalid,noMail())).status).toBe(503)
 expect((await call('/api/public/requests',payload('New host identity without mail'),await host('new-host@example.test'),noMail())).status).toBe(503)
 expect(await env.DB.prepare('SELECT count(*) n FROM requests').first('n')).toBe(2)
 expect(await env.DB.prepare('SELECT count(*) n FROM evidence_items').first('n')).toBe(2)
 expect(await env.DB.prepare('SELECT count(*) n FROM requester_addresses').first('n')).toBe(1)
 expect(await env.DB.prepare('SELECT count(*) n FROM requester_update_permissions').first('n')).toBe(0)
 const published=await app.fetch(new Request(origin+'/api/public/requests'),noMail())
 const text=await published.text();for(const privateValue of ['host-verified@example.test','private-account','Private host account','revenueCents','123456'])expect(text).not.toContain(privateValue)
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
