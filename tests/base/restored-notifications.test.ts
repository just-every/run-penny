import {applyD1Migrations,reset} from 'cloudflare:test'
import {afterEach,expect,inject,it,vi} from 'vitest'
import {env,owner} from './support'
import {graph,provider,runtime,start,time} from './notification-regression-fixture'
import {prepareBatches} from '../../src/core/features/notifications/batches'
import {drainNotifications} from '../../src/core/features/notifications/delivery'
import {exportArchive,restoreArchive} from '../../src/core/features/data/archive'
afterEach(()=>vi.restoreAllMocks())
it('[DATA-001 NOTIFY-002 REL-006] restored queued and unbatched consent-bearing history never sends; new native events still do',async()=>{
 await reset();const migrations=inject('migrations');await applyD1Migrations(env.DB,migrations)
 const g=await graph(2)
 await g.publish(0,'Old batched event');await prepareBatches(env.DB,time())
 await g.publish(1,'Old unbatched event')
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM notification_intents WHERE batch_id IS NULL').first('n')).toBe(1)
 const snapshot=await exportArchive(env.DB,env.FILES)
 expect(snapshot.archive.tables.notification_intents.every(row=>row.restoration_hold_at!==null)).toBe(true)
 expect(snapshot.archive.tables.notification_batches[0]).toMatchObject({state:'queued',failure_reason:'restored_delivery_review_required'})
 await reset();await applyD1Migrations(env.DB,migrations);await owner()
 const authority=(await env.DB.prepare('SELECT * FROM oa_operators ORDER BY id').all()).results
 expect((await restoreArchive(env.DB,env.FILES,snapshot.archive,snapshot.journal)).status).toBe('complete')
 const sent=provider()
 await drainNotifications(runtime(),()=>start+7200000);await drainNotifications(runtime(),()=>start+10800000)
 expect(sent).toHaveLength(0)
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM notification_batches').first('n')).toBe(1)
 expect(await env.DB.prepare('SELECT state,attempt_count FROM notification_batches').first()).toEqual({state:'unknown',attempt_count:0})
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM notification_intents WHERE batch_id IS NULL AND restoration_hold_at IS NOT NULL').first('n')).toBe(1)
 expect((await env.DB.prepare('SELECT * FROM oa_operators ORDER BY id').all()).results).toEqual(authority)
 await g.publish(1,'New explicitly published event',10800001)
 await drainNotifications(runtime(),()=>start+14400001)
 expect(sent).toHaveLength(1)
 const payload=JSON.stringify(sent)
 expect(payload).toContain('New explicitly published event')
 expect(payload).not.toContain('Old batched event');expect(payload).not.toContain('Old unbatched event')
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})
it('[DATA-001 NOTIFY-002] a new native intent cannot join the restored batch even inside its original open window',async()=>{
 await reset();const migrations=inject('migrations');await applyD1Migrations(env.DB,migrations)
 const g=await graph();await g.publish(0,'Old window event');await prepareBatches(env.DB,time())
 const snapshot=await exportArchive(env.DB,env.FILES),oldBatch=String(snapshot.archive.tables.notification_batches[0].id)
 await reset();await applyD1Migrations(env.DB,migrations);await owner();await restoreArchive(env.DB,env.FILES,snapshot.archive,snapshot.journal)
 await g.publish(0,'New event inside the old window',1);await prepareBatches(env.DB,time(2))
 const intents=(await env.DB.prepare('SELECT batch_id,restoration_hold_at FROM notification_intents ORDER BY created_at').all()).results
 expect(intents).toHaveLength(2);expect(intents[0]).toMatchObject({batch_id:oldBatch,restoration_hold_at:expect.any(String)})
 expect(intents[1].batch_id).not.toBe(oldBatch);expect(intents[1].restoration_hold_at).toBeNull()
 const sent=provider();await drainNotifications(runtime(),()=>start+7200000)
 expect(sent).toHaveLength(1);expect(JSON.stringify(sent)).toContain('New event inside the old window');expect(JSON.stringify(sent)).not.toContain('Old window event')
})
