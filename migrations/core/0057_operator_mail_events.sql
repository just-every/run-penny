-- Provider delivery facts for decision-review mail (NOTIFY-003/005), kept beside
-- the notification so its own states and history stay unchanged.
CREATE TABLE decision_review_delivery_facts (
 notification_id TEXT PRIMARY KEY NOT NULL REFERENCES decision_review_notifications(id),
 state TEXT NOT NULL CHECK(state IN('accepted','delivered','failed','suppressed')),
 event_message_id TEXT, accepted_at TEXT, delivered_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
-- A hard bounce or complaint on an operator's mail stops further review mail to
-- that operator until they sign in again by email.
CREATE TABLE operator_mail_suppressions (
 operator_id TEXT PRIMARY KEY NOT NULL REFERENCES operators(id),
 suppressed_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TRIGGER data_guard_decision_review_delivery_facts_insert BEFORE INSERT ON decision_review_delivery_facts
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_decision_review_delivery_facts_update BEFORE UPDATE ON decision_review_delivery_facts
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_decision_review_delivery_facts_delete BEFORE DELETE ON decision_review_delivery_facts
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_operator_mail_suppressions_insert BEFORE INSERT ON operator_mail_suppressions
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_operator_mail_suppressions_update BEFORE UPDATE ON operator_mail_suppressions
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_operator_mail_suppressions_delete BEFORE DELETE ON operator_mail_suppressions
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
-- Signed event receipts also belong to operators (review mail) and to a
-- requester address with no known delivery (asynchronous bounces). Rows,
-- order and guards are preserved.
CREATE TABLE mail_event_records_next (
 id TEXT PRIMARY KEY, value_json TEXT NOT NULL CHECK(json_valid(value_json)),
 address_id TEXT REFERENCES requester_addresses(id), batch_id TEXT REFERENCES notification_batches(id),
 outbox_id TEXT REFERENCES notification_outbox(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 operator_id TEXT REFERENCES operators(id), review_id TEXT REFERENCES decision_review_notifications(id),
 CHECK((address_id IS NULL)!=(operator_id IS NULL)),
 CHECK((batch_id IS NOT NULL)+(outbox_id IS NOT NULL)+(review_id IS NOT NULL)<=1),
 CHECK((batch_id IS NULL AND outbox_id IS NULL) OR address_id IS NOT NULL),
 CHECK(review_id IS NULL OR operator_id IS NOT NULL)
);
INSERT INTO mail_event_records_next(id,value_json,address_id,batch_id,outbox_id,created_at,updated_at)
 SELECT id,value_json,address_id,batch_id,outbox_id,created_at,updated_at FROM mail_event_records ORDER BY rowid;
DROP TABLE mail_event_records;
ALTER TABLE mail_event_records_next RENAME TO mail_event_records;
CREATE TRIGGER data_guard_mail_event_records_insert BEFORE INSERT ON mail_event_records WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_mail_event_records_update BEFORE UPDATE ON mail_event_records WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_mail_event_records_delete BEFORE DELETE ON mail_event_records WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER feedback_native_mail_event_records_insert AFTER INSERT ON "mail_event_records" BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER feedback_native_mail_event_records_update AFTER UPDATE ON "mail_event_records" BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER feedback_native_mail_event_records_delete AFTER DELETE ON "mail_event_records" BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
