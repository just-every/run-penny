import {workspaceClock} from '../settings/workspace-clock'
import type { PennyRuntime } from '@/core/app/runtime'
import { createUlid } from '@/core/shared/ulid'
import { authMail } from '../auth/mail'
import { retryAt,retryState,safeValidationCode } from './attempt-policy'

/** Date-only review dates expire after that calendar date in the workspace zone. */
export function reviewDatePassed(reviewAt:string,now:Date,timezone:string):boolean{
 if(reviewAt.length!==10)return Date.parse(reviewAt)<now.getTime()
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now)
 const part=(type:string)=>parts.find(p=>p.type===type)!.value
 return reviewAt<`${part('year')}-${part('month')}-${part('day')}`
}
export async function drainDecisionReviews(runtime:PennyRuntime,clock=Date.now):Promise<void>{
 const db=runtime.database.binding,now=new Date(clock()).toISOString()
 if((await db.prepare('SELECT phase FROM data_state WHERE singleton=1').first<{phase:string}>())?.phase!=='idle')return
 const {timezone}=await workspaceClock(runtime)
 const candidates=await db.prepare("SELECT id,review_at AS reviewAt,review_generation AS generation FROM decisions WHERE state='committed' AND review_at IS NOT NULL AND review_completed_at IS NULL").all<{id:string;reviewAt:string;generation:number}>()
 for(const decision of candidates.results){
  if(!reviewDatePassed(decision.reviewAt,new Date(clock()),timezone))continue
  const id=createUlid()
  await db.batch([
   db.prepare(`INSERT INTO decision_review_notifications(id,decision_id,owner_operator_id,review_generation,review_at,state,next_attempt_at,created_at,updated_at)
    SELECT ?,id,owner_operator_id,review_generation,review_at,'queued',?,?,? FROM decisions WHERE id=? AND state='committed' AND review_at=? AND review_generation=? AND review_completed_at IS NULL AND owner_operator_id IS NOT NULL AND (SELECT phase FROM data_state WHERE singleton=1)='idle' ON CONFLICT(decision_id,review_generation) DO NOTHING`).bind(id,now,now,now,decision.id,decision.reviewAt,decision.generation),
   db.prepare(`UPDATE decisions SET state='review_due',updated_at=? WHERE id=? AND state='committed' AND review_at=? AND review_generation=? AND review_completed_at IS NULL AND EXISTS(SELECT 1 FROM decision_review_notifications n WHERE n.decision_id=decisions.id AND n.review_generation=decisions.review_generation) AND (SELECT phase FROM data_state WHERE singleton=1)='idle'`).bind(now,decision.id,decision.reviewAt,decision.generation),
   db.prepare(`INSERT INTO audit_entries(id,actor_type,action,entity_type,entity_id,details_json,occurred_at,created_at,updated_at) SELECT ?,'system','decision.review_due','decision',decision_id,?, ?,?,? FROM decision_review_notifications WHERE id=?`).bind(createUlid(),JSON.stringify({notificationId:id}),now,now,now,id),
  ])
 }
 await db.prepare("UPDATE decision_review_notifications SET state='unknown',failure_reason='attempt_interrupted_review_required',updated_at=? WHERE state='sending' AND updated_at<?").bind(now,new Date(clock()-300000).toISOString()).run()
 const due=await db.prepare("SELECT id,attempt_count AS attempts,created_at AS createdAt FROM decision_review_notifications WHERE state='queued' AND next_attempt_at<=? ORDER BY next_attempt_at,id LIMIT 50").bind(now).all<{id:string;attempts:number;createdAt:string}>()
 for(const row of due.results)await sendReview(runtime,row,clock)
}
async function sendReview(runtime:PennyRuntime,row:{id:string;attempts:number;createdAt:string},clock:()=>number){
 const db=runtime.database.binding,now=new Date(clock()).toISOString(),claim=createUlid()
 const owned=await db.prepare("UPDATE decision_review_notifications SET state='sending',claim_id=?,attempt_count=attempt_count+1,updated_at=? WHERE id=? AND state='queued' AND next_attempt_at<=? AND (SELECT phase FROM data_state WHERE singleton=1)='idle' RETURNING 1 AS affected").bind(claim,now,row.id,now).all()
 if(owned.results.length!==1)return
 const finish=(state:string,reason:string|null,receipt:string|null=null)=>db.batch([
  db.prepare("UPDATE decision_review_notifications SET state=?,failure_reason=?,provider_message_id=?,next_attempt_at=?,updated_at=? WHERE id=? AND claim_id=? AND state='sending'").bind(state,reason,receipt,state==='queued'?retryAt(clock(),row.attempts):new Date(clock()).toISOString(),new Date(clock()).toISOString(),row.id,claim),
  db.prepare("INSERT INTO audit_entries(id,actor_type,action,entity_type,entity_id,details_json,occurred_at,created_at,updated_at) SELECT ?,'system','decision.review_notification','decision',decision_id,?,?,?,? FROM decision_review_notifications WHERE id=? AND claim_id=?").bind(createUlid(),JSON.stringify({state,reason}),now,now,now,row.id,claim),
 ])
 try{
  // A hard bounce or complaint stops review mail until the owner signs in by email again.
  const recipient=await db.prepare(`SELECT o.email,d.title,d.slug,EXISTS(SELECT 1 FROM operator_mail_suppressions s WHERE s.operator_id=o.id AND NOT EXISTS(SELECT 1 FROM oa_operators native JOIN oa_sessions session ON session.operator_id=native.id
   WHERE native.email=o.email AND session.kind='native' AND session.created_at>(julianday(s.suppressed_at)-2440587.5)*86400000)) AS suppressed FROM decision_review_notifications n JOIN operators o ON o.id=n.owner_operator_id JOIN decisions d ON d.id=n.decision_id
   WHERE n.id=? AND n.claim_id=? AND EXISTS(SELECT 1 FROM oa_operators native WHERE native.email=o.email AND native.status='active')`).bind(row.id,claim).first<{email:string;title:string;slug:string;suppressed:number}>()
  if(!recipient){await finish('failed','owner_no_longer_active');return}
  if(recipient.suppressed){await finish('failed','recipient_suppressed');return}
  const mail=authMail(runtime)
  if(!mail){await finish('failed','mail_configuration_missing');return}
  const result=await mail.send({...(runtime.configuration.mailProvider==='sendgrid'?{customArgs:{rer_product:'penny',rer_penny_attempt:claim}}:{}),deliveryId:row.id,from:runtime.configuration.mailFrom!,to:[recipient.email],subject:`Decision review due: ${recipient.title.replace(/\s+/g,' ')}`,text:`Your decision is due for review. Record a review note and a new review date, or revise the commitment.\n\n${recipient.title}\n${runtime.configuration.appOrigin}/app/decisions/${recipient.slug}`,headers:{'Auto-Submitted':'auto-generated'}})
  // Explicit local capture completes the send, without inventing a provider receipt.
  if(result.status==='accepted'||result.status==='development'){await finish('accepted',null,result.providerMessageId);return}
  if(result.status==='rejected'||result.status==='rate_limited'){await finish(clock()-Date.parse(row.createdAt)>=3600000?'failed':retryState(row.attempts),result.code??result.status);return}
  await finish('unknown',result.code??'provider_outcome_unknown')
 }catch(error){const code=safeValidationCode(error);await finish(code?'failed':'unknown',code??'attempt_outcome_unknown_review_required')}
}
export interface ReviewNotification {id:string;decisionId:string;title:string;decisionSlug:string;reviewAt:string;state:'queued'|'sending'|'accepted'|'delivered'|'suppressed'|'failed'|'unknown'|'held';failureReason:string|null;createdAt:string}
export async function reviewNotifications(db:D1Database,owner:string):Promise<ReviewNotification[]>{
 return (await db.prepare(`SELECT n.id,n.decision_id AS decisionId,d.title,d.slug AS decisionSlug,n.review_at AS reviewAt,CASE WHEN n.state IN('accepted','unknown') AND f.state IN('delivered','suppressed','failed') THEN f.state ELSE n.state END AS state,n.failure_reason AS failureReason,n.created_at AS createdAt
  FROM decision_review_notifications n JOIN decisions d ON d.id=n.decision_id LEFT JOIN decision_review_delivery_facts f ON f.notification_id=n.id WHERE n.owner_operator_id=? AND n.dismissed_at IS NULL ORDER BY n.created_at DESC,n.id DESC`).bind(owner).all<ReviewNotification>()).results
}
