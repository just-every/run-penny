import type { MailEvent } from './event-intake'

/** Who a signed provider event is about. `requester` and `operator` owners are
 * address-level: an asynchronous bounce, complaint or unsubscribe that names no
 * message Penny can find, for an address Penny has mailed through this provider.
 * The witness query re-runs inside the commit, so a change between correlation
 * and commit aborts every effect. */
export interface MailOwner {
 kind:'batch'|'outbox'|'review'|'requester'|'operator'
 attemptId:string|null;batchId:string|null;outboxId:string|null;reviewId:string|null
 addressId:string|null;requesterId:string|null;operatorId:string|null
 /** The message key the event's delivery state is kept under. */
 messageKey:string;suppress:boolean;unsubscribe:boolean
 witness:{sql:string;values:(string|number|null)[];raw:string}
}
type Raw=(string|number|null)[]
const requesterColumns='p.id,p.requester_id,p.email,p.verification_epoch,p.verified_at'
// Attempts to a requester address: request updates (batches), releases and rejection notices (outbox).
const attempts={
 batch:{from:'notification_attempts a JOIN notification_batches b ON b.id=a.batch_id JOIN requester_addresses p ON p.id=b.address_id'},
 outbox:{from:'notification_outbox_attempts a JOIN notification_outbox b ON b.id=a.outbox_id JOIN requester_addresses p ON p.id=b.address_id'},
} as const
// SendGrid's event sg_message_id begins with the send API's X-Message-Id.
const prefix=(id:string)=>id.split('.')[0]

async function first(db:D1Database,sql:string,values:Raw):Promise<{sql:string;values:Raw;raw:string}|null>{
 const raw=(await db.prepare(sql).bind(...values).first<{raw:string}>())?.raw
 return raw?{sql,values,raw}:null
}
function requesterSuppression(event:MailEvent,row:Raw,sentEpoch:number|null):boolean{
 const [,,email,epoch,verifiedAt]=row as [string,string,string,number,string|null]
 if(!event.hard||email!==event.recipient)return false
 // A later verification of the address outranks an older bounce or complaint:
 // exactly by the epoch the attempt recorded, else by time (providers report
 // whole seconds).
 if(sentEpoch!==null)return sentEpoch===epoch
 return verifiedAt===null||Math.floor(Date.parse(verifiedAt)/1000)*1000<=event.occurredAt
}

