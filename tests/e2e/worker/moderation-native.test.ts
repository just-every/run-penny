import { expect,it } from 'vitest'
import { moderateNativeRequest } from '../../../src/core/features/requests/native-moderation'
import type { PennyRuntime } from '../../../src/core/app/runtime'
import { call,env,moderationFixture,pauseBeforeBatch,repairDatabase,subjectEvents } from './moderation-winner-fixture'
repairDatabase()
for(const nativeFirst of [true,false])for(const winner of ['approved','rejected'] as const)
it(`[REQ-003 REQ-030] ${nativeFirst?'native':'request'} route wins ${winner} against the other moderation entrypoint`,async()=>{
  const f=await moderationFixture('request'),loser=winner==='approved'?'rejected':'approved'
  const nativeInput=(verdict:'approved'|'rejected')=>({verdict,...(verdict==='rejected'?{reason:'Native rejection'}:{title:'Native safe title',description:'Native safe description',boardSlug:f.board,displayName:'Native safe name'})})
  const db=pauseBeforeBatch(async()=>{
    const response=nativeFirst?await call(`/api/operator/moderation/${f.r.slug}`,nativeInput(winner),f.headers):await call(f.path,f.input(winner),f.headers)
    expect(response.status).toBe(200)
  })
  if(nativeFirst)await expect(f.decide(db,loser)).rejects.toMatchObject({code:'moderation_conflict',status:409})
  else await expect(moderateNativeRequest({database:{binding:db}} as PennyRuntime,f.operator,f.r.slug,nativeInput(loser))).rejects.toMatchObject({code:'moderation_conflict',status:409})
  expect(await subjectEvents(f)).toEqual([{verdict:winner,request_id:f.r.id}])
  expect((await env.DB.prepare('SELECT id FROM native_moderation_events WHERE request_id=?').bind(f.r.id).all()).results).toHaveLength(nativeFirst?1:0)
  expect((await env.DB.prepare("SELECT id FROM audit_entries WHERE entity_id=? AND action='request.moderated'").bind(f.r.id).all()).results).toHaveLength(1)
  expect((await env.DB.prepare("SELECT requester_id FROM notification_outbox WHERE subject_id=? AND event_type='moderation_rejected'").bind(f.id).all()).results).toEqual(!nativeFirst&&winner==='rejected'?[{requester_id:f.owner.id}]:[])
  const response=await call(`/api/public/requests/${f.r.slug}`)
  expect(response.status).toBe(winner==='approved'?200:404)
  if(winner==='approved')expect(await response.text()).toContain(nativeFirst?'Native safe title':'Winning original request')
})
