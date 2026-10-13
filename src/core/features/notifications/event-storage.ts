import type { EventAuthorization,EventTransaction } from './event-types'

/** Optimistic serializable D1 transaction. ALL reads (including absent keys and
 * authorization) are compared byte-for-byte before any write in one atomic batch.
 * A conflict aborts everything; provider retries start a fresh transaction. The
 * arrays below buffer an uncommitted transaction only; D1 is the durable store. */
export function eventStorage(db:D1Database,authorized:EventAuthorization[]){
 return {async transaction<T>(work:(tx:EventTransaction)=>Promise<T>):Promise<T>{
  const reads:{key:string;raw:string|null}[]=[],writes:{key:string;raw:string;owner:EventAuthorization}[]=[]
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
    const owner=authorized.find(item=>item.event.eventId===(value as {eventId?:string}).eventId)
    if(!owner)throw new Error('event_write_unauthorized')
    const raw=JSON.stringify(value),existing=writes.find(row=>row.key===key)
    if(existing){existing.raw=raw;existing.owner=owner}else writes.push({key,raw,owner})
   },
  }
  const result=await work(tx),guard=crypto.randomUUID(),now=new Date().toISOString()
  const assert=(sql:string,values:(string|number|null)[])=>db.prepare(`INSERT INTO requester_write_guards(id,permitted) VALUES(?,CASE WHEN ${sql} THEN 1 ELSE 0 END) ON CONFLICT(id) DO UPDATE SET permitted=excluded.permitted`).bind(guard,...values)
  const statements=[assert("(SELECT phase FROM data_state WHERE singleton=1)='idle'",[]),
   ...reads.map(row=>assert('(SELECT value_json FROM mail_event_records WHERE id=?) IS ?',[row.key,row.raw])),
   ...authorized.map(({witness})=>assert(`(${witness.sql}) IS ?`,[...witness.values,witness.raw])),
   ...writes.map(row=>db.prepare(`INSERT INTO mail_event_records(id,value_json,address_id,batch_id,outbox_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET value_json=excluded.value_json,address_id=excluded.address_id,batch_id=excluded.batch_id,outbox_id=excluded.outbox_id,updated_at=excluded.updated_at`).bind(row.key,row.raw,row.owner.addressId,row.owner.batchId,row.owner.outboxId??null,now,now)),
  ]
  for(const write of writes.filter(row=>row.key.startsWith('mail-events:v1:receipt:'))){
   const {owner}=write
   const attempts=owner.outboxId?'notification_outbox_attempts':'notification_attempts'
   statements.push(db.prepare(`UPDATE ${attempts} SET event_message_id=COALESCE(event_message_id,?),updated_at=? WHERE id=?`).bind(owner.event.providerMessageId,now,owner.attemptId))
   if(owner.suppress)statements.push(db.prepare('UPDATE requester_addresses SET suppressed_at=COALESCE(suppressed_at,?),updated_at=? WHERE id=?').bind(now,now,owner.addressId))
  }
  // Only Base's applied state writes change operator delivery counts. Receipt
  // arrival alone cannot roll an already terminal state backward.
  for(const write of writes.filter(row=>row.key.startsWith('mail-events:v1:state:'))){
   const {owner}=write,status=(JSON.parse(write.raw) as {status:string}).status
   if(owner.outboxId){
    const state=status==='delivered'?'delivered':['accepted','deferred'].includes(status)?'accepted':
     ['bounced','complained','failed','rejected'].includes(status)?(owner.suppress?'suppressed':'failed'):null
    if(state){
     statements.push(db.prepare(`UPDATE notification_outbox SET delivery_state=?,updated_at=?,
      accepted_at=CASE WHEN ? IN('accepted','delivered') THEN COALESCE(accepted_at,?) ELSE accepted_at END,
      delivered_at=CASE WHEN ?='delivered' THEN COALESCE(delivered_at,?) ELSE delivered_at END
      WHERE id=?`).bind(state,now,state,now,state,now,owner.outboxId))
    }
   }else if(['accepted','deferred','delivered','bounced','failed','rejected','complained'].includes(status)){
    const state=status==='delivered'?'delivered':['accepted','deferred'].includes(status)?'accepted':owner.suppress?'suppressed':'failed'
    statements.push(db.prepare(`INSERT INTO notification_delivery_facts(batch_id,state,accepted_at,delivered_at,created_at,updated_at) VALUES(?,?,?,CASE WHEN ?='delivered' THEN ? ELSE NULL END,?,?)
     ON CONFLICT(batch_id) DO UPDATE SET state=excluded.state,delivered_at=COALESCE(delivered_at,excluded.delivered_at),updated_at=excluded.updated_at`).bind(owner.batchId,state,now,state,now,now,now))
   }
  }
  statements.push(db.prepare('DELETE FROM requester_write_guards WHERE id=?').bind(guard))
  await db.batch(statements)
  return result
 }}
}
