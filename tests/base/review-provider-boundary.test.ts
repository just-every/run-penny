import { applyD1Migrations,reset } from 'cloudflare:test'
import { beforeEach,afterEach,expect,inject,it,vi } from 'vitest'
import { call,env,messages,mockMail,owner } from './support'
import { graph,runtime,rows,provider,start } from './notification-regression-fixture'
import { signingIdentity } from './review-mail-fixture'
import { drainNotifications } from '@/core/features/notifications/delivery'
import { drainDecisionReviews } from '@/core/features/notifications/decision-reviews'
import { drainRejectionNotices } from '@/core/features/notifications/rejection-delivery'
import { rejectionFixture,rejectionRuntime,rejectionTime,captureRejections } from './rejection-fixture'
import { createPennyApp } from '@/core/app/worker'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
afterEach(()=>vi.restoreAllMocks())
const post=async(identity:Awaited<ReturnType<typeof signingIdentity>>,events:unknown[])=>createPennyApp().fetch(await identity.request(events),{...env,SENDGRID_EVENT_PUBLIC_KEY:identity.key})

it('[REL-011] a signed delayed hard bounce without sg_message_id suppresses an address Penny mailed, and stores nothing for one it never mailed',async()=>{
 const g=await graph();await g.publish(0,'Delivered before the delayed bounce')
 const sent=provider();await drainNotifications(runtime(),()=>start+3600000);expect(sent).toHaveLength(1)
 const identity=await signingIdentity(),event={event:'bounce',type:'bounce',sg_event_id:'delayed-bounce',email:g.recipient.email,timestamp:Math.floor(Date.now()/1000)}
 expect((await post(identity,[{...event,sg_event_id:'never-mailed',email:'never-mailed@example.test'}])).status).toBe(200)
 expect(await rows('mail_event_records')).toHaveLength(0)
 expect((await post(identity,[event])).status).toBe(200)
 expect((await rows('requester_addresses'))[0].suppressed_at).toEqual(expect.any(String))
 await g.publish(0,'After the delayed bounce',7200000);await drainNotifications(runtime(),()=>start+10800000);expect(sent).toHaveLength(1)
})

it('[REL-011] historical accepted attempts without recipient snapshots or Penny arguments correlate by provider message and suppress',async()=>{
 const g=await graph();await g.publish(0,'Historical accepted notification')
 const sent=provider();await drainNotifications(runtime(),()=>start+3600000);expect(sent).toHaveLength(1)
 const attempt=(await rows('notification_attempts'))[0]
 await env.DB.prepare('UPDATE notification_attempts SET recipient_email=NULL,recipient_verification_epoch=NULL WHERE id=?').bind(attempt.id).run()
 const identity=await signingIdentity(),event={event:'spamreport',sg_event_id:'historical-complaint',sg_message_id:`${attempt.provider_message_id}.filterdrecv-historical`,email:g.recipient.email,timestamp:Math.floor(Date.now()/1000)}
 expect((await post(identity,[event])).status).toBe(200)
 expect((await rows('requester_addresses'))[0].suppressed_at).toEqual(expect.any(String))
 expect((await rows('notification_attempts'))[0].event_message_id).toBe(event.sg_message_id)
})

it('[REL-011 REQ-030] a hard bounce on a rejection notice suppresses its author',async()=>{
 mockMail();const f=await rejectionFixture();expect((await f.reject()).status).toBe(200)
 const sent=captureRejections();await drainRejectionNotices(rejectionRuntime(),()=>rejectionTime);expect(sent).toHaveLength(1)
 const args=(sent[0] as {custom_args:Record<string,string>}).custom_args,identity=await signingIdentity()
 expect((await post(identity,[{event:'bounce',type:'bounce',sg_event_id:'rejection-bounce',sg_message_id:'rejection-provider-fixture.filterdrecv-1',email:f.email,timestamp:Math.floor(Date.now()/1000),...args}])).status).toBe(200)
 expect(await env.DB.prepare('SELECT suppressed_at FROM requester_addresses WHERE id=?').bind(f.addressId).first('suppressed_at')).toEqual(expect.any(String))
 expect(await env.DB.prepare("SELECT delivery_state FROM notification_outbox WHERE event_type='moderation_rejected'").first('delivery_state')).toBe('suppressed')
})

it('[NOTIFY-005 REL-013] decision-review mail shows delivery, and a hard bounce stops review mail until the owner signs in by email again',async()=>{
 const cookie=await owner();expect((await call('/api/operator/notifications',undefined,cookie)).status).toBe(200)
 const actor=(await env.DB.prepare('SELECT id FROM operators').first<{id:string}>())!.id
 const due=async(question:string)=>{
  const decision=await (await call('/api/operator/decisions',{question,ownerOperatorId:actor},cookie)).json() as {id:string}
  const bet=await (await call(`/api/operator/decisions/${decision.id}/bets`,{title:'Only option',summary:'The approach'},cookie)).json() as {id:string}
  const evidence=await (await call('/api/operator/evidence',{sourceType:'free_text',sourceLabel:'Interview',wording:'Supporting wording',observedAt:'2026-09-01T00:00:00Z'},cookie)).json() as {id:string}
  expect((await call(`/api/operator/evidence/${evidence.id}/links`,{target:'bet',targetId:bet.id},cookie,'PUT')).status).toBeLessThan(300)
  const committed=await call(`/api/operator/decisions/${decision.id}/commit`,{selectedCandidateBetId:bet.id,rationale:'Reason',ownerOperatorId:actor,confidence:'medium',reviewAt:'2026-10-01',noViableAlternativeReason:'Only viable approach'},cookie)
  expect(committed.status,await committed.clone().text()).toBe(200)
 }
 const sent:Record<string,unknown>[]=[]
 vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{expect(String(input)).toBe('https://api.sendgrid.com/v3/mail/send');sent.push(JSON.parse(String(init?.body)));return new Response(null,{status:202,headers:{'x-message-id':'review-provider-fixture'}})})
 await due('First review');await drainDecisionReviews(runtime());expect(sent).toHaveLength(1)
 const args=(sent[0] as {custom_args:Record<string,string>}).custom_args,identity=await signingIdentity(),at=Math.floor(Date.now()/1000)
 const event={sg_message_id:'review-provider-fixture.filterdrecv-1',email:'owner@penny.invalid',timestamp:at,...args}
 const reviews=async()=>(await (await call('/api/operator/notifications',undefined,cookie)).json() as {reviews:{state:string;failureReason:string|null}[]}).reviews
 expect((await post(identity,[{...event,event:'delivered',sg_event_id:'review-delivered'}])).status).toBe(200)
 expect((await reviews())[0].state).toBe('delivered')
 expect((await post(identity,[{...event,event:'bounce',type:'bounce',sg_event_id:'review-bounce',timestamp:at+1}])).status).toBe(200)
 expect((await reviews())[0].state).toBe('suppressed')
 await due('Second review');await drainDecisionReviews(runtime());expect(sent).toHaveLength(1)
 expect((await reviews())[0]).toMatchObject({state:'failed',failureReason:'recipient_suppressed'})
 // A later email sign-in proves the mailbox again.
 vi.restoreAllMocks();mockMail()
 const link=await call('/api/auth/magic-link',{email:'owner@penny.invalid',returnTo:'/app'});expect(link.status).toBe(202)
 const token=new URL(messages.at(-1)!.url).searchParams.get('token')
 expect((await call('/auth/confirm',{token})).status).toBe(303)
 await due('Third review');await drainDecisionReviews(runtime());expect(messages.at(-1)!.to).toBe('owner@penny.invalid');expect(messages).toHaveLength(2)
})
