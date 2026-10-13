-- Host assertions authorize requester actions only. Retain opaque erasure fences.
CREATE TABLE host_identity_claims (
 email_hash TEXT PRIMARY KEY,
 requester_id TEXT NOT NULL REFERENCES requesters(id),
 issued_at TEXT NOT NULL,
 claim_hash TEXT NOT NULL
);
CREATE TABLE host_identity_tombstones (email_hash TEXT PRIMARY KEY);

CREATE TRIGGER penny_host_identity_claims_insert BEFORE INSERT ON host_identity_claims
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_host_identity_claims_update BEFORE UPDATE ON host_identity_claims
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_host_identity_claims_delete BEFORE DELETE ON host_identity_claims
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_host_identity_tombstones_insert BEFORE INSERT ON host_identity_tombstones
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_host_identity_tombstones_update BEFORE UPDATE ON host_identity_tombstones
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_host_identity_tombstones_delete BEFORE DELETE ON host_identity_tombstones
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
