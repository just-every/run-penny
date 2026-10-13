import { expect, it } from 'vitest'
import { auth, boardGraph, call, change, env, merge, person, publish, submit, unmerge } from './requester-repair-fixture'

for (const state of ['unpublished', 'rejected', 'internal', 'withdrawn', 'blocked'] as const)
it(`[REQ-005 REQ-019 REQ-025] ${state} canonical activity retains known origins without revealing new identifiers`, async () => {
  const f = await boardGraph(2), [a, b] = f.requests, actor = await person(), targetOwner = await person()
  const target = await submit(f.board, targetOwner.token, 'Never disclosed target')
  const targetId = (await env.DB.prepare('SELECT id FROM requests WHERE slug=?').bind(target.slug).first<{id:string}>())!.id
  await change(a.slug, 'vote', actor.token, {emailUpdates:true})
  await change(b.slug, 'vote', actor.token)
  const commentResponse = await call(`/api/public/requests/${a.slug}/comments`, {body:'My known comment'}, auth(actor.token))
  expect(commentResponse.status).toBe(201)
  const comment = await commentResponse.json() as {id:string}
  expect((await call(`/api/public/comments/${comment.id}`, {body:'My held edit'}, auth(actor.token), 'PATCH')).status).toBe(200)
  if (state !== 'unpublished') await publish(target.slug, f.board, f.headers)
  await merge(a.slug, b.slug, f.headers)
  await merge(b.slug, target.slug, f.headers)
  if (state === 'rejected') await env.DB.prepare("UPDATE requests SET moderation_state='rejected' WHERE id=?").bind(targetId).run()
  if (state === 'internal') await env.DB.prepare("UPDATE boards SET visibility='internal'").run()
  if (state === 'withdrawn') await env.DB.prepare("UPDATE requests SET withdrawn_at=?,public_state='withdrawn' WHERE id=?").bind(new Date().toISOString(), targetId).run()
  if (state === 'blocked') await env.DB.prepare('UPDATE requesters SET blocked_at=? WHERE id=?').bind(new Date().toISOString(), targetOwner.id).run()
  const response = await call('/api/public/requester/activity', undefined, auth(actor.token))
  expect(response.status).toBe(200)
  const text = await response.text(), activity = JSON.parse(text)
  expect(text).not.toContain(target.slug)
  expect(text).not.toContain(targetId)
  expect(text).not.toContain('Never disclosed target')
  expect(activity.votes.map((v:{slug:string}) => v.slug).sort()).toEqual([a.slug,b.slug].sort())
  expect(activity.votes.every((v:{available:number}) => v.available === 0)).toBe(true)
  expect(activity.follows).toEqual([{slug:a.slug,mutedAt:null,available:0}])
  expect(activity.comments).toMatchObject([{id:comment.id,requestId:a.id,slug:a.slug,body:'My known comment',available:0}])
  expect(activity.commentEdits).toMatchObject([{slug:a.slug,body:'My held edit',moderationState:'awaiting_review',available:0}])
  expect((await call(`/api/public/requests/${target.slug}`)).status).toBe(state === 'withdrawn' ? 410 : 404)
})

it('[REQ-008 REQ-009 REQ-025] published canonical activity collapses votes then restores original context through reversals', async () => {
  const f = await boardGraph(3), [a,b,c] = f.requests, actor = await person()
  for (const r of [a,b]) await change(r.slug,'vote',actor.token)
  const response = await call(`/api/public/requests/${a.slug}/comments`, {body:'Original discussion'}, auth(actor.token))
  const comment = await response.json() as {id:string}
  await call(`/api/public/comments/${comment.id}`, {body:'Original edit'}, auth(actor.token), 'PATCH')
  await merge(a.slug,b.slug,f.headers); await merge(b.slug,c.slug,f.headers)
  const activity = async () => (await call('/api/public/requester/activity',undefined,auth(actor.token))).json() as Promise<{votes:{slug:string;available:number}[];comments:{slug:string;requestId:string}[];commentEdits:{slug:string}[]}>
  expect((await activity()).votes).toEqual([{slug:c.slug,available:1}])
  expect((await activity()).comments).toMatchObject([{slug:c.slug,requestId:c.id}])
  expect((await activity()).commentEdits).toMatchObject([{slug:c.slug}])
  await unmerge(a.slug,f.headers)
  expect((await activity()).votes.map(v=>v.slug).sort()).toEqual([a.slug,c.slug].sort())
  expect((await activity()).comments).toMatchObject([{slug:a.slug,requestId:a.id}])
  await unmerge(b.slug,f.headers)
  expect((await activity()).votes.map(v=>v.slug).sort()).toEqual([a.slug,b.slug].sort())
})

it('[REQ-025 REQ-030] known original comment context still supports edits and appeals after a private merge', async () => {
  const f=await boardGraph(1),[a]=f.requests,actor=await person(),stranger=await person()
  const target=await submit(f.board,f.owner.token)
  const comment=await (await call(`/api/public/requests/${a.slug}/comments`,{body:'My comment'},auth(actor.token))).json() as {id:string}
  await merge(a.slug,target.slug,f.headers)
  expect((await call(`/api/operator/comments/${comment.id}/moderate`,{verdict:'rejected',reason:'Please clarify'},f.headers)).status).toBe(200)
  const appeal={subjectType:'comment',subjectId:comment.id,body:'More context'}
  expect((await call(`/api/public/requests/${a.slug}/appeals`,appeal,auth(stranger.token))).status).toBe(404)
  expect((await call(`/api/public/requests/${a.slug}/appeals`,appeal,auth(actor.token))).status).toBe(201)
  const row=await env.DB.prepare('SELECT a.id,r.slug FROM request_moderation_appeals a JOIN requests r ON r.id=a.request_id').first<{id:string;slug:string}>()
  expect(row!.slug).toBe(target.slug)
  expect((await call(`/api/operator/appeals/${row!.id}/review`,{resolution:'reopen',reason:'Review the explanation'},f.headers)).status).toBe(200)
  expect((await call(`/api/public/comments/${comment.id}`,{body:'Clearer comment'},auth(actor.token),'PATCH')).status).toBe(200)
  const edit=await env.DB.prepare('SELECT id FROM request_comment_edits WHERE comment_id=?').bind(comment.id).first<{id:string}>()
  expect((await call(`/api/operator/comments/edits/${edit!.id}/moderate`,{verdict:'rejected',reason:'Try again'},f.headers)).status).toBe(200)
  expect((await call(`/api/public/requests/${a.slug}/appeals`,{subjectType:'comment_edit',subjectId:edit!.id,body:'Revision context'},auth(actor.token))).status).toBe(201)
  const text=await (await call('/api/public/requester/activity',undefined,auth(actor.token))).text()
  expect(text).toContain('Clearer comment')
  expect(text).not.toContain(target.slug)
})
