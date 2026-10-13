import { it,expect } from 'vitest'
import { repairDatabase,boardGraph,call,auth,env,change } from './requester-repair-fixture'
repairDatabase()

for(const kind of ['request_edit','comment_edit'] as const)it(`[REQ-030] ${kind} appeal can reopen, receive a new verdict and retain its decision`,async()=>{
 const f=await boardGraph(1),[r]=f.requests
 let editId:string,path:string
 if(kind==='request_edit'){
  const edit=await call(`/api/public/requests/${r.slug}`,{title:'Revised request',description:'Revised description'},auth(f.owner.token),'PATCH');expect(edit.status).toBe(200)
  editId=(await env.DB.prepare("SELECT id FROM request_content_submissions WHERE moderation_state='awaiting_review'").first<{id:string}>())!.id
  path=`/api/operator/requests/edits/${editId}/moderate`
 }else{
  const comment=await call(`/api/public/requests/${r.slug}/comments`,{body:'Original comment'},auth(f.owner.token));expect(comment.status).toBe(201)
  const {id}=await comment.json() as {id:string}
  expect((await call(`/api/operator/comments/${id}/moderate`,{verdict:'approved',publicAuthorDisplayName:'Approved'},f.headers)).status).toBe(200)
  const edit=await call(`/api/public/comments/${id}`,{body:'Revised comment'},auth(f.owner.token),'PATCH');expect(edit.status).toBe(200)
  editId=(await env.DB.prepare('SELECT id FROM request_comment_edits').first<{id:string}>())!.id
  path=`/api/operator/comments/edits/${editId}/moderate`
 }
 expect((await call(path,{verdict:'rejected',reason:'Need more detail'},f.headers)).status).toBe(200)
 expect((await call(`/api/public/requests/${r.slug}/appeals`,{subjectType:kind,subjectId:editId,body:'Please reconsider'},auth(f.owner.token))).status).toBe(201)
 const appeal=(await env.DB.prepare('SELECT id FROM request_moderation_appeals').first<{id:string}>())!
 const review=`/api/operator/appeals/${appeal.id}/review`
 expect((await call(review,{resolution:'reopen',reason:'New context'})).status).toBe(401)
 expect((await call(review,{resolution:'reopen',reason:'New context'},f.headers)).status).toBe(200)
 expect((await call(review,{resolution:'dismiss',reason:'Second decision'},f.headers)).status).toBe(409)
 expect((await call(path,{verdict:'approved'},f.headers)).status).toBe(200)
 expect(await env.DB.prepare('SELECT state,reviewed_by_operator_id,resolution,resolution_reason FROM request_moderation_appeals').first()).toEqual({state:'reviewed',reviewed_by_operator_id:f.operator,resolution:'reopen',resolution_reason:'New context'})
 expect((await env.DB.prepare("SELECT * FROM audit_entries WHERE action='request.appeal_reviewed'").all()).results).toHaveLength(1)
})
it('[REQ-030] dismissal records a reason without reopening rejected content',async()=>{
 const f=await boardGraph(1),[r]=f.requests
 const comment=await call(`/api/public/requests/${r.slug}/comments`,{body:'Comment'},auth(f.owner.token));const {id}=await comment.json() as {id:string}
 await call(`/api/operator/comments/${id}/moderate`,{verdict:'rejected',reason:'Off topic'},f.headers)
 await call(`/api/public/requests/${r.slug}/appeals`,{subjectType:'comment',subjectId:id,body:'Reconsider'},auth(f.owner.token))
 const appeal=(await env.DB.prepare('SELECT id FROM request_moderation_appeals').first<{id:string}>())!
 expect((await call(`/api/operator/appeals/${appeal.id}/review`,{resolution:'dismiss',reason:'Still off topic'},f.headers)).status).toBe(200)
 expect(await env.DB.prepare('SELECT moderation_state FROM request_comments').first()).toEqual({moderation_state:'rejected'})
 await change(r.slug,'vote',f.owner.token)
})
