import { it,expect } from 'vitest'
import { boardGraph,person,env,call,auth,merge,unmerge,latch,createUlid } from './requester-final-fixture'
import { RequestAttachmentService } from '../../../src/core/features/requests/attachment-service'
import { recoverAttachment,fileDigest,finishAttachment } from '../../../src/core/features/requests/attachment-upload'
import { createBlobStore } from '../../../src/core/platform/blobs'
import { eraseEntity,planErasure } from '../../../src/core/features/data/archive'
it('[REQ-019 REQ-025] activity retains consent to the known original without revealing a never-published internal canonical',async()=>{
 const f=await boardGraph(2),[a,b]=f.requests,who=await person()
 expect((await call(`/api/public/requests/${a.slug}/follow`,{},auth(who.token))).status).toBe(204)
 await env.DB.prepare("UPDATE boards SET visibility='internal'").run()
 await env.DB.prepare("UPDATE requests SET slug='confidential-acquisition-plan',published_at=NULL,public_state='unpublished',moderation_state='awaiting_review' WHERE id=?").bind(b.id).run()
 await merge(a.slug,'confidential-acquisition-plan',f.headers)
 const response=await call('/api/public/requester/activity',undefined,auth(who.token)),text=await response.text()
 expect(text).not.toContain('confidential-acquisition-plan');expect(text).not.toContain(b.id)
 const activity=JSON.parse(text) as {follows:{slug:string;available:number}[]}
 expect(activity.follows).toEqual([{slug:a.slug,mutedAt:null,available:0}])
 expect((await call(`/api/public/requests/${a.slug}/follow`,{muted:true},auth(who.token),'PATCH')).status).toBe(204)
 expect((await call(`/api/public/requests/${a.slug}/follow`,undefined,auth(who.token),'DELETE')).status).toBe(204)
 expect((await env.DB.prepare('SELECT * FROM requester_update_permissions WHERE requester_id=? AND revoked_at IS NULL').bind(who.id).all()).results).toEqual([])
 await unmerge(a.slug,f.headers)
 expect((await env.DB.prepare('SELECT * FROM request_follows').all()).results).toEqual([])
})
for(const kind of ['upload','recovery'] as const)
it(`[DATA-003 REQ-011] ${kind} blocks erasure until an in-flight native R2 put has settled`,async()=>{
 const f=await boardGraph(1),[r]=f.requests,store=createBlobStore(env.FILES),entered=latch(),release=latch(),now=new Date().toISOString()
 const bytes=new TextEncoder().encode('Original private bytes across concurrent erasure'),file=new File([bytes],'private.pdf',{type:'application/pdf'})
 // Scheduling wrapper only; the delayed write itself uses the native R2 binding.
 const delayed={...store,put:async(key:string,value:ReadableStream|ArrayBuffer|ArrayBufferView|Blob|string,type:string)=>{entered.release();await release.promise;await store.put(key,value,type)}}
 let operation:Promise<unknown>
 if(kind==='upload')operation=new RequestAttachmentService({binding:env.DB},delayed).upload({requesterId:f.owner.id,verifiedEmail:f.owner.email,displayName:'Owner'},r.slug,file,now)
 else {
  const id=createUlid()
  await env.DB.prepare('INSERT INTO request_attachment_uploads(id,request_id,storage_key,original_filename,content_type,byte_size,sha256,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,r.id,`requests/${r.id}/${id}`,file.name,file.type,file.size,await fileDigest(await file.arrayBuffer()),now,now).run()
  operation=recoverAttachment({binding:env.DB},delayed,id,file)
 }
 await entered.promise
 const row=(await env.DB.prepare('SELECT * FROM request_attachment_uploads').first<{id:string;storage_key:string;writing:number}>())!
 try {
  expect(row.writing).toBe(1);expect(await env.FILES.get(row.storage_key)).toBeNull()
  const plan=await planErasure(env.DB,'requests',r.id)
  await expect(eraseEntity(env.DB,env.FILES,'requests',r.id,plan.planHash)).rejects.toMatchObject({code:'attachment_writer_active'})
  expect(await env.DB.prepare('SELECT phase FROM data_state').first()).toEqual({phase:'idle'})
  expect(await env.DB.prepare('SELECT id FROM requests WHERE id=?').bind(r.id).first()).not.toBeNull()
  await expect(recoverAttachment({binding:env.DB},store,row.id,file)).rejects.toMatchObject({code:'attachment_writer_active'})
 }finally{release.release()}
 await operation
 expect(new Uint8Array(await (await env.FILES.get(row.storage_key))!.arrayBuffer())).toEqual(bytes)
 const settled=await planErasure(env.DB,'requests',r.id)
 expect((await eraseEntity(env.DB,env.FILES,'requests',r.id,settled.planHash)).status).toBe('complete')
 expect(await env.FILES.get(row.storage_key)).toBeNull()
 expect((await env.FILES.list()).objects).toEqual([])
 expect((await env.DB.prepare('SELECT * FROM attachments').all()).results).toEqual([])
 expect((await env.DB.prepare('SELECT * FROM request_attachment_uploads').all()).results).toEqual([])
})
it('[REQ-011] zero-row upload finalization cannot report success',async()=>{
 await expect(finishAttachment({binding:env.DB},{id:createUlid(),request_id:createUlid(),storage_key:'absent',original_filename:'gone.pdf',content_type:'application/pdf',byte_size:1,sha256:'0'.repeat(64),created_at:new Date().toISOString(),updated_at:new Date().toISOString()})).rejects.toMatchObject({code:'upload_custody_changed'})
})
it('[REQ-009 DATA-001] a transferred then rejected attachment returns to its origin on unmerge with R2 bytes private',async()=>{
 const f=await boardGraph(2),[a,b]=f.requests,bytes='The original PDF remains private'
 const uploaded=await new RequestAttachmentService({binding:env.DB},createBlobStore(env.FILES)).upload({requesterId:f.owner.id,verifiedEmail:f.owner.email,displayName:'Owner'},a.slug,new File([bytes],'private.pdf',{type:'application/pdf'}),new Date().toISOString())
 expect((await call(`/api/operator/attachments/${uploaded.id}/moderate`,{verdict:'approved'},f.headers)).status).toBe(200)
 await merge(a.slug,b.slug,f.headers)
 expect((await call(`/api/operator/attachments/${uploaded.id}/moderate`,{verdict:'rejected',reason:'Remove from publication'},f.headers)).status).toBe(200)
 await unmerge(a.slug,f.headers)
 expect(await env.DB.prepare('SELECT request_id,origin_request_id,public_state FROM attachments WHERE id=?').bind(uploaded.id).first()).toEqual({request_id:a.id,origin_request_id:a.id,public_state:'rejected'})
 expect((await call(`/api/public/attachments/${uploaded.id}`)).status).toBe(404)
 const privateFile=await call(`/api/operator/attachments/${uploaded.id}`,undefined,f.headers)
 expect(privateFile.status).toBe(200);expect(new TextDecoder().decode(await privateFile.arrayBuffer())).toBe(bytes)
})
it('[REQ-019 REQ-025] a published canonical follow remains available once per current request',async()=>{
 const f=await boardGraph(2),[a,b]=f.requests,who=await person()
 for(const r of [a,b])expect((await call(`/api/public/requests/${r.slug}/follow`,{},auth(who.token))).status).toBe(204)
 await merge(a.slug,b.slug,f.headers)
 const activity=await (await call('/api/public/requester/activity',undefined,auth(who.token))).json() as {follows:unknown[]}
 expect(activity.follows).toEqual([{slug:b.slug,mutedAt:null,available:1}])
})
it('[REQ-011 REQ-024] upload reservation refuses a requester identity retired after ownership was read',async()=>{
 const f=await boardGraph(1),[r]=f.requests,target=await person(),now=new Date().toISOString()
 let armed=true
 const db=new Proxy(env.DB,{get(database,key){
  if(key==='prepare')return (sql:string)=>{const stmt=database.prepare(sql);if(!sql.startsWith('INSERT INTO request_attachment_uploads'))return stmt
   return {bind:(...values:(string|number|null)[])=>({all:async()=>{
    if(armed){armed=false;expect((await call(`/api/operator/requesters/${f.owner.id}/merge`,{targetRequesterId:target.id},f.headers)).status).toBe(200)}
    return stmt.bind(...values).all()
   }})}
  }
  const value=Reflect.get(database,key);return typeof value==='function'?value.bind(database):value
 }})
 await expect(new RequestAttachmentService({binding:db},createBlobStore(env.FILES)).upload({requesterId:f.owner.id,verifiedEmail:f.owner.email,displayName:'Old identity'},r.slug,new File(['private file'],'private.pdf',{type:'application/pdf'}),now)).rejects.toMatchObject({code:'requester_action_changed'})
 expect((await env.DB.prepare('SELECT * FROM request_attachment_uploads').all()).results).toEqual([])
 expect((await env.FILES.list()).objects).toEqual([])
})

it('[REQ-011 DATA-003] interrupted upload writer release needs operator quiescence confirmation and preserves original custody',async()=>{
 const f=await boardGraph(1),[r]=f.requests,id=createUlid(),key=`requests/${r.id}/${id}`,file=new File(['Exact interrupted original'],'original.pdf',{type:'application/pdf'}),now=new Date().toISOString()
 await env.DB.prepare('INSERT INTO request_attachment_uploads(id,request_id,storage_key,original_filename,content_type,byte_size,sha256,created_at,updated_at,writing) VALUES(?,?,?,?,?,?,?,?,?,1)').bind(id,r.id,key,file.name,file.type,file.size,await fileDigest(await file.arrayBuffer()),now,now).run()
 expect((await call(`/api/operator/attachment-uploads/${id}/release-writer`,{} ,f.headers)).status).toBe(400)
 expect((await call(`/api/operator/attachment-uploads/${id}/release-writer`,{priorWriterStopped:true})).status).toBe(401)
 expect(await env.DB.prepare('SELECT writing FROM request_attachment_uploads WHERE id=?').bind(id).first()).toEqual({writing:1})
 expect((await call(`/api/operator/attachment-uploads/${id}/release-writer`,{priorWriterStopped:true},f.headers)).status).toBe(200)
 await expect(recoverAttachment({binding:env.DB},createBlobStore(env.FILES),id,new File(['Wrong bytes'],'original.pdf',{type:'application/pdf'}))).rejects.toMatchObject({code:'upload_bytes_mismatch'})
 expect(await env.DB.prepare('SELECT writing FROM request_attachment_uploads WHERE id=?').bind(id).first()).toEqual({writing:0})
 await recoverAttachment({binding:env.DB},createBlobStore(env.FILES),id,file)
 expect(new Uint8Array(await (await env.FILES.get(key))!.arrayBuffer())).toEqual(new Uint8Array(await file.arrayBuffer()))
 expect((await call(`/api/public/attachments/${id}`)).status).toBe(404)
 expect(await env.DB.prepare('SELECT id FROM request_attachment_uploads WHERE id=?').bind(id).first()).toBeNull()
})
