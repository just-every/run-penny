import { expect } from 'vitest'
import { RequestOperatorRepository } from '../../../src/core/features/requests/operator-repository'
import { RequestAttachmentService } from '../../../src/core/features/requests/attachment-service'
import { createBlobStore } from '../../../src/core/platform/blobs'
import { auth, boardGraph, call, env, fixture, person, submit } from './requester-final-fixture'
export * from './requester-final-fixture'
export type Subject = 'request'|'comment'|'request_edit'|'comment_edit'|'attachment'
export type Verdict = 'approved'|'rejected'
export const subjects:Subject[]=['request','comment','request_edit','comment_edit','attachment']
export async function moderationFixture(type:Subject) {
  const f=type==='request'?await (async()=>{
    const base=await fixture(),owner=await person(),r=await submit(base.board,owner.token,'Original private request')
    const {id}=(await env.DB.prepare('SELECT id FROM requests WHERE slug=?').bind(r.slug).first<{id:string}>())!
    return {...base,owner,requests:[{...r,id}]}
  })():await boardGraph(1)
  const r=f.requests[0];let id=r.id,commentId=''
  if(type==='comment'||type==='comment_edit'){
    const response=await call(`/api/public/requests/${r.slug}/comments`,{body:'Approved original comment'},auth(f.owner.token))
    expect(response.status).toBe(201);commentId=(await response.json() as {id:string}).id;id=commentId
    if(type==='comment_edit'){
      expect((await call(`/api/operator/comments/${id}/moderate`,{verdict:'approved',publicAuthorDisplayName:'Public author'},f.headers)).status).toBe(200)
      expect((await call(`/api/public/comments/${id}`,{body:'Winning revision'},auth(f.owner.token),'PATCH')).status).toBe(200)
      id=(await env.DB.prepare('SELECT id FROM request_comment_edits WHERE comment_id=?').bind(commentId).first<{id:string}>())!.id
    }
  }else if(type==='request_edit'){
    expect((await call(`/api/public/requests/${r.slug}`,{title:'Winning revision',description:'Winning revised description'},auth(f.owner.token),'PATCH')).status).toBe(200)
    id=(await env.DB.prepare('SELECT id FROM request_content_submissions WHERE request_id=? AND is_initial=0').bind(r.id).first<{id:string}>())!.id
  }else if(type==='attachment'){
    id=(await new RequestAttachmentService({binding:env.DB},createBlobStore(env.FILES)).upload({requesterId:f.owner.id,verifiedEmail:f.owner.email,displayName:'Owner'},r.slug,new File(['Original attachment bytes'],'proof.pdf',{type:'application/pdf'}),new Date().toISOString())).id
  }
  const path=type==='request'?`/api/operator/requests/${r.slug}/moderate`:type==='comment'?`/api/operator/comments/${id}/moderate`:type==='request_edit'?`/api/operator/requests/edits/${id}/moderate`:type==='comment_edit'?`/api/operator/comments/edits/${id}/moderate`:`/api/operator/attachments/${id}/moderate`
  function input(verdict:Verdict) {return {verdict,reason:verdict==='rejected'?'Keep the approved original':undefined,notifyAuthor:true,...(type==='request'?{title:'Winning original request',description:'Winning original description',publicAuthorDisplayName:'Public author',boardSlug:f.board}:type==='comment'?{publicAuthorDisplayName:'Public author'}:{})}}
  function decide(db:D1Database,verdict:Verdict) {
    const repo=new RequestOperatorRepository({binding:db}),args={...input(verdict),operatorId:f.operator,now:new Date().toISOString()}
    if(type==='request')return repo.moderateRequest({...args,slug:r.slug})
    if(type==='comment')return repo.moderateComment({...args,commentId:id})
    if(type==='comment_edit')return repo.moderateCommentEdit({...args,editId:id})
    if(type==='request_edit')return repo.moderateRequestEdit({...args,editId:id})
    return repo.moderateAttachment({...args,attachmentId:id})
  }
  const table=type==='request'?'requests':type==='comment'?'request_comments':type==='request_edit'?'request_content_submissions':type==='comment_edit'?'request_comment_edits':'attachments'
  return {...f,r,id,type,commentId,path,input,decide,table}
}
export async function subjectEvents(f:Awaited<ReturnType<typeof moderationFixture>>) {
  return (await env.DB.prepare('SELECT verdict,request_id FROM request_moderation_events WHERE subject_type=? AND subject_id=? ORDER BY rowid').bind(f.type,f.id).all()).results
}
export async function assertWinner(f:Awaited<ReturnType<typeof moderationFixture>>,winner:Verdict) {
  expect(await subjectEvents(f)).toEqual([{verdict:winner,request_id:f.r.id}])
  expect(await env.DB.prepare(`SELECT ${f.type==='attachment'?'public_state':'moderation_state'} AS state FROM ${f.table} WHERE id=?`).bind(f.id).first()).toEqual({state:f.type==='attachment'&&winner==='approved'?'published':winner})
  const notices=(await env.DB.prepare("SELECT requester_id FROM notification_outbox WHERE subject_id=? AND event_type='moderation_rejected'").bind(f.id).all()).results
  expect(notices).toEqual(winner==='rejected'&&f.type!=='attachment'?[{requester_id:f.owner.id}]:[])
  const audits=(await env.DB.prepare("SELECT id FROM audit_entries WHERE entity_type=? AND entity_id=? AND action='request.moderated'").bind(f.type,f.id).all()).results
  expect(audits).toHaveLength(1)
  if(f.type==='attachment'){
    const file=await call(`/api/public/attachments/${f.id}`)
    expect(file.status).toBe(winner==='approved'?200:404)
    if(winner==='approved')expect(await file.text()).toBe('Original attachment bytes')
  }else{
    const response=await call(`/api/public/requests/${f.r.slug}`)
    if(f.type==='request'){expect(response.status).toBe(winner==='approved'?200:404);if(winner==='approved')expect(await response.text()).toContain('Winning original request')}
    else{
      expect(response.status).toBe(200)
      const detail=await response.json() as {title:string;comments:{id:string;body:string}[]}
      if(f.type==='request_edit')expect(detail.title).toBe(winner==='approved'?'Winning revision':'Public 0')
      else if(f.type==='comment_edit')expect(detail.comments.find(c=>c.id===f.commentId)?.body).toBe(winner==='approved'?'Winning revision':'Approved original comment')
      else expect(detail.comments.map(c=>c.id)).toEqual(winner==='approved'?[f.id]:[])
    }
  }
}
