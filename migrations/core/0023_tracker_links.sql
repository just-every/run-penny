CREATE TABLE penny_tracker_connections (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, provider TEXT NOT NULL CHECK(provider IN('linear','jira')),
 project_identity TEXT NOT NULL, organization_identity TEXT NOT NULL, site_origin TEXT NOT NULL, issue_type TEXT NOT NULL,
 native_operator_id TEXT NOT NULL, operator_version INTEGER NOT NULL, actor_id TEXT NOT NULL,
 created_at INTEGER NOT NULL, revoked_at INTEGER
);
CREATE TABLE penny_tracker_secrets (
 connection_id TEXT PRIMARY KEY, api_token TEXT NOT NULL, api_email TEXT NOT NULL, signing_key TEXT NOT NULL
);
CREATE TABLE penny_tracker_links (
 id TEXT PRIMARY KEY, request_id TEXT REFERENCES requests(id), decision_id TEXT REFERENCES decisions(id),
 connection_id TEXT NOT NULL, provider TEXT NOT NULL CHECK(provider IN('linear','jira')), project_identity TEXT NOT NULL,
 external_id TEXT NOT NULL, issue_url TEXT NOT NULL, state TEXT NOT NULL, source_updated_at INTEGER NOT NULL DEFAULT 0,
 state_fingerprint TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL,
 CHECK((request_id IS NOT NULL AND decision_id IS NULL) OR (request_id IS NULL AND decision_id IS NOT NULL)),
 UNIQUE(connection_id,external_id)
);
CREATE TABLE penny_tracker_commands (
 id TEXT PRIMARY KEY, request_id TEXT REFERENCES requests(id), decision_id TEXT REFERENCES decisions(id),
 connection_id TEXT NOT NULL, native_operator_id TEXT NOT NULL, operator_version INTEGER NOT NULL,
 operation_key TEXT NOT NULL UNIQUE, body_hash TEXT NOT NULL, body_json TEXT NOT NULL, link_id TEXT REFERENCES penny_tracker_links(id),
 created_at INTEGER NOT NULL, held INTEGER NOT NULL DEFAULT 0 CHECK(held IN(0,1)),
 CHECK((request_id IS NOT NULL AND decision_id IS NULL) OR (request_id IS NULL AND decision_id IS NOT NULL))
);
CREATE TABLE penny_tracker_receipts (
 connection_id TEXT NOT NULL, delivery_id TEXT NOT NULL, fingerprint TEXT NOT NULL,
 link_id TEXT NOT NULL REFERENCES penny_tracker_links(id), source_updated_at INTEGER NOT NULL,
 disposition TEXT NOT NULL CHECK(disposition IN('applied','older','same')),
 received_at INTEGER NOT NULL, PRIMARY KEY(connection_id,delivery_id), UNIQUE(connection_id,fingerprint)
);
CREATE TRIGGER data_guard_penny_tracker_connections_insert BEFORE INSERT ON penny_tracker_connections
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_tracker_connections_update BEFORE UPDATE ON penny_tracker_connections
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_tracker_connections_delete BEFORE DELETE ON penny_tracker_connections
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_tracker_secrets_insert BEFORE INSERT ON penny_tracker_secrets
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_tracker_secrets_update BEFORE UPDATE ON penny_tracker_secrets
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_tracker_secrets_delete BEFORE DELETE ON penny_tracker_secrets
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_tracker_links_insert BEFORE INSERT ON penny_tracker_links
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_tracker_links_update BEFORE UPDATE ON penny_tracker_links
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_tracker_links_delete BEFORE DELETE ON penny_tracker_links
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_tracker_commands_insert BEFORE INSERT ON penny_tracker_commands
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_tracker_commands_update BEFORE UPDATE ON penny_tracker_commands
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_tracker_commands_delete BEFORE DELETE ON penny_tracker_commands
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_tracker_receipts_insert BEFORE INSERT ON penny_tracker_receipts
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_tracker_receipts_update BEFORE UPDATE ON penny_tracker_receipts
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_tracker_receipts_delete BEFORE DELETE ON penny_tracker_receipts
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
