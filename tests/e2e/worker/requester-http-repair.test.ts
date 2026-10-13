import { it,expect } from 'vitest'
import { repairDatabase,boardGraph,fixture,person,submit,change,env,call,auth,app,bindings,opaqueToken,createUlid } from './requester-repair-fixture'
import { base64urlEncode,sign } from '../../../src/core/features/auth/tokens'
repairDatabase()

async function hostHeaders(email='host-repair@example.test') {
 const encoded=base64urlEncode(new TextEncoder().encode(JSON.stringify({aud:'http://penny.test',issuedAt:new Date().toISOString(),displayName:'Host',email})))
 return {'X-Penny-Identity':encoded,'X-Penny-Identity-Signature':base64urlEncode(await sign(bindings.PORTAL_IDENTITY_SECRET,encoded))}
}
it('[F03 REQ-003] unavailable transport refuses submissions before host provisioning or anonymous holding',async()=>{
 const f=await fixture(),payload={title:'Held',description:'A truthful boundary',boardSlug:f.board,idempotencyKey:crypto.randomUUID()}
 const unavailable={...bindings,PENNY_AUTH_TRANSPORT:undefined}
 const caps=await app.fetch(new Request('http://penny.test/api/auth/capabilities'),unavailable)
 expect(await caps.json()).toEqual({transport:'unavailable'})
 for(const headers of [await hostHeaders(),{'X-Penny-Pending-Token':opaqueToken()}]){
  const response=await app.fetch(new Request('http://penny.test/api/public/requests',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(payload)}),unavailable)
  expect(response.status).toBe(503);expect(await response.json()).toEqual({error:'mail_unavailable'})
 }
 for(const table of ['requests','evidence_items','requesters','requester_pending_actions'])expect((await env.DB.prepare(`SELECT * FROM ${table}`).all()).results).toHaveLength(0)
 expect((await call('/api/public/requests',payload,await hostHeaders())).status).toBe(201)
})

it('[F04 EVID-009] native evidence tag transport enforces operator authority, validation and public privacy',async()=>{
 const f=await boardGraph(1),[r]=f.requests
 const evidence=await env.DB.prepare('SELECT id FROM evidence_items').first<{id:string}>()
 const tag=await (await call('/api/operator/catalog/tags',{name:'Internal priority marker'},f.headers)).json() as {id:string}
 const path=`/api/operator/evidence/${evidence!.id}/tag`
 expect((await call(path,{tagId:tag.id}, {},'PUT')).status).toBe(401)
 expect((await call(path,{tagId:tag.id},{...f.headers,Origin:'https://foreign.invalid'},'PUT')).status).toBe(403)
 expect((await call(path,{tagId:'missing'},f.headers,'PUT')).status).toBe(404)
 for(let i=0;i<2;i++)expect((await call(path,{tagId:tag.id},f.headers,'PUT')).status).toBe(200)
 expect((await env.DB.prepare('SELECT * FROM evidence_tag_assignments').all()).results).toHaveLength(1)
 expect(await (await call(`/api/public/requests/${r.slug}`)).text()).not.toContain('Internal priority marker')
 expect((await call(path,{tagId:tag.id},f.headers,'DELETE')).status).toBe(200)
 expect((await env.DB.prepare('SELECT * FROM evidence_tag_assignments').all()).results).toHaveLength(0)
})

for(const kind of ['follow','vote'])it(`[F05 REQ-010] concurrent ${kind} replay grants one active permission`,async()=>{
 const f=await boardGraph(1),[r]=f.requests,who=await person()
 const response=await Promise.all(Array.from({length:6},()=>call(`/api/public/requests/${r.slug}/${kind}`,kind==='vote'?{emailUpdates:true}:{},auth(who.token))))
 expect(response.map(r=>r.status)).toEqual(Array(6).fill(204))
 expect((await env.DB.prepare('SELECT id FROM requester_update_permissions WHERE requester_id=? AND revoked_at IS NULL').bind(who.id).all()).results).toHaveLength(1)
 expect((await env.DB.prepare('SELECT * FROM request_follows WHERE requester_id=?').bind(who.id).all()).results).toHaveLength(1)
 await change(r.slug,'follow',who.token,undefined,'DELETE')
 await change(r.slug,kind,who.token,kind==='vote'?{emailUpdates:true}:{})
 expect((await env.DB.prepare('SELECT id FROM requester_update_permissions WHERE requester_id=? AND revoked_at IS NULL').bind(who.id).all()).results).toHaveLength(1)
 expect((await env.DB.prepare('SELECT id FROM requester_update_permissions WHERE requester_id=? AND revoked_at IS NOT NULL').bind(who.id).all()).results).toHaveLength(1)
})

