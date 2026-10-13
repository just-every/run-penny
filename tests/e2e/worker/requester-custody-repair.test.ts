import { it,expect } from 'vitest'
import inventory from '../../../src/core/features/data/schema-inventory.json'
import { repairDatabase,boardGraph,call,app,bindings,env,opaqueToken,person,change,merge,unmerge,fixture,submit } from './requester-repair-fixture'
import { RequestAttachmentService } from '../../../src/core/features/requests/attachment-service'
import { exportArchive,planErasure,eraseEntity } from '../../../src/core/features/data/archive'
import { RequestWriteRepository } from '../../../src/core/features/requests/write-repository'
import { RequestOperatorRepository } from '../../../src/core/features/requests/operator-repository'
import { createBlobStore } from '../../../src/core/platform/blobs'
repairDatabase()

it('[REQ-024] identity merge then request unmerge restores the survivor and no orphan vote or permission',async()=>{
 const f=await boardGraph(2),[a,b]=f.requests,source=await person(),target=await person()
 for(const who of [source,target])await change(a.slug,'vote',who.token,{emailUpdates:true})
 await merge(a.slug,b.slug,f.headers)
 const permissions=(await env.DB.prepare('SELECT id FROM requester_update_permissions ORDER BY id').all()).results
 expect((await call(`/api/operator/requesters/${source.id}/merge`,{targetRequesterId:target.id},f.headers)).status).toBe(200)
 await unmerge(a.slug,f.headers)
 expect((await env.DB.prepare('SELECT request_id,requester_id FROM request_votes').all()).results).toEqual([{request_id:a.id,requester_id:target.id}])
 expect((await env.DB.prepare('SELECT request_id,requester_id FROM request_follows').all()).results).toEqual([{request_id:a.id,requester_id:target.id}])
 expect((await env.DB.prepare('SELECT id FROM requester_update_permissions ORDER BY id').all()).results).toEqual(permissions)
 await change(a.slug,'vote',target.token,undefined,'DELETE')
 expect((await env.DB.prepare('SELECT * FROM request_votes').all()).results).toHaveLength(0)
})

it('[REQ-023] an old still-valid link cannot replay an action under a rebound pending token',async()=>{
 const f=await boardGraph(1),[r]=f.requests,pending=opaqueToken(),a='first-recipient@example.test',b='next-recipient@example.test'
 await call(`/api/public/requests/${r.slug}/vote`,{}, {'X-Penny-Pending-Token':pending})
 await call('/api/public/identity/email',{email:a,displayName:'A',pendingToken:pending})
 const oldLink=(await env.DB.prepare('SELECT token FROM local_auth_outbox WHERE recipient=?').bind(a).first<{token:string}>())!
 await env.DB.prepare("UPDATE requester_pending_action_bindings SET expires_at='2000-01-01'").run()
 await call('/api/public/identity/email',{email:b,displayName:'B',pendingToken:pending})
 await call(`/api/public/requests/${r.slug}/vote`,{}, {'X-Penny-Pending-Token':pending})
 const consumed=await call('/api/public/identity/email/verify',{token:oldLink.token});expect(consumed.status).toBe(200)
 expect((await env.DB.prepare('SELECT * FROM request_votes').all()).results).toHaveLength(0)
 const newLink=(await env.DB.prepare('SELECT token FROM local_auth_outbox WHERE recipient=?').bind(b).first<{token:string}>())!
 expect((await call('/api/public/identity/email/verify',{token:newLink.token})).status).toBe(200)
 const voter=await env.DB.prepare('SELECT a.email FROM request_votes v JOIN requester_addresses a ON a.requester_id=v.requester_id').first()
 expect(voter).toEqual({email:b})
})

