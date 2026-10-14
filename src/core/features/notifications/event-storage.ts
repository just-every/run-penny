import type { MailEvent } from './event-intake'
import type { MailOwner } from './event-correlation'
import { globalMuteStatement } from './unsubscribe'

export type OwnedEvent=MailOwner&{event:MailEvent}
export interface EventTransaction {get(key:string):Promise<unknown>;put(key:string,value:unknown):Promise<void>}
const deliveryState=(status:string,suppress:boolean)=>status==='delivered'?'delivered':['accepted','deferred'].includes(status)?'accepted':
 ['bounced','complained','failed','rejected'].includes(status)?(suppress?'suppressed':'failed'):null

/** Optimistic serializable D1 transaction. ALL reads (including absent keys and
 * correlation) are compared byte-for-byte before any write in one atomic batch.
 * A conflict aborts everything; provider retries start a fresh transaction. The
 * arrays below buffer an uncommitted transaction only; D1 is the durable store. */
export function eventStorage(db:D1Database,owned:OwnedEvent[]){
 return {async transaction<T>(work:(tx:EventTransaction)=>Promise<T>):Promise<T>{
  const reads:{key:string;raw:string|null}[]=[],writes:{key:string;raw:string;owner:OwnedEvent}[]=[]
  const tx:EventTransaction={
   async get(key){
    const buffered=writes.find(row=>row.key===key);if(buffered)return JSON.parse(buffered.raw)
    let observed=reads.find(row=>row.key===key)
    if(!observed){const row=await db.prepare('SELECT value_json FROM mail_event_records WHERE id=?').bind(key).first<{value_json:string}>();observed={key,raw:row?.value_json??null};reads.push(observed)}
    return observed.raw===null?undefined:JSON.parse(observed.raw)
   },
   async put(key,value){
    // Writes also observe absence/current value, even if the caller did not get first.
    await tx.get(key)
    const owner=owned.find(item=>item.event.eventId===(value as {eventId?:string}).eventId)
    if(!owner)throw new Error('event_write_unauthorized')
    const raw=JSON.stringify(value),existing=writes.find(row=>row.key===key)
    if(existing){existing.raw=raw;existing.owner=owner}else writes.push({key,raw,owner})
   },
  }
  const result=await work(tx),guard=crypto.randomUUID(),now=new Date().toISOString()
  const assert=(sql:string,values:(string|number|null)[])=>db.prepare(`INSERT INTO requester_write_guards(id,permitted) VALUES(?,CASE WHEN ${sql} THEN 1 ELSE 0 END) ON CONFLICT(id) DO UPDATE SET permitted=excluded.permitted`).bind(guard,...values)
  const statements=[assert("(SELECT phase FROM data_state WHERE singleton=1)='idle'",[]),
   ...reads.map(row=>assert('(SELECT value_json FROM mail_event_records WHERE id=?) IS ?',[row.key,row.raw])),
   ...owned.map(({witness})=>assert(`(${witness.sql}) IS ?`,[...witness.values,witness.raw])),
   ...writes.map(row=>db.prepare(`INSERT INTO mail_event_records(id,value_json,address_id,batch_id,outbox_id,operator_id,review_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET value_json=excluded.value_json,address_id=excluded.address_id,batch_id=excluded.batch_id,outbox_id=excluded.outbox_id,operator_id=excluded.operator_id,review_id=excluded.review_id,updated_at=excluded.updated_at`)
    .bind(row.key,row.raw,row.owner.addressId,row.owner.batchId,row.owner.outboxId,row.owner.addressId?null:row.owner.operatorId,row.owner.reviewId,now,now)),
  ]
  // Effects follow the first receipt of an event, never a duplicate.
  for(const {owner} of writes.filter(row=>row.key.startsWith('mail-events:v1:receipt:'))){
   const {event}=owner
   if(event.providerMessageId&&owner.attemptId)statements.push(db.prepare(`UPDATE ${owner.kind==='outbox'?'notification_outbox_attempts':'notification_attempts'} SET event_message_id=COALESCE(event_message_id,?),updated_at=? WHERE id=?`).bind(event.providerMessageId,now,owner.attemptId))
   if(event.providerMessageId&&owner.reviewId)statements.push(db.prepare(`INSERT INTO decision_review_delivery_facts(notification_id,state,event_message_id,accepted_at,created_at,updated_at) VALUES(?,'accepted',?,?,?,?)
    ON CONFLICT(notification_id) DO UPDATE SET event_message_id=COALESCE(event_message_id,excluded.event_message_id),updated_at=excluded.updated_at`).bind(owner.reviewId,event.providerMessageId,now,now,now))
   if(owner.suppress&&owner.addressId)statements.push(db.prepare('UPDATE requester_addresses SET suppressed_at=COALESCE(suppressed_at,?),updated_at=? WHERE id=?').bind(now,now,owner.addressId))
   if(owner.suppress&&owner.operatorId)statements.push(db.prepare(`INSERT INTO operator_mail_suppressions(operator_id,suppressed_at,created_at,updated_at) VALUES(?,?,?,?)
    ON CONFLICT(operator_id) DO UPDATE SET suppressed_at=excluded.suppressed_at,updated_at=excluded.updated_at`).bind(owner.operatorId,now,now,now))
   // A provider unsubscribe withdraws all requester email exactly as Penny's own
   // global link does; follows, votes and portal access stay.
   if(owner.unsubscribe&&owner.requesterId&&owner.addressId)statements.push(globalMuteStatement(db,owner.requesterId,true,now),
    db.prepare("UPDATE requester_update_permissions SET revoked_at=?,updated_at=? WHERE requester_id=? AND requester_address_id=? AND source='subscription' AND request_id IS NULL AND revoked_at IS NULL").bind(now,now,owner.requesterId,owner.addressId))
  }
  // Only Base's applied state writes change operator delivery counts. Receipt
  // arrival alone cannot roll an already terminal state backward.
  for(const write of writes.filter(row=>row.key.startsWith('mail-events:v1:state:'))){
   const {owner}=write,state=deliveryState((JSON.parse(write.raw) as {status:string}).status,owner.suppress)
   if(!state)continue
   if(owner.outboxId)statements.push(db.prepare(`UPDATE notification_outbox SET delivery_state=?,updated_at=?,
    accepted_at=CASE WHEN ? IN('accepted','delivered') THEN COALESCE(accepted_at,?) ELSE accepted_at END,
    delivered_at=CASE WHEN ?='delivered' THEN COALESCE(delivered_at,?) ELSE delivered_at END
    WHERE id=?`).bind(state,now,state,now,state,now,owner.outboxId))
   else if(owner.batchId)statements.push(db.prepare(`INSERT INTO notification_delivery_facts(batch_id,state,accepted_at,delivered_at,created_at,updated_at) VALUES(?,?,?,CASE WHEN ?='delivered' THEN ? ELSE NULL END,?,?)
    ON CONFLICT(batch_id) DO UPDATE SET state=excluded.state,delivered_at=COALESCE(delivered_at,excluded.delivered_at),updated_at=excluded.updated_at`).bind(owner.batchId,state,now,state,now,now,now))
   else if(owner.reviewId)statements.push(db.prepare(`INSERT INTO decision_review_delivery_facts(notification_id,state,accepted_at,delivered_at,created_at,updated_at) VALUES(?,?,?,CASE WHEN ?='delivered' THEN ? ELSE NULL END,?,?)
    ON CONFLICT(notification_id) DO UPDATE SET state=excluded.state,delivered_at=COALESCE(delivered_at,excluded.delivered_at),updated_at=excluded.updated_at`).bind(owner.reviewId,state,now,state,now,now,now))
  }
  statements.push(db.prepare('DELETE FROM requester_write_guards WHERE id=?').bind(guard))
  await db.batch(statements)
  return result
 }}
}
