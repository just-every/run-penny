import { it,expect } from 'vitest'
import { repairDatabase,boardGraph,fixture,person,submit,change,env,call,auth,app,bindings,opaqueToken,createUlid } from './requester-repair-fixture'
import { base64urlEncode,sign } from '../../../src/core/features/auth/tokens'
repairDatabase()

async function hostHeaders(email='host-repair@example.test') {
 const encoded=base64urlEncode(new TextEncoder().encode(JSON.stringify({aud:bindings.APP_ORIGIN,issuedAt:new Date().toISOString(),displayName:'Host',email})))
 return {'X-Penny-Identity':encoded,'X-Penny-Identity-Signature':base64urlEncode(await sign(bindings.PORTAL_IDENTITY_SECRET,encoded))}
}
it('[F03 REQ-003] unavailable transport refuses submissions before host provisioning or anonymous holding',async()=>{
 const f=await fixture(),payload={title:'Held',description:'A truthful boundary',boardSlug:f.board,idempotencyKey:crypto.randomUUID()}
 const unavailable={...bindings,PENNY_AUTH_TRANSPORT:undefined}
 const caps=await app.fetch(new Request(`${bindings.APP_ORIGIN}/api/auth/capabilities`),unavailable)
 expect(await caps.json()).toEqual({transport:'unavailable'})
 for(const headers of [await hostHeaders(),{'X-Penny-Pending-Token':opaqueToken()}]){
  const response=await app.fetch(new Request(`${bindings.APP_ORIGIN}/api/public/requests`,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(payload)}),unavailable)
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
 expect((await call(path,{tagId:tag.id},{Cookie:f.headers.Cookie},'PUT')).status).toBe(403)
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

it('[F07 REQ-021] moderation excludes inactive requests while account and item history remain complete',async()=>{
 const f=await fixture(),who=await person(),r=await submit(f.board,who.token)
 await change(r.slug,'withdraw',who.token)
 expect(await (await call('/api/operator/moderation',undefined,f.headers)).json()).toMatchObject({items:[],total:0})
 expect(await (await call('/api/operator/moderation?status=withdrawn',undefined,f.headers)).json()).toMatchObject({items:[{slug:r.slug,publicState:'withdrawn',moderationAvailability:'withdrawn'}],total:1})
 const request=await env.DB.prepare('SELECT id FROM requests WHERE slug=?').bind(r.slug).first<{id:string}>()
 expect(await (await call(`/api/operator/moderation?item=${request!.id}`,undefined,f.headers)).json()).toMatchObject({items:[{slug:r.slug,publicState:'withdrawn',moderationAvailability:'withdrawn'}],total:1})
 expect(await (await call(`/api/operator/requests/${r.slug}/context`,undefined,f.headers)).json()).toMatchObject({actions:{moderation:false,publish:false,reverseDecline:false,merge:true,unmerge:false}})
 expect((await call(`/api/operator/moderation/${r.slug}`,{verdict:'approved',title:'Published',description:'Safe',boardSlug:f.board,displayName:'Public'},f.headers)).status).toBe(409)
 expect((await env.DB.prepare('SELECT * FROM evidence_versions').all()).results).toHaveLength(1)
 const activeAuthor=await person(),blockedAuthor=await person()
 const merged=await submit(f.board,activeAuthor.token,'Merged feedback'),current=await submit(f.board,activeAuthor.token,'Current feedback'),blocked=await submit(f.board,blockedAuthor.token,'Blocked author feedback')
 expect((await call(`/api/operator/requests/${merged.slug}/merge`,{targetSlug:current.slug},f.headers)).status).toBe(200)
 expect((await call(`/api/operator/requesters/${blockedAuthor.id}/block`,{},f.headers)).status).toBe(200)
 const account=createUlid(),now=new Date().toISOString()
 await env.DB.batch([
  env.DB.prepare('INSERT INTO accounts(id,slug,name,created_at,updated_at) VALUES(?,?,?,?,?)').bind(account,'history-account','History account',now,now),
  ...[who,activeAuthor,blockedAuthor].map(author=>env.DB.prepare('INSERT INTO requester_account_links(requester_id,account_id,created_at) VALUES(?,?,?)').bind(author.id,account,now)),
 ])
 expect(await (await call('/api/operator/moderation',undefined,f.headers)).json()).toMatchObject({items:[{slug:current.slug,moderationAvailability:'current'}],total:1})
 const history=await (await call('/api/operator/moderation?account=history-account&sort=name',undefined,f.headers)).json() as {items:{id:string;slug:string;moderationAvailability:string}[];total:number;pageSize:number}
 expect(history.total).toBe(4)
 expect(history.items.map(item=>[item.slug,item.moderationAvailability])).toEqual([[blocked.slug,'inactive_author'],[current.slug,'current'],[merged.slug,'merged'],[r.slug,'withdrawn']])
 const preview=await (await call('/api/operator/accounts/history-account',undefined,f.headers)).json() as {linkedRequestCount:number;requests:{id:string}[]}
 expect(preview.linkedRequestCount).toBe(history.total)
 expect(preview.requests.map(item=>item.id)).toEqual(history.items.map(item=>item.id))
 for(const slug of [merged.slug,blocked.slug]){
  const item=history.items.find(item=>item.slug===slug)!
  expect(await (await call(`/api/operator/moderation?item=${item.id}`,undefined,f.headers)).json()).toMatchObject({items:[item],total:1})
  expect(await (await call(`/api/operator/requests/${slug}/context`,undefined,f.headers)).json()).toMatchObject({actions:{moderation:false,publish:false,merge:slug!==merged.slug,unmerge:slug===merged.slug}})
  expect((await call(`/api/operator/moderation/${slug}`,{verdict:'approved',title:'Published',description:'Safe',boardSlug:f.board,displayName:'Public'},f.headers)).status).toBe(409)
 }
 expect(await (await call('/api/operator/moderation?account=history-account&status=withdrawn',undefined,f.headers)).json()).toMatchObject({items:[{slug:r.slug}],total:1})
 // Move retained history beyond the account preview, then follow its real continuation.
 const extra=Array.from({length:history.pageSize+1-history.total},()=>createUlid())
 await env.DB.batch(extra.map(id=>env.DB.prepare(`INSERT INTO requests(id,slug,board_id,author_requester_id,title,description,moderation_state,public_state,created_at,updated_at)
  SELECT ?,?,board_id,author_requester_id,?,'Account feedback','awaiting_review','unpublished',?,? FROM requests WHERE slug=?`).bind(id,`history-${id.toLowerCase()}`,`Additional feedback ${id}`,now,now,current.slug)))
 const first=await (await call('/api/operator/moderation?account=history-account&sort=name',undefined,f.headers)).json() as typeof history
 const next=await (await call('/api/operator/moderation?account=history-account&sort=name&page=2',undefined,f.headers)).json() as typeof history
 const accountDetail=await (await call('/api/operator/accounts/history-account',undefined,f.headers)).json() as typeof preview
 expect(first.total).toBe(history.total+extra.length)
 expect(next.total).toBe(first.total)
 expect(first.items).toHaveLength(first.pageSize)
 expect(next.items).toMatchObject([{slug:r.slug,moderationAvailability:'withdrawn'}])
 expect(new Set([...first.items,...next.items].map(item=>item.id)).size).toBe(first.total)
 expect(accountDetail.linkedRequestCount).toBe(first.total)
 expect(accountDetail.requests.map(item=>item.id)).toEqual(first.items.map(item=>item.id))
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
 expect((await call(`/api/operator/custom-fields/roadmapItem/${field.id}/${id}`,{value:43019},f.headers,'PUT')).status).toBe(200)
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
 const send=(body:FormData)=>app.fetch(new Request(`${bindings.APP_ORIGIN}/api/public/requests/${r.slug}/attachments`,{method:'POST',headers:auth(f.owner.token),body}),bindings)
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
