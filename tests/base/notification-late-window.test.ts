import { applyD1Migrations, reset } from 'cloudflare:test'
import { beforeEach, afterEach, expect, inject, it, vi } from 'vitest'
import { env } from './support'
import { drainNotifications } from '@/core/features/notifications/delivery'
import { prepareBatches } from '@/core/features/notifications/batches'
import { graph, provider, rows, runtime, start, time } from './notification-regression-fixture'

beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
afterEach(()=>vi.restoreAllMocks())
it('[NOTIFY-001/002/005] late committed events open one new durable window and cannot starve another request or replay accepted events',async()=>{
 const g=await graph(2)
 await g.publish(0,'Already accepted',0)
 const sent=provider()
 await drainNotifications(runtime(),()=>start+3600000)
 expect(sent).toHaveLength(1)
 const accepted=(await rows('notification_batches'))[0]
 expect(accepted).toMatchObject({state:'accepted',window_start:time(),window_end:time(3600000)})
 // These publications commit after provider acceptance but carry earlier queue times.
 await g.publish(0,'Committed late one',30000)
 await g.publish(0,'Committed late two',60000)
 await g.publish(1,'Independent due request',120000)
 const reopenedAt=3600000+120000
 await Promise.all([prepareBatches(env.DB,time(reopenedAt)),prepareBatches(env.DB,time(reopenedAt))])
 const batches=await rows('notification_batches')
 expect(batches).toHaveLength(3)
 expect(batches.find(batch=>batch.id===accepted.id)).toEqual(accepted)
 const reopened=batches.find(batch=>batch.request_id===g.requests[0].id && batch.id!==accepted.id)!
 expect(reopened).toMatchObject({state:'queued',window_start:time(reopenedAt),window_end:time(reopenedAt+3600000)})
 const intents=await rows('notification_intents')
 expect(intents.every(intent=>intent.batch_id!==null)).toBe(true)
 expect(intents.filter(intent=>intent.batch_id===reopened.id)).toHaveLength(2)
 expect(intents.filter(intent=>intent.batch_id===reopened.id).map(intent=>intent.created_at).sort()).toEqual([time(30000),time(60000)])
 await Promise.all([drainNotifications(runtime(),()=>start+reopenedAt),drainNotifications(runtime(),()=>start+reopenedAt)])
 expect(sent).toHaveLength(2);expect(JSON.stringify(sent[1])).toContain('Independent due request')
 await drainNotifications(runtime(),()=>start+reopenedAt+3599999)
 expect(sent).toHaveLength(2)
 await Promise.all([drainNotifications(runtime(),()=>start+reopenedAt+3600000),drainNotifications(runtime(),()=>start+reopenedAt+3600000)])
 expect(sent).toHaveLength(3)
 expect(JSON.stringify(sent[2])).toContain('Committed late one');expect(JSON.stringify(sent[2])).toContain('Committed late two')
 expect(JSON.stringify(sent[2])).not.toContain('Already accepted')
 await drainNotifications(runtime(),()=>start+reopenedAt+7200000)
 expect(sent).toHaveLength(3);expect(await rows('notification_attempts')).toHaveLength(3)
})
it('[NOTIFY-002/005] a rejected provider attempt also seals its payload against late publications',async()=>{
 const g=await graph()
 await g.publish(0,'Original rejected payload')
 const rejected=provider(429)
 await drainNotifications(runtime(),()=>start+3600000)
 expect(rejected).toHaveLength(1)
 const original=(await rows('notification_batches'))[0]
 await g.publish(0,'Late separate payload',1000)
 await prepareBatches(env.DB,time(3600010))
 expect(await rows('notification_batches')).toHaveLength(2)
 const sent=provider()
 await drainNotifications(runtime(),()=>start+3660000)
 expect(sent).toHaveLength(1);expect(JSON.stringify(sent[0])).toContain('Original rejected payload');expect(JSON.stringify(sent[0])).not.toContain('Late separate payload')
 expect((await rows('notification_batches')).find(batch=>batch.id===original.id)).toMatchObject({state:'accepted',window_end:original.window_end})
 await drainNotifications(runtime(),()=>start+7200010)
 expect(sent).toHaveLength(2);expect(JSON.stringify(sent[1])).toContain('Late separate payload')
})