it('[REQ-003/030] initial submission cannot be approved through the edit-only route',async()=>{
 const f=await fixture(),who=await person(),r=await submit(f.board,who.token)
 const initial=(await env.DB.prepare('SELECT id FROM request_content_submissions').first<{id:string}>())!
 const context=await (await call(`/api/operator/requests/${r.slug}/context`,undefined,f.headers)).json() as {edits:unknown[]}
 expect(context.edits).toEqual([])
 expect((await call(`/api/operator/requests/edits/${initial.id}/moderate`,{verdict:'approved'},f.headers)).status).toBe(404)
 expect(await env.DB.prepare('SELECT moderation_state,published_at FROM requests').first()).toEqual({moderation_state:'awaiting_review',published_at:null})
 expect((await call(`/api/operator/moderation/${r.slug}`,{verdict:'approved',title:'Public',description:'Reviewed',boardSlug:f.board,displayName:'Reviewed person'},f.headers)).status).toBe(200)
 expect((await call(`/api/public/requests/${r.slug}`)).status).toBe(200)
})

it('[DATA-001] every requester-board table retains the maintenance write fence',async()=>{
 const f=await boardGraph(1),[r]=f.requests
 const tables=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'data_%' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT IN ('d1_migrations','operator_sessions')").all<{name:string}>()
 const triggers=await env.DB.prepare("SELECT tbl_name,sql FROM sqlite_master WHERE type='trigger'").all<{tbl_name:string;sql:string}>()
 const classified=inventory as Record<string,{classification:string}>
 for(const table of tables.results.filter(table=>classified[table.name]?.classification==='product'))for(const verb of ['INSERT','UPDATE','DELETE']){
  const guard=triggers.results.find(trigger=>trigger.tbl_name===table.name&&new RegExp(`BEFORE ${verb} ON `,'i').test(trigger.sql)&&/data[ _]maintenance/.test(trigger.sql))
  expect(guard?.sql,table.name+' '+verb+' maintenance fence').toContain('data_state')
 }
 await env.DB.prepare("UPDATE data_state SET phase='locked',lock_id='synthetic-maintenance' WHERE singleton=1").run()
 try {
  expect((await call(`/api/public/requests/${r.slug}/comments`,{body:'Should not be accepted'},{'X-Penny-Pending-Token':opaqueToken()})).status).toBe(503)
  expect((await call(`/api/operator/requests/${r.slug}/notes`,{body:'Should not be accepted'},f.headers)).status).toBe(503)
  expect((await env.DB.prepare('SELECT * FROM requester_pending_actions').all()).results).toHaveLength(0)
  expect((await env.DB.prepare('SELECT * FROM request_notes').all()).results).toHaveLength(0)
 }finally{await env.DB.prepare("UPDATE data_state SET phase='idle',lock_id=NULL WHERE singleton=1").run()}
})

for(const mode of ['committed-response-lost','uncommitted-response-lost'] as const)it(`[REQ-011 DATA-001] ${mode} preserves R2 bytes and recovers from durable upload reservation`,async()=>{
 const f=await boardGraph(1),[r]=f.requests
 let fault=true
 // Fault transport only: every successful operation still runs against actual D1.
 const db=new Proxy(env.DB,{get(target,property){if(property==='batch')return async(statements:D1PreparedStatement[])=>{
  if(!fault)return target.batch(statements)
  fault=false
  if(mode==='committed-response-lost')await target.batch(statements)
  throw new Error('Synthetic D1 response loss')
 };const value=Reflect.get(target,property);return typeof value==='function'?value.bind(target):value}})
 const bytes=new Uint8Array([137,80,78,71,77])
 const service=new RequestAttachmentService({binding:db},createBlobStore(env.FILES))
 const result=service.upload({requesterId:f.owner.id,verifiedEmail:f.owner.email,displayName:'Owner'},r.slug,new File([bytes],'custody.png',{type:'image/png'}),new Date().toISOString())
 if(mode==='committed-response-lost')await expect(result).resolves.toEqual({id:expect.any(String)})
 else {
  await expect(result).rejects.toThrow('Synthetic D1 response loss')
  const pending=(await env.DB.prepare('SELECT id,storage_key FROM request_attachment_uploads').first<{id:string;storage_key:string}>())!
  expect(new Uint8Array(await (await env.FILES.get(pending.storage_key))!.arrayBuffer())).toEqual(bytes)
  expect((await call(`/api/operator/attachment-uploads/${pending.id}/recover`,{},f.headers)).status).toBe(200)
 }
 const row=(await env.DB.prepare('SELECT storage_key FROM attachments').first<{storage_key:string}>())!
 expect(new Uint8Array(await (await env.FILES.get(row.storage_key))!.arrayBuffer())).toEqual(bytes)
 expect((await env.DB.prepare('SELECT * FROM request_attachment_uploads').all()).results).toHaveLength(0)
})