export async function correlate(db:D1Database,event:MailEvent):Promise<MailOwner|null|'conflict'>{
 const message=event.providerMessageId,args=event.provider==='sendgrid'&&event.product==='penny'&&event.attemptId&&event.deliveryId
 const ids=message?[message,message,prefix(message)]:[]
 // Penny's own signed arguments first, then the provider's message ID, which
 // also finds attempts sent before Penny added those arguments.
 const matchers=(byArgs:string,byMessage:string,argValues:Raw)=>[...(args?[{match:byArgs,values:argValues}]:[]),...(message?[{match:byMessage,values:ids as Raw}]:[])]
 for(const kind of ['batch','outbox'] as const)for(const {match,values} of matchers('a.id=? AND b.id=?','(a.event_message_id=? OR a.provider_message_id=? OR a.provider_message_id=?)',[event.attemptId,event.deliveryId])){
  const found=await first(db,`SELECT json_array(a.id,b.id,a.event_message_id,a.provider_message_id,a.recipient_verification_epoch,${requesterColumns}) AS raw FROM ${attempts[kind].from}
   WHERE ${match} AND a.provider=? AND p.email=? AND (a.recipient_email IS NULL OR a.recipient_email=p.email)`,[...values,event.provider,event.recipient])
  if(!found)continue
  const [attemptId,deliveryId,bound,sent,sentEpoch,...address]=JSON.parse(found.raw) as Raw
  // One attempt has one provider message; a different one is not this attempt's.
  if(message&&bound!==null&&bound!==message)return 'conflict'
  return {kind,attemptId:String(attemptId),batchId:kind==='batch'?String(deliveryId):null,outboxId:kind==='outbox'?String(deliveryId):null,reviewId:null,
   addressId:String(address[0]),requesterId:String(address[1]),operatorId:null,messageKey:message??String(bound??sent??`attempt:${attemptId}`),
   suppress:requesterSuppression(event,address,sentEpoch as number|null),unsubscribe:event.unsubscribe,witness:found}
 }
 // Decision-review mail to the decision's owner (NOTIFY-003).
 for(const {match,values} of matchers('n.id=? AND n.claim_id=?','(f.event_message_id=? OR n.provider_message_id=? OR n.provider_message_id=?)',[event.deliveryId,event.attemptId])){
  const found=await first(db,`SELECT json_array(n.id,o.id,f.event_message_id,n.provider_message_id) AS raw FROM decision_review_notifications n JOIN operators o ON o.id=n.owner_operator_id
   LEFT JOIN decision_review_delivery_facts f ON f.notification_id=n.id WHERE ${match} AND lower(o.email)=lower(?)`,[...values,event.recipient])
  if(!found)continue
  const [reviewId,operatorId,bound,sent]=JSON.parse(found.raw) as Raw
  if(message&&bound!==null&&bound!==message)return 'conflict'
  return {kind:'review',attemptId:null,batchId:null,outboxId:null,reviewId:String(reviewId),addressId:null,requesterId:null,operatorId:String(operatorId),
   messageKey:message??String(bound??sent??`review:${reviewId}`),suppress:event.hard,unsubscribe:false,witness:found}
 }
 // Another product's signed arguments mark another sender's mail.
 if((!event.hard&&!event.unsubscribe)||(event.product!==null&&event.product!=='penny'))return null
 // Only attempts that may have reached the provider count; a refused, deferred
 // or never-called attempt sent nothing. An event naming another message is
 // another sender's mail, unless Penny holds an attempt to this address that
 // may have been sent but whose provider message it never learned.
 const unidentified=message?" AND a.state IN('sending','unknown') AND a.provider_message_id IS NULL AND a.event_message_id IS NULL":" AND a.state IN('sending','accepted','delivered','unknown')"
 const requester=await first(db,`SELECT json_array(${requesterColumns}) AS raw FROM requester_addresses p WHERE p.email=?
  AND (EXISTS(SELECT 1 FROM notification_batches b JOIN notification_attempts a ON a.batch_id=b.id WHERE b.address_id=p.id AND a.provider=?${unidentified})
   OR EXISTS(SELECT 1 FROM notification_outbox b JOIN notification_outbox_attempts a ON a.outbox_id=b.id WHERE b.address_id=p.id AND a.provider=?${unidentified}))`,[event.recipient,event.provider,event.provider])
 if(requester){
  const address=JSON.parse(requester.raw) as Raw
  return {kind:'requester',attemptId:null,batchId:null,outboxId:null,reviewId:null,addressId:String(address[0]),requesterId:String(address[1]),operatorId:null,
   messageKey:`address:${address[0]}`,suppress:requesterSuppression(event,address,null),unsubscribe:event.unsubscribe,witness:requester}
 }
 const operator=event.hard?await first(db,`SELECT json_array(o.id) AS raw FROM operators o WHERE lower(o.email)=lower(?)
  AND EXISTS(SELECT 1 FROM decision_review_notifications n WHERE n.owner_operator_id=o.id AND n.attempt_count>0${message?" AND n.state IN('sending','unknown') AND n.provider_message_id IS NULL":" AND n.state IN('sending','accepted','unknown')"})`,[event.recipient]):null
 if(operator){
  const [operatorId]=JSON.parse(operator.raw) as Raw
  return {kind:'operator',attemptId:null,batchId:null,outboxId:null,reviewId:null,addressId:null,requesterId:null,operatorId:String(operatorId),
   messageKey:`operator:${operatorId}`,suppress:true,unsubscribe:false,witness:operator}
 }
 return null
}
