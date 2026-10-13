// @ts-expect-error Retained Base implementation ships JavaScript without declarations.
import { createDeliveryEventIntake } from '../../../../base/modules/mail/src/events/index.mjs'
import type { PennyRuntime } from '@/core/app/runtime'
import { NativeError } from '@/core/features/auth/native-tokens'
import { eventStorage } from './event-storage'
import { originalPolicyReader } from './event-original'
import type { DeliveryEvent,EventAuthorization } from './event-types'
const limit=1024*1024
async function boundedBody(request:Request){
 const reader=request.body?.getReader();if(!reader)throw new NativeError('invalid_mail_event',400)
 const parts:Uint8Array[]=[];let size=0
 try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new NativeError('mail_event_too_large',413)}parts.push(value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength}return bytes
}
export async function ingestMailEvents(runtime:PennyRuntime,request:Request){
 const provider=runtime.configuration.mailProvider,key=provider==='sendgrid'?runtime.bindings.SENDGRID_EVENT_PUBLIC_KEY:runtime.bindings.RESEND_WEBHOOK_SECRET
 if((provider!=='sendgrid'&&provider!=='resend')||!key)throw new NativeError('mail_event_configuration_required',503)
 const rawBody=await boundedBody(request),db=runtime.database.binding,authorized:EventAuthorization[]=[]
 const readPolicy=originalPolicyReader(rawBody,provider)
 const intake=createDeliveryEventIntake({provider,key,tenantId:'penny',eventNamespace:'requester-notifications',storage:eventStorage(db,authorized),
  authorize:async(event:DeliveryEvent)=>{
   if(event.provider!==provider||event.recipients.length!==1)return false
   const policy=await readPolicy(event.fingerprint)
   // SendGrid's webhook message ID is NOT its send API X-Message-Id. A signed
   // batch+attempt correlation authenticates the first message ID; durable binding
   // rejects a later conflicting ID. Resend supplies its actual send receipt ID.
   if(provider==='sendgrid'&&(!policy.attemptId||event.product!=='penny'||!event.deliveryId))return false
   const predicate=provider==='sendgrid'?'a.id=? AND b.id=?':'a.provider_message_id=?'
   const values=[...(provider==='sendgrid'?[policy.attemptId!,event.deliveryId!]:[event.providerMessageId]),provider,event.recipients[0],event.providerMessageId]
   const sql=`SELECT json_array(a.id,b.id,b.address_id,a.recipient_email,a.provider,a.state,a.event_message_id,p.email,p.verification_epoch,a.recipient_verification_epoch,p.suppressed_at) AS raw FROM notification_attempts a
    JOIN notification_batches b ON b.id=a.batch_id JOIN requester_addresses p ON p.id=b.address_id
    WHERE ${predicate} AND a.provider=? AND a.recipient_email=? AND p.email=a.recipient_email
    AND a.state IN('sending','accepted','unknown') AND (a.event_message_id IS NULL OR a.event_message_id=?)`
   let raw=(await db.prepare(sql).bind(...values).first<{raw:string}>())?.raw
   let ownerSql=sql,outboxId:string|undefined
   if(!raw){
    ownerSql=`SELECT json_array(a.id,b.id,b.address_id,a.recipient_email,a.provider,a.state,a.event_message_id,p.email,p.verification_epoch,a.recipient_verification_epoch,p.suppressed_at) AS raw FROM notification_outbox_attempts a
     JOIN notification_outbox b ON b.id=a.outbox_id JOIN requester_addresses p ON p.id=b.address_id
     WHERE ${predicate} AND b.release_snapshot_id IS NOT NULL AND a.provider=? AND a.recipient_email=? AND p.email=a.recipient_email
     AND a.state IN('sending','accepted','delivered','unknown','suppressed','failed') AND (a.event_message_id IS NULL OR a.event_message_id=?)`
    raw=(await db.prepare(ownerSql).bind(...values).first<{raw:string}>())?.raw
    if(raw)outboxId=JSON.parse(raw)[1]
   }
   if(!raw)return false
   const [attemptId,deliveryId,addressId,,,,,,currentEpoch,sentEpoch]=JSON.parse(raw)
   const batchId=outboxId?null:deliveryId
   if(authorized.some(item=>item.attemptId===attemptId&&item.event.providerMessageId!==event.providerMessageId))return false
   authorized.push({event,attemptId,batchId,outboxId,addressId,suppress:policy.suppress&&currentEpoch===sentEpoch,witness:{sql:ownerSql,values,raw}})
   return true
  }})
 try {return await intake.ingestWebhook({rawBody,headers:request.headers})}
 catch(error){
  const code=(error as {code?:string}).code
  throw new NativeError(code==='event_storage_failed'?'mail_event_storage_unavailable':'invalid_mail_event',code==='event_storage_failed'?503:400)
 }
}
