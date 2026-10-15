/** A release cannot overtake earlier request updates to the same address, even
 * when Queue and Cron overlap or a digest needs a known retry. Terminal and
 * ambiguous attempts retain their existing no-replay policy. */
export function priorRequestUpdatesSettled(outbox: 'n' | 'notification_outbox'): string {
 return `NOT EXISTS(SELECT 1 FROM notification_intents pending
  JOIN notification_events event ON event.id=pending.event_id
  JOIN release_recipient_contexts context ON context.request_id=event.request_id
  LEFT JOIN notification_batches digest ON digest.id=pending.batch_id
  WHERE context.snapshot_id=${outbox}.release_snapshot_id AND pending.address_id=${outbox}.address_id
  AND pending.restoration_hold_at IS NULL AND event.created_at<=${outbox}.created_at
  AND (pending.batch_id IS NULL OR digest.state IN('queued','sending')))`
}
