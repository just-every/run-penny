import { applyD1Migrations,reset } from 'cloudflare:test'
import { beforeEach,afterEach,expect,inject,it,vi } from 'vitest'
import { env } from './support'
import { graph,runtime,rows,provider,start } from './notification-regression-fixture'
import { drainNotifications } from '@/core/features/notifications/delivery'
import { createPennyApp } from '@/core/app/worker'
import { signingIdentity } from './review-mail-fixture'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
afterEach(()=>vi.restoreAllMocks())
async function fixture(){
 const g=await graph();await g.publish(0,'Initial notification');const sent=provider();await drainNotifications(runtime(),()=>start+3600000)
 expect(sent).toHaveLength(1)
 const batch=(await rows('notification_batches'))[0],identity=await signingIdentity(),app=createPennyApp()
 const event={event:'bounce',type:'bounce',status:'5.1.1',sg_event_id:'hard-bounce-1',sg_message_id:'provider-webhook-message.received-node-1',email:g.recipient.email,timestamp:Math.floor(Date.now()/1000),rer_delivery_id:String(batch.id),rer_product:'penny',rer_penny_attempt:String(batch.claim_id)}
 const post=async(events:unknown[],timestamp?:number)=>app.fetch(await identity.request(events,timestamp),{...env,SENDGRID_EVENT_PUBLIC_KEY:identity.key})
 return {...g,sent,event,post,app,identity}
}
it('[REL-011 NOTIFY-005 BASE-OPS-003] signed correlated hard bounce atomically suppresses, duplicate is safe, and later mail cannot send',async()=>{
 const g=await fixture();expect((await g.post([g.event])).status).toBe(200)
 expect((await rows('requester_addresses'))[0].suppressed_at).toEqual(expect.any(String))
 expect((await g.post([g.event])).status).toBe(200)
 expect((await rows('requester_update_permissions'))[0].revoked_at).toBeNull()
 await g.publish(0,'After hard bounce',7200000);await drainNotifications(runtime(),()=>start+10800000);expect(g.sent).toHaveLength(1)
})
it('[REL-011] signed complaint suppresses a correlated recipient',async()=>{
 const g=await fixture();expect((await g.post([{...g.event,event:'spamreport',sg_event_id:'complaint-1'}])).status).toBe(200)
 expect((await rows('requester_addresses'))[0].suppressed_at).toEqual(expect.any(String))
})
it('[REL-011 BASE-ACCESS-004] bad signatures, stale and tampered requests are refused; signed mail Penny did not send is acknowledged without effect',async()=>{
 const g=await fixture()
 expect((await g.post([{...g.event,event:'delivered',sg_event_id:'prime'}])).status).toBe(200)
 // Another product's message and an address Penny never mailed change nothing.
 for(const change of [{email:'other@example.test'},{sg_message_id:'other-product-message',rer_delivery_id:'foreign',rer_product:'other',rer_penny_attempt:'foreign'}]){
  const before=await rows('mail_event_records');expect((await g.post([{...g.event,...change}])).status).toBe(200);expect(await rows('mail_event_records')).toEqual(before)
 }
 // A refused send reached no provider: another product's unsubscribe or bounce for
 // the same address naming its own message still changes nothing.
 provider(429);await g.publish(0,'Refused by the provider',7200000);await drainNotifications(runtime(),()=>start+10800000)
 expect((await rows('notification_attempts')).some(row=>row.state==='rate_limited'&&row.provider_message_id===null)).toBe(true)
 const quiet=await rows('mail_event_records')
 for(const event of [{event:'group_unsubscribe',sg_event_id:'other-unsubscribe'},{event:'bounce',type:'bounce',sg_event_id:'other-bounce'}]){
  expect((await g.post([{...event,sg_message_id:'other-product-message.filterdrecv-9',rer_product:'other',email:g.recipient.email,timestamp:Math.floor(Date.now()/1000)}])).status).toBe(200)
  expect((await g.post([{...event,sg_event_id:event.sg_event_id+'-unmarked',sg_message_id:'other-product-message.filterdrecv-9',email:g.recipient.email,timestamp:Math.floor(Date.now()/1000)}])).status).toBe(200)
 }
 expect(await rows('mail_event_records')).toEqual(quiet);expect(await rows('requester_notification_preferences')).toEqual([])
 // A second provider message for Penny's own attempt is a conflict, not a new fact.
 expect((await g.post([{...g.event,sg_message_id:'foreign'}])).status).toBe(400)
 expect((await g.post([g.event],Math.floor(Date.now()/1000)-301)).status).toBe(400)
 const signed=await g.identity.request([g.event]);expect((await g.app.fetch(new Request(signed.url,{method:'POST',headers:signed.headers,body:(await signed.text())+' '}),{...env,SENDGRID_EVENT_PUBLIC_KEY:g.identity.key})).status).toBe(400)
 expect((await rows('requester_addresses'))[0].suppressed_at).toBeNull()
})
it('[REL-012 REL-011] a provider unsubscribe withdraws all requester email and keeps follows and votes',async()=>{
 const g=await fixture(),follows=await rows('request_follows')
 expect((await g.post([{...g.event,event:'unsubscribe',sg_event_id:'provider-unsubscribe'}])).status).toBe(200)
 expect(await env.DB.prepare('SELECT muted_at FROM requester_notification_preferences').first('muted_at')).toEqual(expect.any(String))
 expect((await rows('requester_addresses'))[0].suppressed_at).toBeNull();expect(await rows('request_follows')).toEqual(follows)
 await g.publish(0,'After provider unsubscribe',7200000);await drainNotifications(runtime(),()=>start+10800000);expect(g.sent).toHaveLength(1)
})
it('[REL-011] verified soft bounce and delivered facts never suppress',async()=>{
 const g=await fixture()
 for(const event of [{...g.event,type:'blocked',status:'4.0.0'},{...g.event,event:'delivered',sg_event_id:'delivered-1'}])expect((await g.post([event])).status).toBe(200)
 expect((await rows('requester_addresses'))[0].suppressed_at).toBeNull()
})
it('[REL-011 BASE-OPS-003] concurrent duplicate callbacks commit one receipt and preserve suppression across a new app instance',async()=>{
 const g=await fixture(),responses=await Promise.all([g.post([g.event]),g.post([g.event])])
 expect(responses.some(r=>r.status===200)).toBe(true);expect(responses.every(r=>r.status===200||r.status===503)).toBe(true)
 expect((await g.post([g.event])).status).toBe(200)
 const before=await rows('mail_event_records');expect(before).toHaveLength(2)
 expect((await createPennyApp().fetch(await g.identity.request([g.event]),{...env,SENDGRID_EVENT_PUBLIC_KEY:g.identity.key})).status).toBe(200)
 expect(await rows('mail_event_records')).toEqual(before)
})
it('[REL-011 BASE-OPS-003] a suppression failure rolls receipts and state back, and provider retry completes all effects',async()=>{
 const g=await fixture()
 await env.DB.exec("CREATE TRIGGER injected_suppression_failure BEFORE UPDATE OF suppressed_at ON requester_addresses BEGIN SELECT RAISE(ABORT,'injected suppression failure'); END;")
 expect((await g.post([g.event])).status).toBe(503)
 expect(await rows('mail_event_records')).toHaveLength(0)
 expect((await rows('requester_addresses'))[0].suppressed_at).toBeNull()
 expect((await rows('notification_attempts'))[0].event_message_id).toBeNull()
 await env.DB.exec('DROP TRIGGER injected_suppression_failure')
 expect((await g.post([g.event])).status).toBe(200)
 expect(await rows('mail_event_records')).toHaveLength(2)
 expect((await rows('requester_addresses'))[0].suppressed_at).toEqual(expect.any(String))
})
it('[REL-011] a signed batch mixing Penny\'s bounce with other account mail applies Penny\'s event and stores nothing for the rest',async()=>{
 const g=await fixture()
 expect((await g.post([g.event,{...g.event,sg_event_id:'foreign-event',sg_message_id:'foreign-message',email:'someone-else@example.test',rer_penny_attempt:'unrelated-attempt',rer_delivery_id:'unrelated'}])).status).toBe(200)
 expect((await rows('requester_addresses'))[0].suppressed_at).toEqual(expect.any(String))
 const records=await rows('mail_event_records');expect(records).toHaveLength(2);expect(JSON.stringify(records)).not.toContain('someone-else@example.test')
})
it('[REL-011 BASE-OPS-003] same event ID with changed signed subtype conflicts and cannot retroactively suppress',async()=>{
 const g=await fixture()
 expect((await g.post([{...g.event,type:'blocked'}])).status).toBe(200)
 const before=await rows('mail_event_records')
 expect((await g.post([g.event])).status).toBe(400)
 expect(await rows('mail_event_records')).toEqual(before)
 expect((await rows('requester_addresses'))[0].suppressed_at).toBeNull()
})
it('[REL-011 BASE-DATA-003 DATA-003] requester erasure removes Base receipt PII, address generations and attempt snapshots',async()=>{
 const {planErasure,eraseEntity}=await import('@/core/features/data/archive')
 const g=await fixture();expect((await g.post([g.event])).status).toBe(200)
 await env.DB.prepare("INSERT INTO notification_link_epochs(address_id,scope,epoch,created_at,updated_at) VALUES(?,'all',1,'now','now')").bind(g.recipient.addressId).run()
 const plan=await planErasure(env.DB,'requesters',g.recipient.requesterId)
 expect(plan.counts.mail_event_records).toBe(2);expect(plan.counts.notification_link_epochs).toBe(1)
 expect(plan.blockedCopies).toEqual([])
 const result=await eraseEntity(env.DB,env.FILES,'requesters',g.recipient.requesterId,plan.planHash)
 expect(result.status).toBe('complete')
 expect(await rows('mail_event_records')).toHaveLength(0);expect(await rows('notification_attempts')).toHaveLength(0);expect(await rows('notification_link_epochs')).toHaveLength(0)
 expect(JSON.stringify((await env.DB.prepare('SELECT * FROM audit_entries').all()).results)).not.toContain(g.recipient.email)
})
it('[REL-011 REQ-023] permission suppression is retained until genuine re-verification, and replay cannot undo recovery',async()=>{
 const {call}=await import('./support')
 const g=await fixture();expect((await g.post([g.event])).status).toBe(200)
 expect((await rows('requester_update_permissions'))[0]).toMatchObject({revoked_at:null,suppressed_at:expect.any(String)})
 expect((await call('/api/public/identity/email',{email:g.recipient.email,displayName:'Verified requester'})).status).toBe(202)
 expect((await rows('requester_addresses'))[0].suppressed_at).toEqual(expect.any(String))
 const content=g.sent.at(-1)!.body.content as {type:string;value:string}[]
 const link=content.find(c=>c.type==='text/plain')!.value.match(/https:\/\/[^\s]+/)![0]
 const token=new URLSearchParams(new URL(link).hash.slice(1)).get('token')
 expect((await call('/api/public/identity/email/verify',{token})).status).toBe(200)
 expect((await rows('requester_addresses'))[0].suppressed_at).toBeNull()
 expect((await rows('requester_update_permissions'))[0]).toMatchObject({revoked_at:null,suppressed_at:null})
 expect((await g.post([g.event])).status).toBe(200)
 expect((await g.post([{...g.event,sg_event_id:'late-before-reverification'}])).status).toBe(200)
 expect((await rows('requester_addresses'))[0].suppressed_at).toBeNull()
 await g.publish(0,'After verification',7200000);await drainNotifications(runtime(),()=>start+10800000)
 expect(g.sent).toHaveLength(3)
})
it('[REL-011 BASE-ACCESS-004] conflicting message IDs for one attempt within a signed batch reject every effect',async()=>{
 const g=await fixture()
 expect((await g.post([g.event,{...g.event,sg_event_id:'second-id',sg_message_id:'different-message'}])).status).toBe(400)
 expect(await rows('mail_event_records')).toHaveLength(0)
 expect((await rows('requester_addresses'))[0].suppressed_at).toBeNull()
})
it('[REL-011 BASE-ACCESS-004 BASE-OPS-003] authorization changed between verification and commit aborts the entire D1 transaction',async()=>{
 const g=await fixture();let changed=false
 const db=new Proxy(env.DB,{get(target,key){if(key==='prepare')return(sql:string)=>{
  const statement=target.prepare(sql)
  const wrap=(s:D1PreparedStatement):D1PreparedStatement=>new Proxy(s,{get(item,property){
   if(property==='bind')return(...values:unknown[])=>wrap(item.bind(...values))
   if(property==='first'&&sql.startsWith('SELECT json_array(a.id'))return async()=>{const row=await item.first();if(!changed){changed=true;await env.DB.prepare("UPDATE notification_attempts SET recipient_email='changed@example.test'").run()}return row}
   const value=Reflect.get(item,property);return typeof value==='function'?value.bind(item):value
  }})
  return wrap(statement)
 };const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value}})
 expect((await g.app.fetch(await g.identity.request([g.event]),{...env,DB:db,SENDGRID_EVENT_PUBLIC_KEY:g.identity.key})).status).toBe(503)
 expect(changed).toBe(true);expect(await rows('mail_event_records')).toHaveLength(0)
 expect((await rows('requester_addresses'))[0].suppressed_at).toBeNull()
})
it('[REL-011 BASE-OPS-003] D1 validates read-only keys and absent keys before buffered writes; conflicts cannot leave partial records',async()=>{
 const {eventStorage}=await import('@/core/features/notifications/event-storage')
 const g=await fixture();expect((await g.post([g.event])).status).toBe(200)
 const records=await rows('mail_event_records'),receipt=records.find(r=>String(r.id).includes(':receipt:'))!,event=JSON.parse(String(receipt.value_json))
 const owner={event,kind:'batch' as const,outboxId:null,reviewId:null,requesterId:null,operatorId:null,messageKey:String(event.providerMessageId),unsubscribe:false,addressId:g.recipient.addressId,batchId:String(receipt.batch_id),attemptId:g.event.rer_penny_attempt,suppress:false,witness:{sql:'SELECT value_json FROM mail_event_records WHERE id=?',values:[String(receipt.id)],raw:String(receipt.value_json)}}
 const store=eventStorage(env.DB,[owner])
 let unlock!:()=>void,observed!:()=>void
 const gate=new Promise<void>(r=>{unlock=r}),ready=new Promise<void>(r=>{observed=r})
 const transaction=store.transaction(async tx=>{await tx.get('absent-read-only');await tx.put('buffered-write',{eventId:event.eventId,status:'delivered'});observed();await gate})
 await ready
 await env.DB.prepare('INSERT INTO mail_event_records(id,value_json,address_id,batch_id,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind('absent-read-only','{}',g.recipient.addressId,receipt.batch_id,'now','now').run()
 unlock();await expect(transaction).rejects.toThrow()
 expect(await env.DB.prepare("SELECT id FROM mail_event_records WHERE id='buffered-write'").first()).toBeNull()
 expect(await env.DB.prepare('SELECT id FROM requester_write_guards').first()).toBeNull()
 const state=records.find(r=>String(r.id).includes(':state:'))!
 await expect(store.transaction(async tx=>{
  await tx.get(String(state.id));await tx.put('second-buffered',{eventId:event.eventId,status:'delivered'})
  await env.DB.prepare('UPDATE mail_event_records SET value_json=? WHERE id=?').bind(JSON.stringify({status:'delivered',occurredAt:1,eventId:event.eventId}),state.id).run()
 })).rejects.toThrow()
 expect(await env.DB.prepare("SELECT id FROM mail_event_records WHERE id='second-buffered'").first()).toBeNull()
})
it('[REL-011] Resend Svix original bytes authorize only its stored message and recipient and distinguish Permanent from Transient',async()=>{
 const {createPennyRuntime}=await import('@/core/app/runtime')
 const g=await graph();await g.publish(0,'Resend event')
 vi.mocked(fetch).mockImplementation(async(input)=>{expect(String(input)).toBe('https://api.resend.com/emails');return Response.json({id:'resend-receipt'})})
 const bindings={...env,WORKSPACE_TIMEZONE:'UTC',MAIL_PROVIDER:'resend',RESEND_API_KEY:'synthetic-resend-key',SENDGRID_API_KEY:undefined,RESEND_WEBHOOK_SECRET:'whsec_'+btoa('synthetic-svix-secret-32-bytes-long')}
 const rt=createPennyRuntime(bindings,{workspaceTimezone:'UTC',operatorAllowlist:['owner@penny.invalid'],publicOriginAllowlist:['https://penny.test']})
 await drainNotifications(rt,()=>start+3600000)
 const app=createPennyApp(),key=await crypto.subtle.importKey('raw',new TextEncoder().encode('synthetic-svix-secret-32-bytes-long'),{name:'HMAC',hash:'SHA-256'},false,['sign'])
 const send=async(id:string,payload:unknown,tamper=false)=>{
  const body=JSON.stringify(payload),timestamp=String(Math.floor(Date.now()/1000))
  const sig=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${id}.${timestamp}.${body}`)))))
  return app.fetch(new Request('https://penny.test/api/public/mail/events',{method:'POST',body:body+(tamper?' ':''),headers:{'svix-id':id,'svix-timestamp':timestamp,'svix-signature':'v1,'+sig}}),bindings)
 }
 const body={type:'email.bounced',created_at:new Date().toISOString(),data:{email_id:'resend-receipt',to:[g.recipient.email],bounce:{type:'Transient'}}}
 expect((await send('soft',body)).status).toBe(200);expect((await rows('requester_addresses'))[0].suppressed_at).toBeNull()
 // Another message or recipient on the same account is acknowledged and changes nothing.
 const permanent={...body,data:{...body.data,bounce:{type:'Permanent'}}}
 expect((await send('wrong',{...permanent,data:{...permanent.data,email_id:'unrelated'}})).status).toBe(200)
 expect((await send('wrong-recipient',{...permanent,data:{...permanent.data,to:['other@example.test']}})).status).toBe(200)
 expect((await rows('requester_addresses'))[0].suppressed_at).toBeNull()
 expect((await send('tamper',body,true)).status).toBe(400)
 expect((await send('hard',{...body,data:{...body.data,bounce:{type:'Permanent'}}})).status).toBe(200)
 expect((await rows('requester_addresses'))[0].suppressed_at).toEqual(expect.any(String))
 expect((await rows('requester_update_permissions'))[0].suppressed_at).toEqual(expect.any(String))
})
