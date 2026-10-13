import type { PennyRuntime } from '@/core/app/runtime'
import { authMail, mailUnsubscribe } from '../auth/mail'
import { createUlid } from '@/core/shared/ulid'
import { quietHours } from './eligibility'
import { retryState, retryWindowMs, safeValidationCode } from './attempt-policy'
import { unsubscribeUrl } from './unsubscribe'
import { admitRejection, rejectionContext } from './rejection-admission'
import { recoverRejections, rejectionAudit, settleRejection, type RejectionIntent } from './rejection-attempt'

/** A separate private-author queue, never a public notification event/batch. */
export async function drainRejectionNotices(runtime:PennyRuntime,clock=Date.now){
 const db=runtime.database.binding,now=new Date(clock()).toISOString()
 if((await db.prepare('SELECT phase FROM data_state WHERE singleton=1').first<{phase:string}>())?.phase!=='idle')return
 await recoverRejections(db,now,new Date(clock()-300000).toISOString())
 if(quietHours(new Date(clock()),runtime.configuration.workspaceTimezone))return
 const rows=await db.prepare(`SELECT id,attempt_count AS attemptCount,first_attempt_at AS firstAttemptAt FROM notification_outbox
  WHERE event_type='moderation_rejected' AND delivery_state='queued' AND claim_id IS NULL AND available_at<=?
  ORDER BY available_at,id LIMIT 50`).bind(now).all<RejectionIntent>()
 for(const row of rows.results)await deliver(runtime,row,clock)
}
async function deliver(runtime:PennyRuntime,row:RejectionIntent,clock:()=>number){
 const db=runtime.database.binding,now=new Date(clock()).toISOString(),claim=createUlid(),provider=runtime.configuration.mailProvider??'unconfigured'
 const [owned]=await db.batch([
  db.prepare(`UPDATE notification_outbox SET claim_id=?,attempt_count=attempt_count+1,provider=?,updated_at=?
   WHERE id=? AND event_type='moderation_rejected' AND delivery_state='queued' AND claim_id IS NULL AND available_at<=? AND attempt_count=?
   AND (SELECT phase FROM data_state WHERE singleton=1)='idle' RETURNING 1 AS affected`).bind(claim,provider,now,row.id,now,row.attemptCount),
  db.prepare(`INSERT INTO notification_outbox_attempts(id,outbox_id,provider,state,created_at,updated_at)
   SELECT ?,id,?,'sending',?,? FROM notification_outbox WHERE id=? AND claim_id=?`).bind(claim,provider,now,now,row.id,claim),
  rejectionAudit(db,row.id,claim,now,'sending',null),
 ])
 if(owned.results.length!==1)return
 const finish=settleRejection(db,row,claim,clock)
 try{
  if(row.firstAttemptAt&&clock()-Date.parse(row.firstAttemptAt)>=retryWindowMs){await finish('failed','retry_window_exhausted');return}
  const initial=await rejectionContext(db,row.id)
  if(!initial||initial.suppressionReason||!initial.email||!initial.addressId||!initial.requesterId){await finish('suppressed',initial?.suppressionReason??'recipient_no_longer_eligible');return}
  const sender=authMail(runtime)
  if(!sender){await finish('failed','mail_configuration_missing');return}
  const globalLink=await unsubscribeUrl(runtime,{email:initial.email,addressId:initial.addressId,requesterId:initial.requesterId},'all')
  if(quietHours(new Date(clock()),runtime.configuration.workspaceTimezone)){await finish('queued','quiet_hours',null,'suppressed',true);return}
  // Admission snapshots the current verified recipient atomically with content
  // and permission checks. No storage await separates admission from transport.
  const admission=await admitRejection(db,row.id,claim,initial.email,new Date(clock()).toISOString()),recipient=admission.context
  if(!admission.owned||!recipient?.email){await finish('suppressed',recipient?.suppressionReason??'eligibility_changed');return}
  const result=await sender.send({...(provider==='sendgrid'?{customArgs:{rer_product:'penny',rer_penny_attempt:claim}}:{}),deliveryId:row.id,
   from:runtime.configuration.mailFrom!,to:[recipient.email],subject:'Your feedback was reviewed',
   text:`An operator reviewed your feedback and did not approve it.\n\nReason:\n${recipient.reason}\n\nThis notice is private to you.\n\nUnsubscribe from all requester email: ${globalLink}`,
   unsubscribe:mailUnsubscribe(runtime,globalLink),headers:{'Auto-Submitted':'auto-generated'}})
  if(result.status==='accepted'||result.status==='development'){await finish('accepted',null,result.providerMessageId);return}
  if(result.status==='rejected'||result.status==='rate_limited'){await finish(retryState(row.attemptCount),result.code??result.status,null,result.status);return}
  await finish('unknown',result.code??'provider_outcome_unknown')
 }catch(error){
  const code=safeValidationCode(error)
  await finish(code?retryState(row.attemptCount):'unknown',code??'attempt_outcome_unknown_review_required',null,code?'rejected':'unknown')
 }
}