it('[REQ-010] explicit permission revocation is not undone by unmerge or notification preparation',async()=>{
 const f=await boardGraph(2),[a,b]=f.requests,who=await person()
 await change(a.slug,'follow',who.token);await merge(a.slug,b.slug,f.headers)
 await env.DB.prepare('UPDATE requester_update_permissions SET revoked_at=? WHERE requester_id=?').bind(new Date().toISOString(),who.id).run()
 expect((await call(`/api/operator/requests/${b.slug}/status-updates`,{status:'under_review',body:'Reviewing'},f.headers)).status).toBe(200)
 expect((await env.DB.prepare('SELECT * FROM notification_outbox').all()).results).toHaveLength(0)
 await unmerge(a.slug,f.headers)
 expect((await env.DB.prepare('SELECT * FROM request_follows').all()).results).toHaveLength(0)
})

it('[REQ-023/010] concurrent verification of two issued links applies a held follow once',async()=>{
 const f=await boardGraph(1),[r]=f.requests,pending=opaqueToken(),email='concurrent-replay@example.test'
 await call(`/api/public/requests/${r.slug}/follow`,{}, {'X-Penny-Pending-Token':pending})
 for(let i=0;i<2;i++)expect((await call('/api/public/identity/email',{email,displayName:'Concurrent',pendingToken:pending})).status).toBe(202)
 const links=await env.DB.prepare('SELECT token FROM local_auth_outbox WHERE recipient=?').bind(email).all<{token:string}>()
 const responses=await Promise.all(links.results.map(link=>call('/api/public/identity/email/verify',{token:link.token})))
 expect(responses.map(r=>r.status)).toEqual([200,200])
 expect((await env.DB.prepare('SELECT * FROM request_follows').all()).results).toHaveLength(1)
 expect((await env.DB.prepare('SELECT * FROM requester_update_permissions WHERE revoked_at IS NULL').all()).results).toHaveLength(1)
 expect((await env.DB.prepare('SELECT * FROM requester_pending_actions').all()).results).toHaveLength(0)
})

function beforeBatch(action:()=>Promise<void>):D1Database {
 let pending=true
 return new Proxy(env.DB,{get(target,property){if(property==='batch')return async(statements:D1PreparedStatement[])=>{
  if(pending){pending=false;await action()}
  return target.batch(statements)
 };const value=Reflect.get(target,property);return typeof value==='function'?value.bind(target):value}})
}
for(const transition of ['merge','unmerge'] as const)it(`[REQ-010] revocation follows the selected origin through an interleaved ${transition}`,async()=>{
 const f=await boardGraph(2),[a,b]=f.requests,who=await person()
 await change(a.slug,'follow',who.token)
 if(transition==='unmerge')await merge(a.slug,b.slug,f.headers)
 const db=beforeBatch(async()=>{if(transition==='merge')await merge(a.slug,b.slug,f.headers);else await unmerge(a.slug,f.headers)})
 await new RequestWriteRepository({binding:db}).unfollow({requesterId:who.id,verifiedEmail:who.email,displayName:'Requester'},a.slug)
 expect((await env.DB.prepare('SELECT * FROM request_follows').all()).results).toHaveLength(0)
 expect((await env.DB.prepare('SELECT * FROM requester_update_permissions WHERE revoked_at IS NULL').all()).results).toHaveLength(0)
})
it('[REQ-010] revocation between notification candidate read and status transaction prevents an intent',async()=>{
 const f=await boardGraph(1),[r]=f.requests,who=await person()
 await change(r.slug,'follow',who.token)
 const db=beforeBatch(async()=>{await change(r.slug,'follow',who.token,undefined,'DELETE')})
 await new RequestOperatorRepository({binding:db}).publishStatusUpdate({slug:r.slug,operatorId:f.operator,status:'under_review',body:'Reviewing',pinned:false,now:new Date().toISOString()})
 expect((await env.DB.prepare('SELECT * FROM request_status_updates').all()).results).toHaveLength(1)
 expect((await env.DB.prepare('SELECT * FROM notification_outbox').all()).results).toHaveLength(0)
})

