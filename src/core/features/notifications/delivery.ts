import {requesterMailFooter,mailIdentity,identityHeaders} from '../settings/mail-identity'
import type { PennyRuntime } from '@/core/app/runtime'
import { providerMail,mailUnsubscribe } from '@/core/features/auth/mail'
import { createUlid } from '@/core/shared/ulid'
import {requesterQuietHours} from '../settings/workspace-clock'
import { admitDelivery } from './delivery-admission'
import { prepareBatches } from './batches'
import { unsubscribeUrl } from './unsubscribe'
import { notificationContent, type NotificationEvent } from './content'
import { retryState, retryAt as nextRetryAt, safeValidationCode } from './attempt-policy'
import { settleRestoredBatch } from './restored-batches'
import { systemDeliveryAudit } from './delivery-audit'
interface Batch {id:string;attemptCount:number;requesterId:string;addressId:string;requestId:string;firstAttemptAt:string|null;failureReason:string|null}

/** Run by the Worker Cron. A durable claim owns each outbound attempt. */
export async function drainNotifications(runtime:PennyRuntime, clock=Date.now):Promise<void> {
 const db=runtime.database.binding,now=new Date(clock()).toISOString()
 if((await db.prepare('SELECT phase FROM data_state WHERE singleton=1').first<{phase:string}>())?.phase!=='idle')return
 // A process can die after its provider accepted. Never reclaim such an attempt.
 await db.batch([
  db.prepare(`UPDATE notification_attempts SET state='unknown',failure_reason='attempt_interrupted_review_required',updated_at=?
   WHERE state='sending' AND created_at<?`).bind(now,new Date(clock()-300000).toISOString()),
  db.prepare(`UPDATE notification_batches SET state='unknown',failure_reason='attempt_interrupted_review_required',updated_at=?
   WHERE state='sending' AND claim_id IN(SELECT id FROM notification_attempts WHERE state='unknown')`).bind(now),
 ])
 await prepareBatches(db,now)
 if(await requesterQuietHours(runtime,new Date(clock())))return
 // A queued release note to the same address about the same request closes its open
 // window now, so this drain sends the status digest before the release drain that follows.
 await db.prepare(`UPDATE notification_batches SET window_end=?,next_attempt_at=?,updated_at=?
  WHERE state='queued' AND attempt_count=0 AND claim_id IS NULL AND failure_reason IS NULL AND next_attempt_at>?
  AND EXISTS(SELECT 1 FROM notification_outbox n JOIN release_recipient_contexts c ON c.snapshot_id=n.release_snapshot_id
   WHERE n.delivery_state='queued' AND n.address_id=notification_batches.address_id AND c.request_id=notification_batches.request_id)`).bind(now,now,now,now).run()
 const rows=await db.prepare(`SELECT id,requester_id AS requesterId,address_id AS addressId,request_id AS requestId,attempt_count AS attemptCount,failure_reason AS failureReason,
 (SELECT MIN(created_at) FROM notification_attempts a WHERE a.batch_id=notification_batches.id
  AND NOT (a.state='suppressed' AND a.failure_reason IS 'quiet_hours')) AS firstAttemptAt
 FROM notification_batches WHERE state='queued' AND next_attempt_at<=? ORDER BY next_attempt_at,id LIMIT 50`).bind(now).all<Batch>()
 for(const batch of rows.results)await deliver(runtime,batch,clock)
}
async function deliver(runtime:PennyRuntime,batch:Batch,clock:()=>number){
 const db=runtime.database.binding,now=new Date(clock()).toISOString(),claim=createUlid(),provider=runtime.configuration.mailProvider??'unconfigured'
 if(batch.failureReason==='restored_delivery_review_required'){await settleRestoredBatch(db,batch.id,now);return}
 if(batch.firstAttemptAt && clock()-Date.parse(batch.firstAttemptAt)>=3600000){
  await db.prepare("UPDATE notification_batches SET state='failed',failure_reason='retry_window_exhausted',updated_at=? WHERE id=? AND state='queued'").bind(now,batch.id).run();return
 }
 const [owned]=await db.batch([
  db.prepare(`UPDATE notification_batches SET state='sending',claim_id=?,attempt_count=attempt_count+1,provider=?,updated_at=?
   WHERE id=? AND state='queued' AND next_attempt_at<=? AND failure_reason IS NOT 'restored_delivery_review_required'
   AND NOT EXISTS(SELECT 1 FROM notification_batches active WHERE active.requester_id=notification_batches.requester_id
     AND active.request_id=notification_batches.request_id AND active.state='sending' AND active.id!=notification_batches.id)
   AND (SELECT phase FROM data_state WHERE singleton=1)='idle' RETURNING 1 AS affected`).bind(claim,provider,now,batch.id,now),
  db.prepare(`INSERT INTO notification_attempts(id,batch_id,provider,state,created_at,updated_at)
   SELECT ?,id,?,'sending',?,? FROM notification_batches WHERE id=? AND state='sending' AND claim_id=?`).bind(claim,provider,now,now,batch.id,claim),
 ])
 if(owned.results.length!==1)return
 const finish=async(state:'accepted'|'suppressed'|'unknown'|'failed'|'queued',reason:string|null,receipt:string|null=null,attemptState:string=state,deferred=false)=>{
  const retryAt=state==='queued'?nextRetryAt(clock(),batch.attemptCount):now
  await db.batch([
   db.prepare('UPDATE notification_attempts SET state=?,provider_message_id=?,failure_reason=?,updated_at=? WHERE id=? AND state=\'sending\'')
    .bind(attemptState,receipt,reason,new Date(clock()).toISOString(),claim),
   // BASE-OPS-005: the automated send outlives the batch an erasure removes, with an anonymised reference.
   systemDeliveryAudit(db,'notifications.requester','notification.delivery_attempted','notification_batch',batch.id,{state:attemptState,reason}),
   db.prepare(`UPDATE notification_batches SET state=?,provider_message_id=?,failure_reason=?,next_attempt_at=?,updated_at=?,attempt_count=attempt_count-?
    WHERE id=? AND claim_id=? AND state='sending'`).bind(state,receipt,reason,retryAt,new Date(clock()).toISOString(),deferred?1:0,batch.id,claim),
  ])
 }
 try {
  const recipient=await notificationContent(db,batch.id)
  if(!recipient){await finish('suppressed','recipient_no_longer_eligible');return}
  const sender=providerMail(runtime)
  if(!sender){await finish('failed','mail_configuration_missing');return}
  const mailHeaders=identityHeaders(await mailIdentity(runtime),runtime.configuration.mailFrom!)
  const footer=await requesterMailFooter(runtime,batch.requesterId,batch.addressId,recipient.requestId)
  const requestLink=await unsubscribeUrl(runtime,{...batch,email:recipient.email},recipient.requestId)
  const globalLink=await unsubscribeUrl(runtime,{...batch,email:recipient.email},'all')
  // This claim made no provider call: retain its audit and sealed membership,
  // but return its reserved attempt budget without starting a retry clock.
  if(await requesterQuietHours(runtime,new Date(clock()))){await finish('queued','quiet_hours',null,'suppressed',true);return}
  // Final eligibility, payload and durable recipient snapshot commit together.
  // HTTP starts only for a successful admission; there is no later storage await.
  const admission=await admitDelivery(db,batch.id,claim,recipient.email),admitted=admission.recipient
  if(!admitted||admitted.requestId!==recipient.requestId){await finish('suppressed','eligibility_changed');return}
  const events=JSON.parse(admitted.events) as NotificationEvent[],origin=runtime.configuration.appOrigin
  if(!events.length){await finish('suppressed','no_public_events');return}
  if(!admission.owned){await finish('suppressed','eligibility_changed');return}
  const result=await sender.send({...(provider==='sendgrid'?{customArgs:{rer_product:'penny',rer_penny_attempt:claim}}:{}),deliveryId:batch.id,...mailHeaders,to:[recipient.email],subject:`Updates: ${admitted.title.replace(/\s+/g,' ')}`,
   text:`${admitted.title}\n\n${events.map(e=>`${e.kind==='status'?'Status update':'Public reply'}\n${e.body}${e.requests?.length?`\n\nYour requests:\n${e.requests.map(r=>`${r.title}: ${origin}/portal/feedback/${r.slug}`).join('\n')}`:''}`).join('\n\n')}\n\nView feedback: ${origin}/portal/feedback/${admitted.slug}\n\nMute this request: ${requestLink}\nUnsubscribe from all requester email: ${globalLink}${footer}`,
   unsubscribe:mailUnsubscribe(runtime,globalLink),headers:{'Auto-Submitted':'auto-generated'}})
  if(result.status==='accepted'||result.status==='development'){await finish('accepted',null,result.providerMessageId);return}
  if(result.status==='rejected'||result.status==='rate_limited'){
   await finish(retryState(batch.attemptCount),result.code??result.status,null,result.status);return
  }
  await finish('unknown',result.code??'provider_outcome_unknown')
 }catch(error){
  // Base validation fails before any provider effect and emits fixed safe codes.
  const code=safeValidationCode(error)
  if(code){
   await finish(retryState(batch.attemptCount),code,null,'rejected');return
  }
  // Includes transport exceptions and a failed receipt write after acceptance.
  // Persisted sending ownership still prevents replay if this write also fails.
  await finish('unknown','attempt_outcome_unknown_review_required')
 }
}
