import { createUlid } from '@/core/shared/ulid'

// A claimed batch stays immutable, including a no-HTTP quiet-hours deferral.
const openWindow = "state='queued' AND attempt_count=0 AND claim_id IS NULL AND failure_reason IS NOT 'restored_delivery_review_required'"

/** First-event windows are persisted, half open, and never extended by later activity. */
export async function prepareBatches(db: D1Database, now: string): Promise<void> {
 // Adopt the shorter window for existing unclaimed work too. Claimed and
 // restored batches keep their immutable membership and reconciliation state.
 await db.prepare(`UPDATE notification_batches SET
  window_end=strftime('%Y-%m-%dT%H:%M:%fZ',window_start,'+1 minute'),
  next_attempt_at=MIN(next_attempt_at,strftime('%Y-%m-%dT%H:%M:%fZ',window_start,'+1 minute')),updated_at=?
  WHERE ${openWindow} AND window_end>strftime('%Y-%m-%dT%H:%M:%fZ',window_start,'+1 minute')`).bind(now).run()
 for(let page=0;page<100;page++) {
  const first=await db.prepare(`SELECT i.event_id AS eventId,i.address_id AS addressId,e.request_id AS requestId
   FROM notification_intents i JOIN notification_events e ON e.id=i.event_id
   WHERE i.batch_id IS NULL AND i.restoration_hold_at IS NULL ORDER BY i.created_at,i.event_id,i.address_id LIMIT 1`)
   .first<{eventId:string;addressId:string;requestId:string}>()
  if(!first)return
  // A publication can commit after a delivery with an earlier queued timestamp.
  // Record when that intent becomes pending for a fresh window, preserving its
  // original timestamp. All admission decisions run in the same D1 transaction.
  await db.batch([
   db.prepare(`UPDATE notification_intents SET coalescing_at=MAX(?,
     (SELECT MAX(window_end) FROM notification_batches WHERE address_id=? AND request_id=? AND NOT (${openWindow}))),updated_at=?
    WHERE batch_id IS NULL AND restoration_hold_at IS NULL AND address_id=? AND event_id IN(SELECT id FROM notification_events WHERE request_id=?)
    AND EXISTS(SELECT 1 FROM notification_batches WHERE address_id=? AND request_id=? AND NOT (${openWindow})
     AND window_end>COALESCE(notification_intents.coalescing_at,notification_intents.created_at))`)
    .bind(now,first.addressId,first.requestId,now,first.addressId,first.requestId,first.addressId,first.requestId),
   db.prepare(`INSERT INTO notification_batches(id,requester_id,address_id,request_id,first_event_id,window_start,window_end,state,next_attempt_at,created_at,updated_at)
    SELECT ?,i.requester_id,i.address_id,?,i.event_id,COALESCE(i.coalescing_at,i.created_at),
     strftime('%Y-%m-%dT%H:%M:%fZ',COALESCE(i.coalescing_at,i.created_at),'+1 minute'),'queued',
     strftime('%Y-%m-%dT%H:%M:%fZ',COALESCE(i.coalescing_at,i.created_at),'+1 minute'),?,?
    FROM notification_intents i WHERE i.event_id=? AND i.address_id=? AND i.batch_id IS NULL AND i.restoration_hold_at IS NULL
    AND NOT EXISTS(SELECT 1 FROM notification_batches WHERE address_id=i.address_id AND request_id=? AND ${openWindow}
     AND window_start<=COALESCE(i.coalescing_at,i.created_at) AND window_end>COALESCE(i.coalescing_at,i.created_at))`)
    .bind(createUlid(),first.requestId,now,now,first.eventId,first.addressId,first.requestId),
   db.prepare(`WITH target AS MATERIALIZED (
     SELECT b.id,b.window_start,b.window_end FROM notification_batches b JOIN notification_intents i
     ON i.event_id=? AND i.address_id=b.address_id AND i.batch_id IS NULL AND i.restoration_hold_at IS NULL
     WHERE b.address_id=? AND b.request_id=? AND ${openWindow}
     AND b.window_start<=COALESCE(i.coalescing_at,i.created_at) AND b.window_end>COALESCE(i.coalescing_at,i.created_at)
     ORDER BY b.window_start,b.id LIMIT 1)
    UPDATE notification_intents SET batch_id=(SELECT id FROM target),updated_at=?
    WHERE batch_id IS NULL AND restoration_hold_at IS NULL AND address_id=? AND event_id IN(SELECT id FROM notification_events WHERE request_id=?)
    AND COALESCE(coalescing_at,created_at)>=(SELECT window_start FROM target)
    AND COALESCE(coalescing_at,created_at)<(SELECT window_end FROM target)`)
    .bind(first.eventId,first.addressId,first.requestId,now,first.addressId,first.requestId),
  ])
 }
}
