import { expect, it } from 'vitest'
import { RequestWriteRepository } from '../../../src/core/features/requests/write-repository'
import { auth, call, env, fixture, pauseBeforeBatch, person, publish, submit } from './requester-final-fixture'

for(const verdict of ['approved','rejected'] as const)
it(`[REQ-020 REQ-030] edit paused across first approval retains the publication and a separately ${verdict} revision`,async()=>{
  const f=await fixture(),owner=await person(),r=await submit(f.board,owner.token,'Initial private wording')
  const db=pauseBeforeBatch(()=>publish(r.slug,f.board,f.headers,'Approved snapshot'))
  const edit={title:'Pending new title',description:'Pending new description',proposedSolution:null,impactStatement:null}
  await new RequestWriteRepository({binding:db}).editOwnRequest({requesterId:owner.id,verifiedEmail:owner.email,displayName:'Owner'},r.slug,edit,new Date().toISOString())
  expect(await env.DB.prepare('SELECT moderation_state,public_title,title FROM requests WHERE slug=?').bind(r.slug).first()).toEqual({moderation_state:'approved',public_title:'Approved snapshot',title:'Initial private wording'})
  const visible=await call(`/api/public/requests/${r.slug}`)
  expect(visible.status).toBe(200)
  expect(await visible.text()).toContain('Approved snapshot')
  const pending=await env.DB.prepare("SELECT id,moderation_state FROM request_content_submissions WHERE is_initial=0").first<{id:string;moderation_state:string}>()
  expect(pending!.moderation_state).toBe('awaiting_review')
  const activity=await (await call('/api/public/requester/activity',undefined,auth(owner.token))).json()
  expect(activity).toMatchObject({requests:[{moderationState:'approved'}],edits:[{title:edit.title,moderationState:'awaiting_review'}]})
  const moderated=await call(`/api/operator/requests/edits/${pending!.id}/moderate`,{verdict,...(verdict==='rejected'?{reason:'Keep the approved wording'}:{})},f.headers)
  expect(moderated.status,await moderated.clone().text()).toBe(200)
  expect(await env.DB.prepare('SELECT moderation_state,public_title FROM requests WHERE slug=?').bind(r.slug).first()).toEqual({moderation_state:'approved',public_title:verdict==='approved'?edit.title:'Approved snapshot'})
})

it('[REQ-020] an edit before initial approval remains private, then the operator publishes explicit safe wording',async()=>{
  const f=await fixture(),owner=await person(),r=await submit(f.board,owner.token)
  expect((await call(`/api/public/requests/${r.slug}`,{title:'Revised private title',description:'Revised private description'},auth(owner.token),'PATCH')).status).toBe(200)
  expect((await call(`/api/public/requests/${r.slug}`)).status).toBe(404)
  expect(await env.DB.prepare('SELECT title,moderation_state FROM requests WHERE slug=?').bind(r.slug).first()).toEqual({title:'Revised private title',moderation_state:'awaiting_review'})
  await publish(r.slug,f.board,f.headers,'Explicit safe wording')
  expect((await call(`/api/public/requests/${r.slug}`)).status).toBe(200)
  expect((await env.DB.prepare("SELECT id FROM request_content_submissions WHERE moderation_state='awaiting_review'").all()).results).toEqual([])
})