it('[F06 REQ-017] repeated and concurrent declines preserve the preceding state; reversal requires an active decline',async()=>{
 const f=await boardGraph(1),[r]=f.requests
 const status=(status:string,body:string)=>call(`/api/operator/requests/${r.slug}/status-updates`,{status,body},f.headers)
 expect((await status('under_review','Reviewing')).status).toBe(200)
 const declines=await Promise.all([status('declined','First reason'),status('declined','More context')]);expect(declines.map(r=>r.status)).toEqual([200,200])
 expect((await call(`/api/operator/requests/${r.slug}/decline/reverse`,{},f.headers)).status).toBe(200)
 expect(await (await call(`/api/public/requests/${r.slug}`)).json()).toMatchObject({status:'under_review'})
 await change(r.slug,'vote',f.owner.token)
 expect((await call(`/api/operator/requests/${r.slug}/decline/reverse`,{},f.headers)).status).toBe(409)
})

it('[F07 REQ-021] withdrawal removes a pending item from moderation and prevents approval',async()=>{
 const f=await fixture(),who=await person(),r=await submit(f.board,who.token)
 await change(r.slug,'withdraw',who.token)
 expect(await (await call('/api/operator/moderation',undefined,f.headers)).json()).toEqual([])
 expect((await call(`/api/operator/moderation/${r.slug}`,{verdict:'approved',title:'Published',description:'Safe',boardSlug:f.board,displayName:'Public'},f.headers)).status).toBe(409)
 expect((await env.DB.prepare('SELECT * FROM evidence_versions').all()).results).toHaveLength(1)
})

it('[F08 REQ-014] rejected host or bearer credentials cannot become pending actions; absent identity can',async()=>{
 const f=await boardGraph(1),[r]=f.requests
 const pending={'X-Penny-Pending-Token':opaqueToken()},validHost=await hostHeaders()
 for(const invalid of ([{Authorization:'garbage'},{Authorization:`Bearer ${opaqueToken()}`},{'X-Penny-Identity':'forged','X-Penny-Identity-Signature':'invalid'},{'X-Penny-Identity':validHost['X-Penny-Identity']},{'X-Penny-Identity-Signature':validHost['X-Penny-Identity-Signature']},{Authorization:'',...validHost}] as Record<string,string>[])){
  expect((await call(`/api/public/requests/${r.slug}/vote`,{}, {...pending,...invalid})).status).toBe(401)
 }
 expect((await env.DB.prepare('SELECT * FROM requester_pending_actions').all()).results).toHaveLength(0)
 expect((await call(`/api/public/requests/${r.slug}/vote`,{},pending)).status).toBe(202)
 expect((await call(`/api/public/requests/${r.slug}/vote`,{}, {...pending,...validHost})).status).toBe(204)
 expect((await env.DB.prepare('SELECT * FROM request_votes').all()).results).toHaveLength(1)
})

it('[F09 DATA-004] roadmapItem custom fields accept values and stay operator-only',async()=>{
 const f=await fixture(),id=createUlid(),now=new Date().toISOString()
 await env.DB.prepare("INSERT INTO roadmap_items(id,slug,title,summary,status,created_at,updated_at) VALUES(?,?,?,?,'exploring',?,?)").bind(id,'private-roadmap','Private roadmap','Private details',now,now).run()
 const created=await call('/api/operator/settings/custom-fields',{entityType:'roadmapItem',name:'Internal budget',fieldType:'number'},f.headers);expect(created.status).toBe(201)
 const field=await created.json() as {id:string}
 expect((await call(`/api/operator/custom-fields/${field.id}/${id}`,{value:43019},f.headers,'PUT')).status).toBe(200)
 expect(await (await call(`/api/operator/custom-fields/roadmapItem/${id}`,undefined,f.headers)).json()).toMatchObject([{name:'Internal budget',value:43019}])
 expect((await call(`/api/operator/custom-fields/roadmapItem/${id}`)).status).toBe(401)
 expect((await call('/api/operator/custom-fields/__proto__/anything',undefined,f.headers)).status).toBe(400)
})

it('[REQ-023] held submission replay has the same idempotency key/body as direct submission',async()=>{
 const f=await fixture(),pending=opaqueToken(),payload={title:'Original body',description:'No optional fields',boardSlug:f.board,idempotencyKey:crypto.randomUUID()}
 expect((await call('/api/public/requests',payload,{'X-Penny-Pending-Token':pending})).status).toBe(202)
 const email='held-submit@example.test';expect((await call('/api/public/identity/email',{email,displayName:'Held',pendingToken:pending})).status).toBe(202)
 const link=await env.DB.prepare('SELECT token FROM local_auth_outbox WHERE recipient=?').bind(email).first<{token:string}>()
 const verified=await call('/api/public/identity/email/verify',{token:link!.token});expect(verified.status).toBe(200)
 const {token}=await verified.json() as {token:string}
 const replay=await call('/api/public/requests',payload,auth(token));expect(replay.status).toBe(201)
 expect((await env.DB.prepare('SELECT * FROM requests').all()).results).toHaveLength(1)
 expect((await env.DB.prepare('SELECT * FROM evidence_items').all()).results).toHaveLength(1)
})

