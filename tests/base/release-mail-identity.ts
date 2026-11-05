import {applyD1Migrations,reset} from 'cloudflare:test'
import {exports} from 'cloudflare:workers'
import {expect,inject,vi} from 'vitest'
import {call,env,origin} from './support'
import {releaseGraph} from './release-fixture'
import {provider,rows} from './notification-regression-fixture'
import {accepted,body,type ProviderMessage} from './subscription-fixture'
import type {OperatorReleaseDetail} from '@/core/shared/api/operator'

type Envelope=ProviderMessage&{subject:string;headers:Record<string,string>;custom_args:{rer_delivery_id:string;rer_penny_attempt:string}}
const address=(number:number)=>[`synthetic-penny-${number}`,'example.test'].join(String.fromCharCode(64))
export async function proveReleaseMailIdentity(){
 await reset();await applyD1Migrations(env.DB,inject('migrations'))
 vi.restoreAllMocks()
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-11-05T12:00:00.000Z'))
 const g=await releaseGraph(1),sent=provider()
 const identity={companyName:'synthetic-penny-1 business',senderName:'synthetic-penny-2 customer team',fromAddress:address(1),replyTo:address(2),postalAddress:'42 Synthetic Street, Brisbane QLD 4000'}
 const tested=await (await accepted(call('/api/operator/settings/mail/test',identity,g.operator))).json() as {testId:string;accepted:boolean}
 expect(tested.accepted).toBe(true)
 expect(sent).toHaveLength(1)
 const testMail=sent[0].body as unknown as Envelope
 expect(testMail.custom_args.rer_delivery_id).toBe(tested.testId)
 expect(testMail.from).toEqual({name:identity.senderName,email:identity.fromAddress})
 await accepted(call('/api/operator/settings/mail',{...identity,testId:tested.testId,acceptProviderResult:true},g.operator,'PUT'))
 const saved=await (await accepted(call('/api/operator/settings/mail',undefined,g.operator))).json() as {identity:typeof identity}
 expect(saved.identity).toEqual(identity)

 const input={...g.input,title:'synthetic-penny-3 release',body:'synthetic-penny-4 customer-safe release wording'}
 await accepted(call(`/api/operator/releases/${g.draft.slug}`,input,g.operator,'PATCH'))
 const publish=()=>accepted(call(`/api/operator/releases/${g.draft.slug}/publish`,{},g.operator))
 await publish()
 const deliveries=await rows('notification_outbox')
 expect(deliveries).toHaveLength(1)
 const delivery=deliveries[0]
 expect(delivery).toMatchObject({event_type:'release_version',subject_id:g.draft.versionId,requester_id:g.recipient.requesterId,address_id:g.recipient.addressId,delivery_state:'queued'})
 const worker=exports.default as typeof exports.default&{scheduled(options:{scheduledTime:number;cron:string}):Promise<void>}
 const cron=()=>worker.scheduled({scheduledTime:Date.now(),cron:'* * * * *'})
 await cron()
 // Correlate this release's durable delivery, rather than the sender-test mail.
 expect(sent).toHaveLength(2)
 const release=sent[1].body as unknown as Envelope
 expect(release.custom_args.rer_delivery_id).toBe(delivery.id)
 const attempts=await rows('notification_outbox_attempts')
 expect(attempts).toEqual([expect.objectContaining({id:release.custom_args.rer_penny_attempt,outbox_id:delivery.id,state:'accepted',provider_message_id:'receipt-2'})])
 expect(release.personalizations).toEqual([{to:[{email:g.recipient.email}]}])
 expect(release.from).toEqual({name:identity.senderName,email:identity.fromAddress})
 expect(release.reply_to).toEqual({email:identity.replyTo})
 expect(release.subject).toBe(input.title)
 const text=body(release)
 expect(text).toContain(input.body)
 expect(text).toContain(`${input.title}\nImproved · ${input.publicationDate}`)
 expect(text).toContain(`${origin}/portal/feedback/${g.requests[0].slug}`)
 expect(text).toContain(`${origin}/portal/updates/${g.draft.slug}`)
 expect(text.endsWith(`\n${identity.postalAddress}`)).toBe(true)
 const unsubscribe=text.match(/^Unsubscribe from all requester email: (https:\/\/\S+)$/m)![1]
 expect(release.headers['List-Unsubscribe']).toBe(`<${unsubscribe}>`)
 expect(release.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
 const detail=await (await accepted(call(`/api/operator/releases/${g.draft.slug}`,undefined,g.operator))).json() as OperatorReleaseDetail
 expect(detail).toMatchObject({id:g.draft.id,versionId:g.draft.versionId,state:'published',deliveryCounts:{sent:1,queued:0}})
 const acceptedDeliveries=await rows('notification_outbox')
 expect(acceptedDeliveries[0]).toMatchObject({id:delivery.id,delivery_state:'accepted',attempt_count:1,provider_message_id:'receipt-2'})
 await publish();await cron();await cron()
 expect(sent).toHaveLength(2)
 expect(await rows('notification_outbox')).toEqual(acceptedDeliveries)
 expect(await rows('notification_outbox_attempts')).toEqual(attempts)

 const link=new URL(unsubscribe)
 expect(link.origin).toBe(origin)
 const preferences=await rows('requester_notification_preferences'),permissions=await rows('requester_update_permissions')
 await accepted(call(link.pathname+link.search))
 expect(await rows('requester_notification_preferences')).toEqual(preferences)
 expect(await rows('requester_update_permissions')).toEqual(permissions)
 await accepted(call(link.pathname+link.search,{},{}))
 expect(await (await accepted(call('/api/public/requester/notifications',undefined,g.person))).json()).toEqual({muted:true})
 await cron();expect(sent).toHaveLength(2)
 vi.useRealTimers()
}
