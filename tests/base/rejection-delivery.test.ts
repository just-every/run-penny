import {applyD1Migrations,reset} from 'cloudflare:test'
import {beforeEach,afterEach,expect,inject,it,vi} from 'vitest'
import {env,mockMail} from './support'
import {drainRejectionNotices} from '@/core/features/notifications/rejection-delivery'
import {rejectionFixture,rejectionRows,rejectionRuntime,rejectionTime,captureRejections} from './rejection-fixture'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'));mockMail()})
afterEach(()=>vi.restoreAllMocks())
it('[REQ-030 REL-006] concurrent drains have one durable effect, accepted receipts never replay',async()=>{
 const g=await rejectionFixture();expect((await g.reject()).status).toBe(200)
 const sent=captureRejections()
 await Promise.all([drainRejectionNotices(rejectionRuntime(),()=>rejectionTime),drainRejectionNotices(rejectionRuntime(),()=>rejectionTime)])
 await drainRejectionNotices(rejectionRuntime(),()=>rejectionTime+3600000)
 expect(sent).toHaveLength(1);expect(await rejectionRows()).toMatchObject([{state:'accepted',attempts:1}])
 expect(sent[0]).toMatchObject({personalizations:[{to:[{email:g.email}]}]})
})
it('[REQ-030 REL-006] definitive rejection retries boundedly and ambiguous acceptance never replays',async()=>{
 const g=await rejectionFixture();expect((await g.reject()).status).toBe(200)
 const sent=captureRejections(429);let clock=rejectionTime
 for(let attempt=0;attempt<6;attempt++){
  await drainRejectionNotices(rejectionRuntime(),()=>clock);expect(sent).toHaveLength(attempt+1)
  clock+=60000*2**attempt
 }
 expect(await rejectionRows()).toMatchObject([{state:'failed',attempts:6}])
 await drainRejectionNotices(rejectionRuntime(),()=>clock);expect(sent).toHaveLength(6)
 mockMail();const another=await rejectionFixture({operator:g.operator});expect((await another.reject()).status).toBe(200)
 const unknown=captureRejections(503)
 await drainRejectionNotices(rejectionRuntime(),()=>rejectionTime)
 await drainRejectionNotices(rejectionRuntime(),()=>rejectionTime+3600000)
 expect(unknown).toHaveLength(1);expect((await rejectionRows()).find(row=>row.state==='unknown')).toBeDefined()
})
it('[REQ-030 REL-006 BASE-OPS-005] interrupted and receipt-write failure stay unknown with audit and never resend',async()=>{
 const g=await rejectionFixture();expect((await g.reject()).status).toBe(200)
 // A real storage fault after provider acceptance must not reset durable ownership.
 await env.DB.exec(`CREATE TRIGGER fail_rejection_receipt BEFORE UPDATE OF state ON notification_outbox_attempts WHEN NEW.state='accepted' BEGIN SELECT RAISE(ABORT,'fixture_receipt_failure'); END`)
 const sent=captureRejections();await drainRejectionNotices(rejectionRuntime(),()=>rejectionTime)
 expect(sent).toHaveLength(1);expect(await rejectionRows()).toMatchObject([{state:'unknown'}])
 await env.DB.exec('DROP TRIGGER fail_rejection_receipt')
 await drainRejectionNotices(rejectionRuntime(),()=>rejectionTime+3600000);expect(sent).toHaveLength(1)
 mockMail();const another=await rejectionFixture({operator:g.operator});expect((await another.reject()).status).toBe(200)
 const row=(await rejectionRows()).find(row=>row.state==='queued')!,at=new Date(rejectionTime-600000).toISOString()
 await env.DB.batch([
  env.DB.prepare("UPDATE notification_outbox SET claim_id='interrupted-fixture' WHERE id=?").bind(row.id),
  env.DB.prepare("INSERT INTO notification_outbox_attempts(id,outbox_id,provider,state,created_at,updated_at) VALUES('interrupted-fixture',?,'sendgrid','sending',?,?)").bind(row.id,at,at),
 ])
 const later=captureRejections();await drainRejectionNotices(rejectionRuntime(),()=>rejectionTime)
 expect(later).toHaveLength(0);expect((await rejectionRows()).find(r=>r.id===row.id)).toMatchObject({state:'unknown',reason:'attempt_interrupted_review_required'})
 expect(await env.DB.prepare("SELECT actor_id FROM audit_entries WHERE entity_id=? AND json_extract(details_json,'$.state')='unknown'").bind(row.id).first()).toEqual({actor_id:'moderation_rejection_mail'})
})
it('[REQ-030 NOTIFY-002] a final-admission consent race suppresses without a transport call',async()=>{
 const g=await rejectionFixture();expect((await g.reject()).status).toBe(200)
 const runtime=rejectionRuntime(),db=env.DB
 let batches=0
 // Interleave an actual permission withdrawal after links/content were prepared,
 // immediately before the final admission transaction (claim, then admission).
 const binding=new Proxy(db,{get(target,key){
  if(key==='batch')return async(statements:D1PreparedStatement[])=>{
   batches++
   if(batches===3)await db.prepare('UPDATE requester_update_permissions SET revoked_at=? WHERE requester_id=?').bind(new Date().toISOString(),g.requesterId).run()
   return db.batch(statements)
  }
  const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value
 }})
 const sent=captureRejections()
 await drainRejectionNotices({...runtime,database:{...runtime.database,binding}},()=>rejectionTime)
 expect(sent).toHaveLength(0);expect(await rejectionRows()).toMatchObject([{state:'suppressed',reason:'consent_missing_or_revoked'}])
 expect(await env.DB.prepare('SELECT recipient_email FROM notification_outbox_attempts').first()).toEqual({recipient_email:null})
})
it('[REQ-030 BASE-OPS-005] audit-storage refusal cannot send an unaudited message',async()=>{
 const g=await rejectionFixture();expect((await g.reject()).status).toBe(200)
 await env.DB.exec(`CREATE TRIGGER refuse_rejection_audit BEFORE INSERT ON audit_entries WHEN NEW.action='moderation.rejection_mail' BEGIN SELECT RAISE(ABORT,'fixture_audit_unavailable'); END`)
 const sent=captureRejections()
 await expect(drainRejectionNotices(rejectionRuntime(),()=>rejectionTime)).rejects.toThrow('fixture_audit_unavailable')
 expect(sent).toHaveLength(0);expect(await rejectionRows()).toMatchObject([{state:'queued',attempts:0}])
 await env.DB.exec('DROP TRIGGER refuse_rejection_audit')
 await drainRejectionNotices(rejectionRuntime(),()=>rejectionTime)
 expect(sent).toHaveLength(1)
})
