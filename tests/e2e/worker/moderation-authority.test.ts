import { expect,it } from 'vitest'
import { eraseEntity,planErasure } from '../../../src/core/features/data/archive'
import { moderateNativeRequest } from '../../../src/core/features/requests/native-moderation'
import { reviewAppeal } from '../../../src/core/features/requests/appeal-review'
import type { PennyRuntime } from '../../../src/core/app/runtime'
import { auth,call,env,moderationFixture,pauseBeforeBatch,person,publish,repairDatabase,subjectEvents,subjects,submit } from './moderation-winner-fixture'
repairDatabase()
for(const type of subjects)for(const boundary of ['withdrawal','erasure','retirement','block','request_merge'] as const)
it(`[REQ-021 REQ-024 DATA-003] ${type} refuses a verdict paused across ${boundary}`,async()=>{
  const f=await moderationFixture(type)
  if(type==='attachment'&&boundary==='request_merge')expect((await call(f.path,f.input('approved'),f.headers)).status).toBe(200)
  const before=await subjectEvents(f)
  let survivorId='',targetId=''
  const db=pauseBeforeBatch(async()=>{
    if(boundary==='withdrawal')expect((await call(`/api/public/requests/${f.r.slug}/withdraw`,{},auth(f.owner.token))).status).toBe(204)
    if(boundary==='erasure'){
      const plan=await planErasure(env.DB,'requests',f.r.id)
      expect((await eraseEntity(env.DB,env.FILES,'requests',f.r.id,plan.planHash)).status).toBe('complete')
    }
    if(boundary==='retirement'){
      const survivor=await person();survivorId=survivor.id
      expect((await call(`/api/operator/requesters/${f.owner.id}/merge`,{targetRequesterId:survivor.id},f.headers)).status).toBe(200)
    }
    if(boundary==='block')expect((await call(`/api/operator/requesters/${f.owner.id}/block`,{},f.headers)).status).toBe(200)
    if(boundary==='request_merge'){
      const target=await submit(f.board,f.owner.token,'Target original');await publish(target.slug,f.board,f.headers,'Target public')
      targetId=(await env.DB.prepare('SELECT id FROM requests WHERE slug=?').bind(target.slug).first<{id:string}>())!.id
      expect((await call(`/api/operator/requests/${f.r.slug}/merge`,{targetSlug:target.slug},f.headers)).status).toBe(200)
    }
  })
  await expect(f.decide(db,'rejected')).rejects.toMatchObject({code:type.endsWith('_edit')?'not_found':'moderation_conflict'})
  const events=await subjectEvents(f)
  expect(events).toEqual(boundary==='erasure'?[]:before)
  expect((await env.DB.prepare("SELECT id FROM notification_outbox WHERE subject_id=? AND event_type='moderation_rejected'").bind(f.id).all()).results).toEqual([])
  if(boundary==='retirement'||(boundary==='request_merge'&&(type==='comment'||type==='comment_edit'||type==='attachment'))){
    expect((await call(f.path,f.input('rejected'),f.headers)).status).toBe(200)
    const current=await subjectEvents(f)
    expect(current.at(-1)).toEqual({verdict:'rejected',request_id:boundary==='retirement'?f.r.id:targetId})
    expect((await env.DB.prepare("SELECT requester_id FROM notification_outbox WHERE subject_id=? AND event_type='moderation_rejected'").bind(f.id).all()).results).toEqual(type==='attachment'?[]:[{requester_id:survivorId||f.owner.id}])
  }else expect((await call(f.path,f.input('rejected'),f.headers)).status).toBe(404)
})
for(const boundary of ['withdrawal','erasure','retirement','request_merge'] as const)
it(`[REQ-003 REQ-030] native first moderation refuses stale ${boundary} context`,async()=>{
  const f=await moderationFixture('request')
  const db=pauseBeforeBatch(async()=>{
    if(boundary==='withdrawal')expect((await call(`/api/public/requests/${f.r.slug}/withdraw`,{},auth(f.owner.token))).status).toBe(204)
    else if(boundary==='erasure'){
      const plan=await planErasure(env.DB,'requests',f.r.id);expect((await eraseEntity(env.DB,env.FILES,'requests',f.r.id,plan.planHash)).status).toBe('complete')
    }else if(boundary==='retirement'){
      const target=await person();expect((await call(`/api/operator/requesters/${f.owner.id}/merge`,{targetRequesterId:target.id},f.headers)).status).toBe(200)
    }else{
      const target=await submit(f.board,f.owner.token);await publish(target.slug,f.board,f.headers)
      expect((await call(`/api/operator/requests/${f.r.slug}/merge`,{targetSlug:target.slug},f.headers)).status).toBe(200)
    }
  })
  await expect(moderateNativeRequest({database:{binding:db}} as PennyRuntime,f.operator,f.r.slug,{verdict:'approved',title:'Safe selected text',description:'Safe details',boardSlug:f.board,displayName:'Safe name'})).rejects.toMatchObject({code:'moderation_conflict',status:409})
  expect(await subjectEvents(f)).toEqual([])
  expect((await env.DB.prepare('SELECT id FROM native_moderation_events WHERE request_id=?').bind(f.r.id).all()).results).toEqual([])
})
for(const boundary of ['withdrawal','erasure','retirement','request_merge'] as const)
it(`[REQ-030] appeal reopening refuses stale ${boundary} and cannot revive the old selection`,async()=>{
  const f=await moderationFixture('comment_edit')
  expect((await call(f.path,f.input('rejected'),f.headers)).status).toBe(200)
  expect((await call(`/api/public/requests/${f.r.slug}/appeals`,{subjectType:f.type,subjectId:f.id,body:'Please reconsider'},auth(f.owner.token))).status).toBe(201)
  const appeal=(await env.DB.prepare('SELECT id FROM request_moderation_appeals').first<{id:string}>())!
  const db=pauseBeforeBatch(async()=>{
    if(boundary==='withdrawal')expect((await call(`/api/public/requests/${f.r.slug}/withdraw`,{},auth(f.owner.token))).status).toBe(204)
    else if(boundary==='erasure'){
      const plan=await planErasure(env.DB,'requests',f.r.id);expect((await eraseEntity(env.DB,env.FILES,'requests',f.r.id,plan.planHash)).status).toBe('complete')
    }else if(boundary==='retirement'){
      const target=await person();expect((await call(`/api/operator/requesters/${f.owner.id}/merge`,{targetRequesterId:target.id},f.headers)).status).toBe(200)
    }else{
      const target=await submit(f.board,f.owner.token);await publish(target.slug,f.board,f.headers)
      expect((await call(`/api/operator/requests/${f.r.slug}/merge`,{targetSlug:target.slug},f.headers)).status).toBe(200)
    }
  })
  await expect(reviewAppeal({binding:db},appeal.id,f.operator,'reopen','New context',new Date().toISOString())).rejects.toMatchObject({code:'appeal_not_open',status:409})
  expect(await env.DB.prepare('SELECT state,resolution FROM request_moderation_appeals WHERE id=?').bind(appeal.id).first()).toEqual(boundary==='erasure'?null:{state:'open',resolution:null})
  expect(await env.DB.prepare('SELECT moderation_state FROM request_comment_edits WHERE id=?').bind(f.id).first()).toEqual(boundary==='erasure'?null:{moderation_state:'rejected'})
  expect((await env.DB.prepare("SELECT id FROM audit_entries WHERE action='request.appeal_reviewed'").all()).results).toEqual([])
})

it('[REQ-029 REQ-005] operator-authored approved draft still requires and accepts its first explicit publication',async()=>{
  const f=await moderationFixture('request')
  // Actual operator route creates an approved, unpublished operator-owned draft.
  const created=await call('/api/operator/requests',{title:'Operator draft',description:'Private operator evidence',boardSlug:f.board,evidenceIds:[]},f.headers)
  expect(created.status).toBe(201)
  const row=await created.json() as {slug:string}
  expect((await call(`/api/public/requests/${row.slug}`)).status).toBe(404)
  const path=`/api/operator/requests/${row.slug}/moderate`
  expect((await call(path,{verdict:'approved',title:'Public operator title',description:'Public operator details'},f.headers)).status).toBe(200)
  const detail=await call(`/api/public/requests/${row.slug}`);expect(detail.status).toBe(200);expect(await detail.text()).toContain('Public operator title')
  expect((await call(path,{verdict:'approved'},f.headers)).status).toBe(409)
})
