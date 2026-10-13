-- Status updates reach followers through notification intents, and no sender reads
-- request_status_update or moderation_rejected outbox rows (only release_version rows
-- have one). Rows written before this change stay in history with a visible state and
-- reason instead of staying queued forever. Release delivery rows are not touched.
UPDATE notification_outbox
SET delivery_state='suppressed',
    failure_reason=CASE event_type WHEN 'request_status_update' THEN 'superseded_by_notification_intent' ELSE 'no_delivery_path' END,
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE delivery_state='queued' AND claim_id IS NULL AND event_type IN ('request_status_update','moderation_rejected');
