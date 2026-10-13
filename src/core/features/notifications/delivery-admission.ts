import { notificationPayloadSql } from './content'
interface Admission {email:string;title:string;slug:string;requestId:string;events:string}
/** Payload, current eligibility, email and verification generation share one D1
 * transaction immediately before HTTP; no later storage await can intervene. */
export async function admitDelivery(db:D1Database,batchId:string,claim:string,email:string){
 const [snapshot,write]=await db.batch([
  db.prepare(notificationPayloadSql).bind(batchId,batchId,batchId),
  db.prepare(`UPDATE notification_attempts SET recipient_email=?,
   recipient_verification_epoch=(SELECT verification_epoch FROM requester_addresses WHERE id=(SELECT address_id FROM notification_batches WHERE id=notification_attempts.batch_id))
   WHERE id=? AND batch_id=? AND state='sending' AND recipient_email IS NULL
   AND EXISTS(SELECT 1 FROM notification_batches WHERE id=? AND claim_id=? AND state='sending')
   AND EXISTS(SELECT 1 FROM (${notificationPayloadSql}) WHERE email=?)
   AND (SELECT phase FROM data_state WHERE singleton=1)='idle' RETURNING 1 AS affected`)
   .bind(email,claim,batchId,batchId,claim,batchId,batchId,batchId,email),
 ])
 return {recipient:snapshot.results[0] as unknown as Admission|undefined,owned:write.results.length===1}
}
