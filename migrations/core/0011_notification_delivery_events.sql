-- Address-bound unsubscribe generations survive identity moves and same-clock resubscription.
CREATE TABLE notification_link_epochs (
 address_id TEXT NOT NULL REFERENCES requester_addresses(id), scope TEXT NOT NULL,
 epoch INTEGER NOT NULL CHECK(epoch >= 0), created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY(address_id,scope)
);
-- Retain the exact recipient used by an attempt, independently of later identity edits.
ALTER TABLE notification_attempts ADD COLUMN recipient_email TEXT;
ALTER TABLE notification_attempts ADD COLUMN event_message_id TEXT;
-- Base receipt/state values retain PII; explicit address/batch FKs let erasure follow custody.
CREATE TABLE mail_event_records (
 id TEXT PRIMARY KEY, value_json TEXT NOT NULL CHECK(json_valid(value_json)),
 address_id TEXT NOT NULL REFERENCES requester_addresses(id), batch_id TEXT NOT NULL REFERENCES notification_batches(id),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TRIGGER data_guard_notification_link_epochs_insert BEFORE INSERT ON notification_link_epochs WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_notification_link_epochs_update BEFORE UPDATE ON notification_link_epochs WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_notification_link_epochs_delete BEFORE DELETE ON notification_link_epochs WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_mail_event_records_insert BEFORE INSERT ON mail_event_records WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_mail_event_records_update BEFORE UPDATE ON mail_event_records WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_mail_event_records_delete BEFORE DELETE ON mail_event_records WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;

CREATE TRIGGER notification_resume_all_insert AFTER INSERT ON requester_notification_preferences
WHEN NEW.muted_at IS NULL AND (SELECT phase FROM data_state WHERE singleton=1)='idle'
BEGIN
 INSERT INTO notification_link_epochs(address_id,scope,epoch,created_at,updated_at)
 SELECT id,'all',1,NEW.updated_at,NEW.updated_at FROM requester_addresses WHERE requester_id=NEW.requester_id
 ON CONFLICT(address_id,scope) DO UPDATE SET epoch=epoch+1,updated_at=excluded.updated_at;
END;
CREATE TRIGGER notification_resume_all_update AFTER UPDATE OF muted_at ON requester_notification_preferences
WHEN NEW.muted_at IS NULL AND (SELECT phase FROM data_state WHERE singleton=1)='idle'
BEGIN
 INSERT INTO notification_link_epochs(address_id,scope,epoch,created_at,updated_at)
 SELECT id,'all',1,NEW.updated_at,NEW.updated_at FROM requester_addresses WHERE requester_id=NEW.requester_id
 ON CONFLICT(address_id,scope) DO UPDATE SET epoch=epoch+1,updated_at=excluded.updated_at;
END;

ALTER TABLE requester_update_permissions ADD COLUMN suppressed_at TEXT;
ALTER TABLE requester_addresses ADD COLUMN verification_epoch INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notification_attempts ADD COLUMN recipient_verification_epoch INTEGER;
UPDATE requester_update_permissions SET suppressed_at=(SELECT suppressed_at FROM requester_addresses WHERE id=requester_address_id);
CREATE TRIGGER notification_permission_suppression AFTER UPDATE OF suppressed_at ON requester_addresses
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle'
BEGIN UPDATE requester_update_permissions SET suppressed_at=NEW.suppressed_at,updated_at=NEW.updated_at WHERE requester_address_id=NEW.id; END;
CREATE TRIGGER notification_permission_insert AFTER INSERT ON requester_update_permissions
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle'
BEGIN UPDATE requester_update_permissions SET suppressed_at=(SELECT suppressed_at FROM requester_addresses WHERE id=NEW.requester_address_id) WHERE id=NEW.id; END;

CREATE TRIGGER notification_suppression_reverification AFTER UPDATE OF suppressed_at ON requester_addresses
WHEN OLD.suppressed_at IS NOT NULL AND NEW.suppressed_at IS NULL AND (SELECT phase FROM data_state WHERE singleton=1)='idle'
BEGIN UPDATE requester_addresses SET verification_epoch=verification_epoch+1 WHERE id=NEW.id; END;

-- A renewed permission is an explicit follow/vote-with-email after withdrawal.
-- Advance every current origin, atomically with consent, without rewriting
-- historical grants or making the first permission invalidate legacy links.
CREATE TRIGGER notification_permission_renewal AFTER INSERT ON requester_update_permissions
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle'
 AND EXISTS(SELECT 1 FROM requester_update_permissions previous
  JOIN request_canonical_roots prior_root ON prior_root.origin_id=previous.request_id
  WHERE previous.id!=NEW.id AND previous.requester_id=NEW.requester_id
   AND prior_root.canonical_id=(SELECT canonical_id FROM request_canonical_roots WHERE origin_id=NEW.request_id))
BEGIN
 INSERT INTO notification_link_epochs(address_id,scope,epoch,created_at,updated_at)
 SELECT address.id,root.origin_id,1,NEW.updated_at,NEW.updated_at
 FROM requester_addresses address CROSS JOIN request_canonical_roots root
 WHERE address.requester_id=NEW.requester_id
  AND root.canonical_id=(SELECT canonical_id FROM request_canonical_roots WHERE origin_id=NEW.request_id)
 ON CONFLICT(address_id,scope) DO UPDATE SET epoch=epoch+1,updated_at=excluded.updated_at;
END;
-- Explicit follow may also resume an existing muted contribution without a new
-- permission row. Identity merges INSERT/transfer contributions, so moving an
-- identity alone never invalidates its already mailed links.
CREATE TRIGGER notification_follow_resume AFTER UPDATE OF muted_at ON request_follow_contributions
WHEN OLD.muted_at IS NOT NULL AND NEW.muted_at IS NULL
 AND (SELECT phase FROM data_state WHERE singleton=1)='idle'
BEGIN
 INSERT INTO notification_link_epochs(address_id,scope,epoch,created_at,updated_at)
 SELECT address.id,root.origin_id,1,NEW.updated_at,NEW.updated_at
 FROM requester_addresses address CROSS JOIN request_canonical_roots root
 WHERE address.requester_id=NEW.requester_id
  AND root.canonical_id=(SELECT canonical_id FROM request_canonical_roots WHERE origin_id=NEW.request_id)
 ON CONFLICT(address_id,scope) DO UPDATE SET epoch=epoch+1,updated_at=excluded.updated_at;
END;

-- Claims and identity transfers serialize in D1. An identity cannot change
-- while a provider call owns it; a later merge retains terminal event custody.
CREATE TRIGGER notification_identity_merge_guard BEFORE INSERT ON requester_identity_merges
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle'
 AND EXISTS(SELECT 1 FROM notification_batches WHERE state='sending'
  AND requester_id IN(NEW.source_requester_id,NEW.target_requester_id))
BEGIN SELECT RAISE(ABORT,'identity_merge_notification_active'); END;
