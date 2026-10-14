import { applyD1Migrations, reset } from 'cloudflare:test'
import { beforeEach, afterEach, expect, inject, it, vi } from 'vitest'
import { call, env } from './support'
import { drainNotifications } from '@/core/features/notifications/delivery'
import { graph, provider, rows, runtime } from './notification-regression-fixture'

beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers()})
async function counts(expected:number){
 for(const table of ['request_status_updates','notification_events','notification_intents'])expect(await rows(table),table).toHaveLength(expected)
 // The follower's intent carries the delivery; no legacy outbox row is written, so none can stay queued.
 expect(await rows('notification_outbox')).toHaveLength(0)
}
it('[REQ-015 NOTIFY-001/005] concurrent and later keyed HTTP replay retains one version, event, intent and provider delivery',async()=>{
 // Native session admission uses SQLite's real clock, so freeze relative to today.
 const start=Date.now()
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(start)
 const g=await graph(),path=`/api/operator/requests/${g.requests[0].slug}/status-updates`
 const input={status:'under_review',body:'Published once',pinned:true,idempotencyKey:crypto.randomUUID()}
 const responses=await Promise.all([call(path,input,g.operator),call(path,input,g.operator)])
 expect(responses.map(response=>response.status)).toEqual([200,200]);await counts(1)
 expect((await call(path,input,g.operator)).status).toBe(200);await counts(1)
 const sent=provider()
 await Promise.all([drainNotifications(runtime(),()=>start+3600000),drainNotifications(runtime(),()=>start+3600000)])
 expect(sent).toHaveLength(1)
 expect((await call(path,input,g.operator)).status).toBe(200)
 await drainNotifications(runtime(),()=>start+7200000)
 expect(sent).toHaveLength(1);expect(await rows('notification_attempts')).toHaveLength(1)
 const frozen=await rows('request_status_updates')
 for(const change of [{body:'Different wording'},{status:'open'},{pinned:false}]){
  const conflict=await call(path,{...input,...change},g.operator)
  expect(conflict.status).toBe(409);expect(await conflict.json()).toEqual({error:'idempotency_conflict'})
 }
 expect(await rows('request_status_updates')).toEqual(frozen);await counts(1)
 // A genuine later action can publish the same content under a fresh key.
 expect((await call(path,{...input,idempotencyKey:crypto.randomUUID()},g.operator)).status).toBe(200)
 await counts(2)
 expect((await rows('request_status_updates')).map(row=>row.publication_version).sort()).toEqual([1,2])
 expect((await call(path,{...input,status:'open',body:'Later decision',idempotencyKey:crypto.randomUUID()},g.operator)).status).toBe(200)
 expect((await call(path,input,g.operator)).status).toBe(200);await counts(3)
 expect(await env.DB.prepare('SELECT public_state FROM requests WHERE id=?').bind(g.requests[0].id).first()).toEqual({public_state:'open'})
})
it('[REQ-015 NOTIFY-001] concurrent reuse of a key for differing publications has one winner and one conflict',async()=>{
 const g=await graph(),path=`/api/operator/requests/${g.requests[0].slug}/status-updates`,idempotencyKey=crypto.randomUUID()
 const responses=await Promise.all(['One wording','Other wording'].map(body=>call(path,{status:'under_review',body,pinned:false,idempotencyKey},g.operator)))
 expect(responses.map(response=>response.status).sort()).toEqual([200,409]);await counts(1)
 const winner=(await rows('request_status_updates'))[0]
 expect((await rows('notification_events'))[0].body).toBe(winner.body)
})
it('[REQ-015 NOTIFY-001] unkeyed exact HTTP retries are idempotent while later changed projections and returns create versions',async()=>{
 const g=await graph(),path=`/api/operator/requests/${g.requests[0].slug}/status-updates`
 const input={status:'under_review',body:'Same public wording',pinned:false}
 expect((await call(path,input,g.operator)).status).toBe(200)
 expect((await call(path,input,g.operator)).status).toBe(200)
 const responses=await Promise.all([call(path,input,g.operator),call(path,input,g.operator)])
 expect(responses.map(response=>response.status)).toEqual([200,200]);await counts(1)
 expect((await call(path,{...input,status:'open'},g.operator)).status).toBe(200)
 expect((await call(path,input,g.operator)).status).toBe(200);await counts(3)
 expect((await call(path,{...input,pinned:true},g.operator)).status).toBe(200);await counts(4)
 expect((await call(path,{...input,pinned:true,body:'Revised wording'},g.operator)).status).toBe(200);await counts(5)
 expect((await call(path,{status:'declined',body:'Public reason',pinned:false},g.operator)).status).toBe(200)
 expect((await call(`/api/operator/requests/${g.requests[0].slug}/decline/reverse`,{},g.operator)).status).toBe(200)
 expect((await call(path,{status:'declined',body:'Public reason',pinned:false},g.operator)).status).toBe(200);await counts(7)
})