it('[DATA-001] an interrupted upload blocks incomplete export and remains in original-byte erasure custody',async()=>{
 const f=await boardGraph(1),[r]=f.requests
 const db=beforeBatch(async()=>{throw new Error('Synthetic metadata interruption')})
 const service=new RequestAttachmentService({binding:db},createBlobStore(env.FILES))
 await expect(service.upload({requesterId:f.owner.id,verifiedEmail:f.owner.email,displayName:'Owner'},r.slug,new File(['original private PDF bytes'],'private.pdf',{type:'application/pdf'}),new Date().toISOString())).rejects.toThrow('Synthetic metadata interruption')
 const pending=(await env.DB.prepare('SELECT storage_key FROM request_attachment_uploads').first<{storage_key:string}>())!
 await expect(exportArchive(env.DB,env.FILES)).rejects.toMatchObject({code:'unfinished_attachment_uploads'})
 expect(await env.FILES.get(pending.storage_key)).not.toBeNull()
 const plan=await planErasure(env.DB,'requests',r.id)
 expect(plan.files).toContain(pending.storage_key);expect(plan.blockedCopies).toEqual([])
 expect((await eraseEntity(env.DB,env.FILES,'requests',r.id,plan.planHash)).status).toBe('complete')
 expect(await env.FILES.get(pending.storage_key)).toBeNull()
 expect((await env.DB.prepare('SELECT * FROM request_attachment_uploads').all()).results).toHaveLength(0)
})

it('[REQ-011 DATA-001] missing stored bytes recover only with the matching original file and keep the same reservation',async()=>{
 const f=await boardGraph(1),[r]=f.requests,bytes='An original file with private context.'
 const store=createBlobStore(env.FILES)
 const interrupted={...store,put:async()=>{throw new Error('Synthetic storage interruption')}}
 const service=new RequestAttachmentService({binding:env.DB},interrupted)
 await expect(service.upload({requesterId:f.owner.id,verifiedEmail:f.owner.email,displayName:'Owner'},r.slug,new File([bytes],'original.pdf',{type:'application/pdf'}),new Date().toISOString())).rejects.toThrow('Synthetic storage interruption')
 const pending=(await env.DB.prepare('SELECT id,storage_key FROM request_attachment_uploads').first<{id:string;storage_key:string}>())!
 const path=`/api/operator/attachment-uploads/${pending.id}/recover`
 expect((await call(path,{},f.headers)).status).toBe(409)
 for(const [content,status] of [['wrong bytes',409],[bytes,200]] as const){
  const form=new FormData();form.append('file',new File([content],'original.pdf',{type:'application/pdf'}))
  const response=await app.fetch(new Request(`${bindings.APP_ORIGIN}${path}`,{method:'POST',headers:f.headers,body:form}),bindings)
  expect(response.status).toBe(status)
 }
 expect(await (await env.FILES.get(pending.storage_key))!.text()).toBe(bytes)
 expect(await env.DB.prepare('SELECT id,public_state FROM attachments WHERE id=?').bind(pending.id).first()).toEqual({id:pending.id,public_state:'operator_only'})
 expect((await env.DB.prepare('SELECT * FROM request_attachment_uploads').all()).results).toHaveLength(0)
})