it('[REQ-023] terminally rejected held actions do not starve later valid work and are reported',async()=>{
 const f=await boardGraph(2),[a,b]=f.requests,pending=opaqueToken(),headers={'X-Penny-Pending-Token':pending}
 expect((await call(`/api/public/requests/${a.slug}/vote`,{},headers)).status).toBe(202)
 expect((await call(`/api/public/requests/${b.slug}/follow`,{},headers)).status).toBe(202)
 expect((await call(`/api/operator/requests/${a.slug}/status-updates`,{status:'declined',body:'Declined'},f.headers)).status).toBe(200)
 const email='held-actions@example.test';await call('/api/public/identity/email',{email,displayName:'Held',pendingToken:pending})
 const link=await env.DB.prepare('SELECT token FROM local_auth_outbox WHERE recipient=?').bind(email).first<{token:string}>()
 const result=await call('/api/public/identity/email/verify',{token:link!.token});expect(result.status).toBe(200);expect(await result.json()).toMatchObject({rejectedPendingActions:1})
 expect((await env.DB.prepare('SELECT request_id FROM request_follows').all()).results).toEqual([{request_id:b.id}])
 expect((await env.DB.prepare('SELECT * FROM requester_pending_actions').all()).results).toHaveLength(0)
})

it('[BASE-ACCESS-003] anonymous holds stop at the shared IP write limit',async()=>{
 const f=await boardGraph(1),[r]=f.requests
 const responses=[]
 for(let i=0;i<31;i++)responses.push(await call(`/api/public/requests/${r.slug}/comments`,{body:'Held'}, {'X-Penny-Pending-Token':opaqueToken(),'CF-Connecting-IP':'192.0.2.17'}))
 expect(responses.slice(0,30).map(r=>r.status)).toEqual(Array(30).fill(202));expect(responses[30].status).toBe(429)
 expect((await env.DB.prepare('SELECT * FROM requester_pending_actions').all()).results).toHaveLength(30)
})

it('[BASE-ACCESS-003] one identity cannot evade its write limit by changing IP',async()=>{
 const f=await boardGraph(1),[r]=f.requests,who=await person()
 const responses=[]
 for(let i=0;i<21;i++)responses.push(await call(`/api/public/requests/${r.slug}/comments`,{body:'Held'}, {...auth(who.token),'CF-Connecting-IP':`192.0.2.${i+1}`}))
 expect(responses.slice(0,20).map(r=>r.status)).toEqual(Array(20).fill(201));expect(responses[20].status).toBe(429)
 expect((await env.DB.prepare('SELECT * FROM request_comments').all()).results).toHaveLength(20)
})

it('[BASE-INPUT-003] multipart extras and total streamed oversize cannot persist D1 or R2 attachments',async()=>{
 const f=await boardGraph(1),[r]=f.requests
 const send=(body:FormData)=>app.fetch(new Request(`http://penny.test/api/public/requests/${r.slug}/attachments`,{method:'POST',headers:auth(f.owner.token),body}),bindings)
 const extra=new FormData();extra.set('file',new File(['tiny'],'tiny.png',{type:'image/png'}));extra.set('ignored','surprise')
 expect((await send(extra)).status).toBe(400)
 const huge=new FormData();huge.set('file',new File(['tiny'],'tiny.png',{type:'image/png'}));huge.set('extra',new File([new Uint8Array(25*1024*1024)],'extra.bin'))
 expect((await send(huge)).status).toBe(413)
 expect((await env.DB.prepare('SELECT * FROM attachments').all()).results).toHaveLength(0)
})

it('[REQ-019] private-board status cannot enter a public detail response under concurrent reads',async()=>{
 const f=await boardGraph(1),[r]=f.requests
 const reading=Promise.all(Array.from({length:12},()=>call(`/api/public/requests/${r.slug}`).then(r=>r.text())))
 expect((await call(`/api/operator/boards/${f.board}`,{visibility:'internal'},f.headers,'PATCH')).status).toBe(200)
 expect((await call(`/api/operator/requests/${r.slug}/status-updates`,{status:'under_review',body:'Private update'},f.headers)).status).toBe(404)
 const bodies=await reading;for(const body of bodies)expect(body).not.toContain('Private update')
 expect((await call(`/api/public/requests/${r.slug}`)).status).toBe(404)
})
