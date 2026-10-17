import {requesterMailFooter,mailIdentity,identityHeaders} from '../settings/mail-identity'
import type { PennyRuntime } from '@/core/app/runtime'
import { providerMail,mailUnsubscribe } from '../auth/mail'
import { createUlid } from '@/core/shared/ulid'
import { quietHours } from '../notifications/eligibility'
import { retryAt,retryState,safeValidationCode,retryWindowMs } from '../notifications/attempt-policy'
import { unsubscribeUrl } from '../notifications/unsubscribe'
import { systemDeliveryAudit } from '../notifications/delivery-audit'
import { priorRequestUpdatesSettled } from './delivery-order'
interface Outbox {id:string;requesterId:string;addressId:string;attemptCount:number;firstAttemptAt:string|null}
import { releaseContent,admitReleaseDelivery } from './delivery-admission'
const releaseTypeLabel:Record<string,string>={new:'New',improved:'Improved',fixed:'Fixed'}
/** Same Cron and Base sender as request notifications; release versions have independent claims. */
export async function drainReleaseDeliveries(runtime:PennyRuntime,clock=Date.now){
 const db=runtime.database.binding,now=new Date(clock()).toISOString()
 if((await db.prepare('SELECT phase FROM data_state WHERE singleton=1').first<{phase:string}>())?.phase!=='idle')return
 await db.batch([
  db.prepare("UPDATE notification_outbox_attempts SET state='unknown',failure_reason='attempt_interrupted_review_required',updated_at=? WHERE state='sending' AND created_at<?").bind(now,new Date(clock()-300000).toISOString()),
  db.prepare("UPDATE notification_outbox SET delivery_state='unknown',failure_reason='attempt_interrupted_review_required',updated_at=? WHERE delivery_state='queued' AND claim_id IN(SELECT id FROM notification_outbox_attempts WHERE state='unknown')").bind(now),
 ])
 if(quietHours(new Date(clock()),runtime.configuration.workspaceTimezone))return
 const rows=await db.prepare(`SELECT id,requester_id AS requesterId,address_id AS addressId,attempt_count AS attemptCount,first_attempt_at AS firstAttemptAt
 FROM notification_outbox WHERE event_type='release_version' AND release_snapshot_id IS NOT NULL AND delivery_state='queued' AND claim_id IS NULL AND available_at<=? ORDER BY available_at,id LIMIT 50`).bind(now).all<Outbox>()
 for(const row of rows.results)await deliver(runtime,row,clock)
}
async function deliver(runtime:PennyRuntime,row:Outbox,clock:()=>number){
 const db=runtime.database.binding,now=new Date(clock()).toISOString(),claim=createUlid(),provider=runtime.configuration.mailProvider??'unconfigured'
 if(row.firstAttemptAt&&clock()-Date.parse(row.firstAttemptAt)>=retryWindowMs){await db.prepare("UPDATE notification_outbox SET delivery_state='failed',failure_reason='retry_window_exhausted',updated_at=? WHERE id=? AND delivery_state='queued' AND claim_id IS NULL").bind(now,row.id).run();return}
 const [owned]=await db.batch([
  db.prepare(`UPDATE notification_outbox SET claim_id=?,attempt_count=attempt_count+1,provider=?,updated_at=? WHERE id=? AND delivery_state='queued' AND claim_id IS NULL AND available_at<=? AND attempt_count=?
   AND ${priorRequestUpdatesSettled('notification_outbox')}
   AND (SELECT phase FROM data_state WHERE singleton=1)='idle' RETURNING 1 AS affected`).bind(claim,provider,now,row.id,now,row.attemptCount),
  db.prepare(`INSERT INTO notification_outbox_attempts(id,outbox_id,provider,state,created_at,updated_at) SELECT ?,id,?,'sending',?,? FROM notification_outbox WHERE id=? AND claim_id=?`).bind(claim,provider,now,now,row.id,claim),
 ])
 if(owned.results.length!==1)return
 const finish=async(state:'accepted'|'suppressed'|'unknown'|'failed'|'queued',reason:string|null,receipt:string|null=null,attemptState:string=state,deferred=false)=>{
  const at=new Date(clock()).toISOString()
  await db.batch([
   db.prepare('UPDATE notification_outbox_attempts SET provider_message_id=COALESCE(provider_message_id,?) WHERE id=?').bind(receipt,claim),
   db.prepare('UPDATE notification_outbox SET provider_message_id=COALESCE(provider_message_id,?) WHERE id=? AND claim_id=?').bind(receipt,row.id,claim),
   db.prepare("UPDATE notification_outbox_attempts SET state=?,failure_reason=?,provider_message_id=?,updated_at=? WHERE id=? AND state='sending'").bind(attemptState,reason,receipt,at,claim),
   systemDeliveryAudit(db,'releases.delivery','release.delivery_attempted','notification_outbox',row.id,{state:attemptState,reason}),
   db.prepare(`UPDATE notification_outbox SET delivery_state=?,failure_reason=?,provider_message_id=COALESCE(provider_message_id,?),available_at=?,updated_at=?,claim_id=CASE WHEN ?='queued' THEN NULL ELSE claim_id END,
    attempt_count=attempt_count-?,first_attempt_at=CASE WHEN ?=1 THEN first_attempt_at ELSE COALESCE(first_attempt_at,?) END,accepted_at=CASE WHEN ?='accepted' THEN COALESCE(accepted_at,?) ELSE accepted_at END
    WHERE id=? AND claim_id=? AND delivery_state='queued'`).bind(state,reason,receipt,state==='queued'?retryAt(clock(),row.attemptCount):at,at,state,deferred?1:0,deferred?1:0,now,state,at,row.id,claim),
  ])
 }
 try{
  const initial=await releaseContent(db,row.id)
  if(!initial.length){await finish('suppressed','recipient_no_longer_eligible');return}
  const sender=providerMail(runtime)
  if(!sender){await finish('failed','mail_configuration_missing');return}
  const mailHeaders=identityHeaders(await mailIdentity(runtime),runtime.configuration.mailFrom!)
  const footer=await requesterMailFooter(runtime,row.requesterId,row.addressId,undefined,initial.flatMap(context=>context.requestSlug?[context.requestSlug]:[]))
  const globalLink=await unsubscribeUrl(runtime,{...row,email:initial[0].email},'all')
  if(quietHours(new Date(clock()),runtime.configuration.workspaceTimezone)){await finish('queued','quiet_hours',null,'suppressed',true);return}
  const admission=await admitReleaseDelivery(db,row.id,claim,initial[0].email),contexts=admission.contexts,release=contexts[0]
  if(!admission.owned||!release){await finish('suppressed','eligibility_changed');return}
  const result=await sender.send({...(provider==='sendgrid'?{customArgs:{rer_product:'penny',rer_penny_attempt:claim}}:{}),deliveryId:row.id,...mailHeaders,to:[release.email],subject:release.title.replace(/\s+/g,' '),
   text:`${release.title}\n${releaseTypeLabel[release.releaseType]} · ${release.publicationDate}\n\n${release.body}\n${release.setupUrl?`${release.setupUrl}\n`:''}\nYour requests:\n${contexts.filter(c=>c.requestSlug).map(c=>`${c.requestTitle}: ${runtime.configuration.appOrigin}/portal/feedback/${c.requestSlug}`).join('\n')}\n\nRead update: ${runtime.configuration.appOrigin}/portal/updates/${release.slug}\nUnsubscribe from all requester email: ${globalLink}${footer}`,
   unsubscribe:mailUnsubscribe(runtime,globalLink),headers:{'Auto-Submitted':'auto-generated'}})
  if(result.status==='accepted'||result.status==='development'){await finish('accepted',null,result.providerMessageId);return}
  if(result.status==='rejected'||result.status==='rate_limited'){await finish(retryState(row.attemptCount),result.code??result.status,null,result.status);return}
  await finish('unknown',result.code??'provider_outcome_unknown')
 }catch(error){const code=safeValidationCode(error);await finish(code?retryState(row.attemptCount):'unknown',code??'attempt_outcome_unknown_review_required',null,code?'rejected':'unknown')}
}
