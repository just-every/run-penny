import {notificationContent} from './content'
/** A restored batch keeps its original custody until a drain classifies it.
 * No attempt or provider effect is created, even if its consent is still valid. */
export async function settleRestoredBatch(db:D1Database,id:string,now:string):Promise<void>{
 const recipient=await notificationContent(db,id)
 await db.prepare(`UPDATE notification_batches SET state=?,failure_reason=?,updated_at=?
  WHERE id=? AND state='queued' AND failure_reason='restored_delivery_review_required'
  AND (SELECT phase FROM data_state WHERE singleton=1)='idle'`)
  .bind(recipient?'unknown':'suppressed',recipient?'restored_delivery_review_required':'recipient_no_longer_eligible',now,id).run()
}
