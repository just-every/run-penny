import { applyD1Migrations,reset } from 'cloudflare:test'
import { beforeEach,afterEach,expect,inject,it,vi } from 'vitest'
import { env,call } from './support'
import { releaseGraph } from './release-fixture'
import { rows,time,start,runtime,provider } from './notification-regression-fixture'
import { publishRelease } from '@/core/features/releases/publication'
import { saveReleaseDraft } from '@/core/features/releases/drafts'
import { drainReleaseDeliveries } from '@/core/features/releases/delivery'
import { drainNotifications } from '@/core/features/notifications/delivery'
import { releaseDeliveryCounts } from '@/core/features/releases/counts'
import { signingIdentity } from './review-mail-fixture'
import { createPennyApp } from '@/core/app/worker'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
afterEach(()=>vi.restoreAllMocks())
it('[REL-004/006/007 NOTIFY-002] snapshot commits before HTTP; independent releases bypass open request window and concurrent drains send once',async()=>{
 const g=await releaseGraph();await g.publish(0,'Pending status')
 const second=await saveReleaseDraft(env.DB,{...g.input,title:'Another release'},undefined,time())
 await publishRelease(env.DB,g.draft.slug,time());await publishRelease(env.DB,second.slug,time())
 let sends=0
 vi.mocked(fetch).mockImplementation(async(_input,init)=>{
  sends++;expect(await rows('release_recipient_snapshots')).toHaveLength(2);expect(await rows('release_recipient_contexts')).toHaveLength(4)
  const body=JSON.parse(String(init?.body)),key=body.custom_args.rer_delivery_id
  const command=(await env.DB.prepare('SELECT claim_id FROM notification_outbox WHERE id=?').bind(key).first<{claim_id:string}>())!
  expect(command.claim_id).toBe(body.custom_args.rer_penny_attempt)
  expect((await env.DB.prepare('SELECT recipient_email,recipient_verification_epoch FROM notification_outbox_attempts WHERE id=?').bind(command.claim_id).first())).toMatchObject({recipient_email:g.recipient.email,recipient_verification_epoch:0})
  return new Response(null,{status:202,headers:{'x-message-id':'accepted'}})
 })
 await Promise.all([drainReleaseDeliveries(runtime(),()=>start+59000),drainReleaseDeliveries(runtime(),()=>start+59000)])
 expect(sends).toBe(2);await drainNotifications(runtime(),()=>start+59000);expect(sends).toBe(2)
 await drainReleaseDeliveries(runtime(),()=>start+3600000);expect(sends).toBe(2)
 expect(await releaseDeliveryCounts(env.DB,g.draft.versionId)).toMatchObject({queued:0,sent:1})
})
it('[REL-006 NOTIFY-002] 20:00 quiet boundary defers until 08:00 and consumes no attempt',async()=>{
 const g=await releaseGraph(),night=Date.parse('2026-10-08T20:00:00Z'),morning=Date.parse('2026-10-09T08:00:00Z')
 await publishRelease(env.DB,g.draft.slug,new Date(night).toISOString());const sent=provider()
 await drainReleaseDeliveries(runtime(),()=>night);await drainReleaseDeliveries(runtime(),()=>morning-1)
 expect(sent).toHaveLength(0);expect(await rows('notification_outbox_attempts')).toHaveLength(0)
 await drainReleaseDeliveries(runtime(),()=>morning);expect(sent).toHaveLength(1)
})
it('[REL-006/007] known rejections use stable correlation for initial plus five bounded exponential retries',async()=>{
 const g=await releaseGraph();await publishRelease(env.DB,g.draft.slug,time());const sent=provider(429)
 for(const minutes of [0,1,3,7,15,31])await drainReleaseDeliveries(runtime(),()=>start+minutes*60000)
 expect(sent).toHaveLength(6)
 const ids=sent.map(s=>(s.body.custom_args as {rer_delivery_id:string}).rer_delivery_id)
 expect(new Set(ids).size).toBe(1);expect(await releaseDeliveryCounts(env.DB,g.draft.versionId)).toMatchObject({failed:1})
 await drainReleaseDeliveries(runtime(),()=>start+3600000);expect(sent).toHaveLength(6)
})
it('[REL-006/007] ambiguous provider outcome and interrupted claim are unknown and never replayed',async()=>{
 const g=await releaseGraph();await publishRelease(env.DB,g.draft.slug,time());const sent=provider(500)
 await drainReleaseDeliveries(runtime(),()=>start);await drainReleaseDeliveries(runtime(),()=>start+60000)
 expect(sent).toHaveLength(1);expect(await releaseDeliveryCounts(env.DB,g.draft.versionId)).toMatchObject({unknown:1})
 const second=await saveReleaseDraft(env.DB,{...g.input,title:'Interrupted'},undefined,time());await publishRelease(env.DB,second.slug,time())
 const outbox=(await rows('notification_outbox')).find(r=>r.subject_id===second.versionId)!
 await env.DB.batch([
  env.DB.prepare("UPDATE notification_outbox SET claim_id='interrupted',attempt_count=1 WHERE id=?").bind(outbox.id),
  env.DB.prepare("INSERT INTO notification_outbox_attempts(id,outbox_id,provider,state,created_at,updated_at) VALUES('interrupted',?,'sendgrid','sending',?,?)").bind(outbox.id,time(),time()),
 ])
 await drainReleaseDeliveries(runtime(),()=>start+300001);expect(sent).toHaveLength(1);expect(await releaseDeliveryCounts(env.DB,second.versionId)).toMatchObject({unknown:1})
})
it.each(['mute','global','consent','suppression','email','retired','visibility','mapping'] as const)('[REL-004/005 NOTIFY-002] current %s gates release sending without rewriting immutable snapshot',async change=>{
 const g=await releaseGraph(1);await publishRelease(env.DB,g.draft.slug,time());const snapshot=await rows('release_recipient_snapshots')
 if(change==='mute')await call(`/api/public/requests/${g.requests[0].slug}/follow`,{muted:true},g.person,'PATCH')
 if(change==='global')await call('/api/public/requester/notifications',{muted:true},g.person,'PATCH')
 if(change==='consent')await env.DB.exec("UPDATE requester_update_permissions SET revoked_at='later'")
 if(change==='suppression')await env.DB.exec("UPDATE requester_addresses SET suppressed_at='later'")
 if(change==='email')await env.DB.exec("UPDATE requester_addresses SET email='changed@example.test'")
 if(change==='retired')await env.DB.exec("UPDATE requesters SET blocked_at='later'")
 if(change==='visibility')await env.DB.exec("UPDATE boards SET visibility='internal'")
 if(change==='mapping')await env.DB.exec("UPDATE roadmap_request_mappings SET withdrawn_at='later'")
 const sent=provider();await drainReleaseDeliveries(runtime(),()=>start)
 expect(sent).toHaveLength(0);expect(await rows('release_recipient_snapshots')).toEqual(snapshot)
 expect(await releaseDeliveryCounts(env.DB,g.draft.versionId)).toMatchObject({suppressed:1})
})
it('[REL-011/013 REL-007] genuine signed delivered callback during HTTP wins, duplicates are idempotent and altered identity conflicts',async()=>{
 const g=await releaseGraph();await publishRelease(env.DB,g.draft.slug,time());const identity=await signingIdentity(),app=createPennyApp()
 let event:Record<string,unknown>={}
 const post=(events:unknown[])=>identity.request(events).then(request=>app.fetch(request,{...env,SENDGRID_EVENT_PUBLIC_KEY:identity.key}))
 vi.mocked(fetch).mockImplementation(async(_input,init)=>{
  const body=JSON.parse(String(init?.body)),args=body.custom_args
  event={event:'delivered',sg_event_id:'release-delivered',sg_message_id:'release-provider-message',email:g.recipient.email,timestamp:Math.floor(Date.now()/1000),...args}
  expect((await post([event])).status).toBe(200)
  return new Response(null,{status:202,headers:{'x-message-id':'api-receipt-distinct-from-webhook'}})
 })
 await drainReleaseDeliveries(runtime(),()=>start)
 expect(await releaseDeliveryCounts(env.DB,g.draft.versionId)).toMatchObject({sent:1,delivered:1,queued:0})
 const stored=await rows('mail_event_records');expect(stored).toHaveLength(2)
 expect((await post([event])).status).toBe(200);expect(await rows('mail_event_records')).toEqual(stored)
 expect((await post([{...event,sg_message_id:'other'}])).status).toBe(400)
 expect((await post([{...event,email:'foreign@example.test'}])).status).toBe(400)
 expect((await post([{...event,event:'processed',sg_event_id:'late-accepted',timestamp:Number(event.timestamp)-1}])).status).toBe(200)
 expect(await releaseDeliveryCounts(env.DB,g.draft.versionId)).toMatchObject({delivered:1})
})
it('[REL-004/005 DATA-002] separate recipient contexts never cross into another mail and approved portal wording stays stable',async()=>{
 const g=await releaseGraph(2)
 await call(`/api/public/requests/${g.requests[1].slug}/follow`,{},g.person,'DELETE')
 const {requester}=await import('./support'),other=await requester()
 expect((await call(`/api/public/requests/${g.requests[1].slug}/follow`,{},other)).status).toBe(204)
 await publishRelease(env.DB,g.draft.slug,time())
 const sent=provider();await drainReleaseDeliveries(runtime(),()=>start);expect(sent).toHaveLength(2)
 const first=sent.find(s=>(s.body.personalizations as {to:{email:string}[]}[])[0].to[0].email===g.recipient.email)!
 const second=sent.find(s=>s!==first)!
 expect(JSON.stringify(first.body)).toContain(g.requests[0].slug);expect(JSON.stringify(first.body)).not.toContain(g.requests[1].slug)
 expect(JSON.stringify(second.body)).toContain(g.requests[1].slug);expect(JSON.stringify(second.body)).not.toContain(g.requests[0].slug)
 for(const mail of sent)for(const marker of ['Private decision marker','Private commercial rationale','Private item title','Private delivery notes','private-item-slug','private-decision-slug'])expect(JSON.stringify(mail.body)).not.toContain(marker)
})
it('[REL-011/013] signed hard and soft bounces update actual delivery states with correct suppression policy',async()=>{
 const g=await releaseGraph();await publishRelease(env.DB,g.draft.slug,time());provider();await drainReleaseDeliveries(runtime(),()=>start)
 const outbox=(await rows('notification_outbox')).find(r=>r.release_snapshot_id)!,identity=await signingIdentity(),app=createPennyApp()
 const event={event:'bounce',type:'blocked',status:'4.0.0',sg_event_id:'soft-release',sg_message_id:'bounce-message',email:g.recipient.email,timestamp:Math.floor(Date.now()/1000),rer_delivery_id:outbox.id,rer_product:'penny',rer_penny_attempt:outbox.claim_id}
 expect((await app.fetch(await identity.request([event]),{...env,SENDGRID_EVENT_PUBLIC_KEY:identity.key})).status).toBe(200)
 expect(await releaseDeliveryCounts(env.DB,g.draft.versionId)).toMatchObject({failed:1,suppressed:0})
 expect((await rows('requester_addresses'))[0].suppressed_at).toBeNull()
 expect((await app.fetch(await identity.request([{...event,type:'bounce',status:'5.1.1',sg_event_id:'hard-release',timestamp:event.timestamp+1}]),{...env,SENDGRID_EVENT_PUBLIC_KEY:identity.key})).status).toBe(200)
 expect(await releaseDeliveryCounts(env.DB,g.draft.versionId)).toMatchObject({suppressed:1,failed:0})
 expect((await rows('requester_addresses'))[0].suppressed_at).not.toBeNull()
})
it('[REL-004 REQ-023] identity merge leaves historical snapshot unchanged and cannot redirect release to survivor',async()=>{
 const g=await releaseGraph();await publishRelease(env.DB,g.draft.slug,time());const snapshot=await rows('release_recipient_snapshots'),contexts=await rows('release_recipient_contexts')
 await env.DB.prepare("INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES('survivor','Survivor',?,?)").bind(time(),time()).run()
 const {mergeRequesterIdentities}=await import('@/core/features/requests/identity-merge')
 await mergeRequesterIdentities({binding:env.DB},g.recipient.requesterId,'survivor',g.actor,time())
 expect(await rows('release_recipient_snapshots')).toEqual(snapshot);expect(await rows('release_recipient_contexts')).toEqual(contexts)
 const sent=provider();await drainReleaseDeliveries(runtime(),()=>start);expect(sent).toHaveLength(0)
 expect(await releaseDeliveryCounts(env.DB,g.draft.versionId)).toMatchObject({suppressed:1})
})
it('[REL-004 NOTIFY-002] mutation after discovery but before atomic release admission prevents HTTP',async()=>{
 const g=await releaseGraph();await publishRelease(env.DB,g.draft.slug,time());const real=runtime(),original=real.database.binding
 let batches=0
 const guarded=new Proxy(original,{get(target,key){if(key==='batch')return async(statements:D1PreparedStatement[])=>{
  if(++batches===3)await original.exec("UPDATE requester_update_permissions SET revoked_at='concurrent-revocation'")
  return original.batch(statements)
 };const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value}})
 const sent=provider();await drainReleaseDeliveries({...real,database:{binding:guarded}},()=>start)
 expect(sent).toHaveLength(0);expect(await releaseDeliveryCounts(env.DB,g.draft.versionId)).toMatchObject({suppressed:1})
})
it('[REL-006 NOTIFY-002] entering quiet hours after claim reserves neither an attempt nor retry clock',async()=>{
 const g=await releaseGraph(),before=Date.parse('2026-10-08T19:59:59Z'),night=before+1000,morning=Date.parse('2026-10-09T08:00:00Z')
 await publishRelease(env.DB,g.draft.slug,new Date(before).toISOString())
 let instant=before
 const real=runtime(),wrapped=new Proxy(env.DB,{get(target,key){if(key==='batch')return async(statements:D1PreparedStatement[])=>{const result=await target.batch(statements);if((await rows('notification_outbox_attempts')).length)instant=night;return result};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value}})
 const sent=provider();await drainReleaseDeliveries({...real,database:{binding:wrapped}},()=>instant)
 expect(sent).toHaveLength(0)
 const outbox=(await rows('notification_outbox')).find(r=>r.release_snapshot_id)!
 expect(outbox.attempt_count).toBe(0);expect(outbox.first_attempt_at).toBeNull()
 await drainReleaseDeliveries(runtime(),()=>morning);expect(sent).toHaveLength(1)
})
it('[REL-011 NOTIFY-002] renewed verification preserves original audience and final admission records the current generation',async()=>{
 const g=await releaseGraph();await publishRelease(env.DB,g.draft.slug,time());const snapshot=await rows('release_recipient_snapshots')
 await env.DB.exec('UPDATE requester_addresses SET verification_epoch=verification_epoch+1')
 const sent=provider();await drainReleaseDeliveries(runtime(),()=>start);expect(sent).toHaveLength(1)
 expect((await rows('notification_outbox_attempts'))[0].recipient_verification_epoch).toBe(1)
 expect(await rows('release_recipient_snapshots')).toEqual(snapshot)
})
it('[REL-013 REL-006/007] signed deferred fact during ambiguous HTTP is accepted evidence and never replayed',async()=>{
 const g=await releaseGraph();await publishRelease(env.DB,g.draft.slug,time());const identity=await signingIdentity(),app=createPennyApp();let sends=0
 vi.mocked(fetch).mockImplementation(async(_input,init)=>{
  sends++;const body=JSON.parse(String(init?.body)),event={event:'deferred',sg_event_id:'release-deferred',sg_message_id:'release-deferred-message',email:g.recipient.email,timestamp:Math.floor(Date.now()/1000),...body.custom_args}
  expect((await app.fetch(await identity.request([event]),{...env,SENDGRID_EVENT_PUBLIC_KEY:identity.key})).status).toBe(200)
  return new Response(null,{status:500})
 })
 await drainReleaseDeliveries(runtime(),()=>start)
 expect(await releaseDeliveryCounts(env.DB,g.draft.versionId)).toMatchObject({sent:1,unknown:0})
 await drainReleaseDeliveries(runtime(),()=>start+3600000);expect(sends).toBe(1)
})
