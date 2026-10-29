-- Credentials and sidebar capabilities are installation custody, never portable.
CREATE TABLE penny_helpscout_connection (
 id TEXT PRIMARY KEY, mailbox_id INTEGER NOT NULL, tag TEXT NOT NULL,
 sidebar_user_id INTEGER NOT NULL, owner_id TEXT NOT NULL, owner_version INTEGER NOT NULL,
 actor_id TEXT NOT NULL REFERENCES operators(id), revision INTEGER NOT NULL,
 enabled INTEGER NOT NULL CHECK(enabled IN(0,1)), purge_days INTEGER NOT NULL,
 last_success TEXT, failure TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE penny_helpscout_secrets (
 connection_id TEXT PRIMARY KEY REFERENCES penny_helpscout_connection(id) ON DELETE CASCADE,
 client_id TEXT NOT NULL, client_secret TEXT NOT NULL, app_secret TEXT NOT NULL,
 webhook_secret TEXT NOT NULL, access_token TEXT, expires_at INTEGER
);
CREATE TABLE penny_helpscout_contexts (
 token_hash TEXT PRIMARY KEY, connection_id TEXT NOT NULL, conversation_id INTEGER NOT NULL,
 user_id INTEGER NOT NULL, revision INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE penny_helpscout_companies (
 connection_id TEXT NOT NULL, organization_id INTEGER NOT NULL,
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 PRIMARY KEY(connection_id,organization_id)
);
CREATE TABLE penny_helpscout_captures (
 connection_id TEXT NOT NULL REFERENCES penny_helpscout_connection(id),
 conversation_id INTEGER NOT NULL, revision INTEGER NOT NULL,
 trigger_kind TEXT NOT NULL CHECK(trigger_kind IN('tag','sidebar')),
 mailbox_id INTEGER NOT NULL, capture_tag TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN('pending','running','done','failed','stopped','held')),
 claim TEXT, started_at TEXT, attempts INTEGER NOT NULL DEFAULT 0, failure TEXT,
 evidence_id TEXT UNIQUE REFERENCES evidence_items(id) ON DELETE CASCADE,
 request_id TEXT REFERENCES requests(id) ON DELETE SET NULL,
 customer_id INTEGER, source_hash TEXT, source_state TEXT NOT NULL DEFAULT 'current',
 next_check TEXT, removed_at TEXT, purge_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY(connection_id,conversation_id)
);
CREATE TABLE penny_helpscout_receipts (
 source_digest TEXT PRIMARY KEY CHECK(length(source_digest)=64)
);
CREATE TABLE penny_helpscout_replies (
 id TEXT PRIMARY KEY, evidence_id TEXT NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
 request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
 status_id TEXT NOT NULL, body TEXT NOT NULL, edited_body TEXT,
 state TEXT NOT NULL CHECK(state IN('draft','sending','sent','unknown','held')),
 actor_id TEXT REFERENCES operators(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(evidence_id,status_id)
);
CREATE TRIGGER data_guard_penny_helpscout_connection_insert BEFORE INSERT ON penny_helpscout_connection
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_helpscout_connection_insert AFTER INSERT ON penny_helpscout_connection
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_helpscout_connection_update BEFORE UPDATE ON penny_helpscout_connection
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_helpscout_connection_update AFTER UPDATE ON penny_helpscout_connection
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_helpscout_connection_delete BEFORE DELETE ON penny_helpscout_connection
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_helpscout_connection_delete AFTER DELETE ON penny_helpscout_connection
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_helpscout_companies_insert BEFORE INSERT ON penny_helpscout_companies
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_helpscout_companies_insert AFTER INSERT ON penny_helpscout_companies
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_helpscout_companies_update BEFORE UPDATE ON penny_helpscout_companies
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_helpscout_companies_update AFTER UPDATE ON penny_helpscout_companies
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_helpscout_companies_delete BEFORE DELETE ON penny_helpscout_companies
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_helpscout_companies_delete AFTER DELETE ON penny_helpscout_companies
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_helpscout_captures_insert BEFORE INSERT ON penny_helpscout_captures
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_helpscout_captures_insert AFTER INSERT ON penny_helpscout_captures
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_helpscout_captures_update BEFORE UPDATE ON penny_helpscout_captures
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_helpscout_captures_update AFTER UPDATE ON penny_helpscout_captures
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_helpscout_captures_delete BEFORE DELETE ON penny_helpscout_captures
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_helpscout_captures_delete AFTER DELETE ON penny_helpscout_captures
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_helpscout_receipts_insert BEFORE INSERT ON penny_helpscout_receipts
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_helpscout_receipts_insert AFTER INSERT ON penny_helpscout_receipts
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_helpscout_receipts_update BEFORE UPDATE ON penny_helpscout_receipts
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_helpscout_receipts_update AFTER UPDATE ON penny_helpscout_receipts
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_helpscout_receipts_delete BEFORE DELETE ON penny_helpscout_receipts
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_helpscout_receipts_delete AFTER DELETE ON penny_helpscout_receipts
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_helpscout_replies_insert BEFORE INSERT ON penny_helpscout_replies
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_helpscout_replies_insert AFTER INSERT ON penny_helpscout_replies
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_helpscout_replies_update BEFORE UPDATE ON penny_helpscout_replies
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_helpscout_replies_update AFTER UPDATE ON penny_helpscout_replies
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_helpscout_replies_delete BEFORE DELETE ON penny_helpscout_replies
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_helpscout_replies_delete AFTER DELETE ON penny_helpscout_replies
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
