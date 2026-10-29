-- Explicit per-status choice and snapshot. No permission or historical audience
-- is inferred. Retain expanded schema on rollback; stop newer mail workers first.
ALTER TABLE request_status_updates ADD COLUMN notify_captured_contacts INTEGER NOT NULL DEFAULT 0 CHECK(notify_captured_contacts IN(0,1));
ALTER TABLE notification_intents ADD COLUMN captured_contact INTEGER NOT NULL DEFAULT 0 CHECK(captured_contact IN(0,1));
