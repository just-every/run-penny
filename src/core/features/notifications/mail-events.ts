// @ts-expect-error Retained Base implementation ships JavaScript without declarations.
import { createDurableEventStore } from '../../../../base/modules/mail/src/events/storage.mjs'
import type { PennyRuntime } from '@/core/app/runtime'
import { NativeError } from '@/core/features/auth/native-tokens'
import { signedEvents } from './event-intake'
import { correlate } from './event-correlation'
import { eventStorage,type OwnedEvent } from './event-storage'
const limit=1024*1024
async function boundedBody(request:Request){
 const reader=request.body?.getReader();if(!reader)throw new NativeError('invalid_mail_event',400)
 const parts:Uint8Array[]=[];let size=0
 try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new NativeError('mail_event_too_large',413)}parts.push(value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength}return bytes
}
/** A signed provider batch holds every message the account sent. Penny applies
 * the events it can correlate to its own mail and acknowledges the rest without
 * storing them. Base's durable store deduplicates event IDs and keeps delivery
 * states monotone; a conflicting message ID for one attempt refuses the batch. */
export async function ingestMailEvents(runtime:PennyRuntime,request:Request){
 const provider=runtime.configuration.mailProvider,key=provider==='sendgrid'?runtime.bindings.SENDGRID_EVENT_PUBLIC_KEY:runtime.bindings.RESEND_WEBHOOK_SECRET
 if((provider!=='sendgrid'&&provider!=='resend')||!key)throw new NativeError('mail_event_configuration_required',503)
 const rawBody=await boundedBody(request),db=runtime.database.binding,owned:OwnedEvent[]=[]
 for(const event of await signedEvents(provider,key,rawBody,request.headers,Date.now())){
  const owner=await correlate(db,event)
  const message=(item:OwnedEvent|Omit<OwnedEvent,'event'>)=>item.attemptId?`${item.kind}:${item.attemptId}`:item.reviewId?`review:${item.reviewId}`:null
  // Two different provider messages for one attempt in one batch refuse it whole.
  if(owner==='conflict'||(owner&&event.providerMessageId&&owned.some(item=>message(item)!==null&&message(item)===message(owner)&&item.event.providerMessageId!==null&&item.event.providerMessageId!==event.providerMessageId)))throw new NativeError('invalid_mail_event',400)
  if(owner)owned.push({...owner,event})
 }
 if(!owned.length)return []
 const store=createDurableEventStore(eventStorage(db,owned))
 try {
  return await store.commit(owned.map(({event,messageKey})=>({provider:event.provider,tenantId:'penny',eventNamespace:'requester-notifications',eventId:event.eventId,
   providerMessageId:event.providerMessageId??messageKey,type:event.type,status:event.status,occurredAt:event.occurredAt,recipients:[event.recipient],
   deliveryId:event.deliveryId,product:event.product,fingerprint:event.fingerprint})))
 }catch(error){
  const code=(error as {code?:string}).code
  throw new NativeError(code==='event_storage_failed'?'mail_event_storage_unavailable':'invalid_mail_event',code==='event_storage_failed'?503:400)
 }
}
