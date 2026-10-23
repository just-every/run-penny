import type {PennyRuntime} from '@/core/app/runtime'
import {providerMail,mailUnsubscribe} from '../auth/mail'
import {requesterMailFooter,mailIdentity,identityHeaders} from '../settings/mail-identity'
import {requesterQuietHours} from '../settings/workspace-clock'
import {createUlid} from '@/core/shared/ulid'
import {retryAt,retryState,retryWindowMs,safeValidationCode} from './attempt-policy'
import {unsubscribeUrl} from './unsubscribe'
import {systemDeliveryAudit} from './delivery-audit'
import {weeklyContent,admitWeekly} from './weekly-content'
interface Pending {id:string;requesterId:string;addressId:string;attemptCount:number;firstAttemptAt:string|null}
export async function drainWeekly(runtime:PennyRuntime,clock=Date.now){
 const db=runtime.database.binding,now=new Date(clock()).toISOString()
 if((await db.prepare('SELECT phase FROM data_state WHERE singleton=1').first<{phase:string}>())?.phase!=='idle'||await requesterQuietHours(runtime,new Date(clock())))return
 const rows=await db.prepare(`SELECT id,requester_id AS requesterId,address_id AS addressId,attempt_count AS attemptCount,first_attempt_at AS firstAttemptAt
 FROM notification_outbox WHERE event_type='weekly_digest' AND delivery_state='queued' AND claim_id IS NULL AND available_at<=? ORDER BY available_at,id LIMIT 50`).bind(now).all<Pending>()
 for(const row of rows.results)await deliver(runtime,row,clock)
}
async function deliver(runtime:PennyRuntime,row:Pending,clock:()=>number){
 const db=runtime.database.binding,at=new Date(clock()).toISOString(),claim=createUlid(),provider=runtime.configuration.mailProvider??'unconfigured'
 if(row.firstAttemptAt&&clock()-Date.parse(row.firstAttemptAt)>=retryWindowMs){await db.prepare("UPDATE notification_outbox SET delivery_state='failed',failure_reason='retry_window_exhausted',updated_at=? WHERE id=? AND delivery_state='queued' AND claim_id IS NULL").bind(at,row.id).run();return}
 const [owned]=await db.batch([
  db.prepare(`UPDATE notification_outbox SET claim_id=?,attempt_count=attempt_count+1,provider=?,updated_at=? WHERE id=? AND delivery_state='queued' AND claim_id IS NULL AND available_at<=? AND attempt_count=? AND (SELECT phase FROM data_state WHERE singleton=1)='idle' RETURNING 1`).bind(claim,provider,at,row.id,at,row.attemptCount),
  db.prepare("INSERT INTO notification_outbox_attempts(id,outbox_id,provider,state,created_at,updated_at) SELECT ?,id,?,'sending',?,? FROM notification_outbox WHERE id=? AND claim_id=?").bind(claim,provider,at,at,row.id,claim),
 ])
 if(owned.results.length!==1)return
 const finish=async(state:'accepted'|'suppressed'|'unknown'|'failed'|'queued',reason:string|null,receipt:string|null=null,attemptState:string=state,deferred=false)=>{
  const now=new Date(clock()).toISOString()
  await db.batch([
   db.prepare("UPDATE notification_outbox_attempts SET state=?,failure_reason=?,provider_message_id=?,updated_at=? WHERE id=? AND state='sending'").bind(attemptState,reason,receipt,now,claim),
   systemDeliveryAudit(db,'notifications.weekly','notification.weekly_attempted','notification_outbox',row.id,{state:attemptState,reason}),
   db.prepare(`UPDATE notification_outbox SET delivery_state=?,failure_reason=?,provider_message_id=COALESCE(provider_message_id,?),available_at=?,updated_at=?,claim_id=CASE WHEN ?='queued' THEN NULL ELSE claim_id END,
   attempt_count=attempt_count-?,first_attempt_at=CASE WHEN ?=1 THEN first_attempt_at ELSE COALESCE(first_attempt_at,?) END,accepted_at=CASE WHEN ?='accepted' THEN COALESCE(accepted_at,?) ELSE accepted_at END
   WHERE id=? AND claim_id=? AND delivery_state='queued'`).bind(state,reason,receipt,state==='queued'?retryAt(clock(),row.attemptCount):now,now,state,Number(deferred),Number(deferred),at,state,now,row.id,claim),
  ])
 }
 try{
  const initial=await weeklyContent(db,row.id)
  if(!initial){await finish('suppressed','no_eligible_public_changes');return}
  const sender=providerMail(runtime)
  if(!sender){await finish('failed','mail_configuration_missing');return}
  const headers=identityHeaders(await mailIdentity(runtime),runtime.configuration.mailFrom!),items=JSON.parse(initial.items) as {title:string;body:string;path:string}[]
  const requestSlugs=items.filter(item=>item.path.startsWith('/portal/feedback/')).map(item=>item.path.slice('/portal/feedback/'.length))
  const footer=await requesterMailFooter(runtime,row.requesterId,row.addressId,undefined,requestSlugs),link=await unsubscribeUrl(runtime,{...row,email:initial.email},'all')
  if(await requesterQuietHours(runtime,new Date(clock()))){await finish('queued','quiet_hours',null,'suppressed',true);return}
  const admission=await admitWeekly(db,row.id,claim,initial.email,initial.verificationEpoch)
  if(!admission.owned||!admission.content){await finish('suppressed','eligibility_changed');return}
  const content=admission.content,publicItems=JSON.parse(content.items) as {title:string;body:string;path:string}[]
  const result=await sender.send({...(provider==='sendgrid'?{customArgs:{rer_product:'penny',rer_penny_attempt:claim}}:{}),deliveryId:row.id,...headers,to:[content.email],subject:'Your weekly summary',
   text:`Weekly summary\n\n${publicItems.map(item=>`${item.title}\n${item.body}\n${runtime.configuration.appOrigin}${item.path}`).join('\n\n')}\n\n${content.explicit?'You chose Weekly summary.':'You receive updates on requests you voted for.'}\nUnsubscribe from all requester email: ${link}${footer}`,
   unsubscribe:mailUnsubscribe(runtime,link),headers:{'Auto-Submitted':'auto-generated'}})
  if(result.status==='accepted'||result.status==='development'){await finish('accepted',null,result.providerMessageId);return}
  if(result.status==='rejected'||result.status==='rate_limited'){await finish(retryState(row.attemptCount),result.code??result.status,null,result.status);return}
  await finish('unknown',result.code??'provider_outcome_unknown')
 }catch(error){const code=safeValidationCode(error);await finish(code?retryState(row.attemptCount):'unknown',code??'attempt_outcome_unknown_review_required',null,code?'rejected':'unknown')}
}
