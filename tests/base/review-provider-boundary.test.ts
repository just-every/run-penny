import { applyD1Migrations,reset } from 'cloudflare:test'
import { beforeEach,afterEach,expect,inject,it,vi } from 'vitest'
import { env } from './support'
import { graph,runtime,rows,provider,start } from './notification-regression-fixture'
import { signingIdentity } from './review-mail-fixture'
import { drainNotifications } from '@/core/features/notifications/delivery'
import { createPennyApp } from '@/core/app/worker'
import { eventStorage } from '@/core/features/notifications/event-storage'
// @ts-expect-error Genuine retained Base JavaScript has no declarations.
import { createDeliveryEventIntake } from '../../base/modules/mail/src/events/index.mjs'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
afterEach(()=>vi.restoreAllMocks())

it('[REL-011] records the retained Base defect: genuine signed delayed bounce without sg_message_id fails before authorization',async()=>{
 const g=await graph(),identity=await signingIdentity(),authorize=vi.fn(async()=>true)
 const event={event:'bounce',type:'bounce',sg_event_id:'delayed-bounce',email:g.recipient.email,timestamp:Math.floor(Date.now()/1000)}
 const request=await identity.request([event])
 const intake=createDeliveryEventIntake({provider:'sendgrid',key:identity.key,tenantId:'penny',eventNamespace:'requester-notifications',storage:eventStorage(env.DB,[]),authorize})
 await expect(intake.ingestWebhook({rawBody:new Uint8Array(await request.arrayBuffer()),headers:request.headers})).rejects.toMatchObject({code:'invalid_event_identity'})
 expect(authorize).not.toHaveBeenCalled()
 expect((await createPennyApp().fetch(await identity.request([event]),{...env,SENDGRID_EVENT_PUBLIC_KEY:identity.key})).status).toBe(400)
 expect(await rows('mail_event_records')).toHaveLength(0)
 expect((await rows('requester_addresses'))[0].suppressed_at).toBeNull()
})

it('[REL-011] historical accepted attempts without recipient snapshots or attempt correlation cannot authorize suppression',async()=>{
 const g=await graph();await g.publish(0,'Historical accepted notification')
 const sent=provider();await drainNotifications(runtime(),()=>start+3600000);expect(sent).toHaveLength(1)
 const batch=(await rows('notification_batches'))[0],identity=await signingIdentity(),app=createPennyApp()
 const event={event:'bounce',type:'bounce',sg_event_id:'historical-bounce',sg_message_id:'historical-provider-message',email:g.recipient.email,timestamp:Math.floor(Date.now()/1000),rer_delivery_id:String(batch.id),rer_product:'penny'}
 const post=async(body:unknown)=>app.fetch(await identity.request([body]),{...env,SENDGRID_EVENT_PUBLIC_KEY:identity.key})
 expect((await post(event)).status).toBe(400)
 await env.DB.prepare('UPDATE notification_attempts SET recipient_email=NULL,recipient_verification_epoch=NULL WHERE id=?').bind(batch.claim_id).run()
 expect((await post({...event,rer_penny_attempt:batch.claim_id})).status).toBe(400)
 expect(await rows('mail_event_records')).toHaveLength(0)
 expect((await rows('requester_addresses'))[0].suppressed_at).toBeNull()
})
