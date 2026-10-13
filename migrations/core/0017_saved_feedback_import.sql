CREATE TABLE IF NOT EXISTS ik_jobs (
 id TEXT PRIMARY KEY, destination TEXT NOT NULL, namespace TEXT NOT NULL,
 mapping_version TEXT NOT NULL, principal_id TEXT NOT NULL, fingerprint TEXT NOT NULL,
 operation_key TEXT NOT NULL, plan_json TEXT NOT NULL, state TEXT NOT NULL,
 checkpoint INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL, fence INTEGER NOT NULL DEFAULT 0,
 lease_token TEXT, lease_expires INTEGER, error TEXT,
 UNIQUE(destination, principal_id, operation_key)
);

CREATE TABLE IF NOT EXISTS ik_original_sets (
 job_id TEXT PRIMARY KEY REFERENCES ik_jobs(id), version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ik_originals (
 job_id TEXT NOT NULL REFERENCES ik_jobs(id), kind TEXT NOT NULL, original_key TEXT NOT NULL,
 name TEXT NOT NULL, sha256 TEXT NOT NULL, size INTEGER NOT NULL, bytes BLOB,
 PRIMARY KEY(job_id,kind,original_key)
);

CREATE TABLE IF NOT EXISTS ik_sources (
 identity TEXT PRIMARY KEY, source_hash TEXT NOT NULL, mapping_version TEXT NOT NULL,
 effects_hash TEXT NOT NULL, job_id TEXT NOT NULL REFERENCES ik_jobs(id)
);

CREATE TABLE IF NOT EXISTS ik_provenance (
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES ik_jobs(id), ordinal INTEGER NOT NULL, effect_ordinal INTEGER NOT NULL,
 source_identity TEXT NOT NULL, destination TEXT NOT NULL, target_kind TEXT NOT NULL,
 target_id TEXT NOT NULL, reversed INTEGER NOT NULL DEFAULT 0, record_json TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ik_active_target ON ik_provenance(destination,target_kind,target_id) WHERE reversed=0;

CREATE TABLE IF NOT EXISTS ik_stages (
 job_id TEXT NOT NULL REFERENCES ik_jobs(id), fence INTEGER NOT NULL, effect_id TEXT NOT NULL,
 sha256 TEXT NOT NULL, bytes BLOB NOT NULL, PRIMARY KEY(job_id,fence,effect_id)
);

CREATE TABLE IF NOT EXISTS ik_batches (
 job_id TEXT NOT NULL REFERENCES ik_jobs(id), action TEXT NOT NULL, position INTEGER NOT NULL,
 end_position INTEGER NOT NULL, fence INTEGER NOT NULL, PRIMARY KEY(job_id,action,position)
);

CREATE TABLE IF NOT EXISTS ik_targets (
 destination TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL,
 revision TEXT NOT NULL, value_json TEXT NOT NULL, attachment_json TEXT,
 PRIMARY KEY(destination,kind,id)
);

CREATE TABLE IF NOT EXISTS ik_d1_plan_chunks (job_id TEXT NOT NULL REFERENCES ik_jobs(id), ordinal INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY(job_id,ordinal));

CREATE TABLE IF NOT EXISTS ik_d1_original_chunks (job_id TEXT NOT NULL REFERENCES ik_jobs(id), kind TEXT NOT NULL, original_key TEXT NOT NULL, ordinal INTEGER NOT NULL, bytes BLOB NOT NULL, PRIMARY KEY(job_id,kind,original_key,ordinal));

CREATE TABLE IF NOT EXISTS ik_d1_history (id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES ik_jobs(id), ordinal INTEGER NOT NULL, effect_ordinal INTEGER NOT NULL, source_identity TEXT NOT NULL, destination TEXT NOT NULL, target_kind TEXT NOT NULL, target_id TEXT NOT NULL, reversed INTEGER NOT NULL CHECK(reversed=0), record_json TEXT NOT NULL, successor_id TEXT NOT NULL UNIQUE);

CREATE INDEX IF NOT EXISTS ik_d1_history_job ON ik_d1_history(job_id);

CREATE TABLE IF NOT EXISTS ik_d1_entries (job_id TEXT NOT NULL REFERENCES ik_jobs(id), ordinal INTEGER NOT NULL, source_identity TEXT NOT NULL, owner_job_id TEXT NOT NULL REFERENCES ik_jobs(id), effects_hash TEXT NOT NULL, PRIMARY KEY(job_id,ordinal));

CREATE TABLE IF NOT EXISTS ik_d1_assertions (ok INTEGER NOT NULL CONSTRAINT IMPORT_ATOMIC_GUARD CHECK(ok=1));

ALTER TABLE ik_jobs ADD COLUMN reversal_policy TEXT NOT NULL DEFAULT 'strict' CHECK(reversal_policy IN ('strict','preserve-conflicts'));

ALTER TABLE ik_jobs ADD COLUMN reversal_policy_hash TEXT;

ALTER TABLE ik_jobs ADD COLUMN reversal_cursor INTEGER NOT NULL DEFAULT 0 CHECK(reversal_cursor>=0);

ALTER TABLE ik_jobs ADD COLUMN reversal_hash TEXT NOT NULL DEFAULT '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945';

CREATE TABLE ik_d1_creation_plans (job_id TEXT NOT NULL REFERENCES ik_jobs(id), ordinal INTEGER NOT NULL, body TEXT NOT NULL, released INTEGER NOT NULL DEFAULT 0 CHECK(released IN (0,1)), PRIMARY KEY(job_id,ordinal));

CREATE TRIGGER ik_d1_creation_plan_capture AFTER INSERT ON ik_d1_plan_chunks BEGIN INSERT INTO ik_d1_creation_plans(job_id,ordinal,body) VALUES(NEW.job_id,NEW.ordinal,NEW.body); END;

CREATE TRIGGER ik_d1_creation_plan_immutable BEFORE UPDATE ON ik_d1_creation_plans WHEN NEW.job_id IS NOT OLD.job_id OR NEW.ordinal IS NOT OLD.ordinal OR NEW.body IS NOT OLD.body OR OLD.released<>0 OR NEW.released<>1 OR NOT EXISTS(SELECT 1 FROM ik_d1_plan_chunks p WHERE p.job_id=OLD.job_id AND p.ordinal=OLD.ordinal AND p.body IS OLD.body) BEGIN SELECT RAISE(ABORT,'IMPORT_CREATION_SNAPSHOT_CHANGED'); END;

CREATE TRIGGER ik_d1_creation_plan_release BEFORE DELETE ON ik_d1_creation_plans WHEN OLD.released<>1 BEGIN SELECT RAISE(ABORT,'IMPORT_CREATION_SNAPSHOT_CHANGED'); END;

CREATE TABLE ik_d1_reversal_reports (job_id TEXT NOT NULL REFERENCES ik_jobs(id), effect_id TEXT NOT NULL, position INTEGER NOT NULL, record_json TEXT NOT NULL, PRIMARY KEY(job_id,effect_id), UNIQUE(job_id,position));

-- Product mappings keep source attribution separate from requester authority.
ALTER TABLE request_comments ADD COLUMN historical_private INTEGER NOT NULL DEFAULT 0 CHECK(historical_private IN (0,1));
ALTER TABLE request_comments ADD COLUMN historical_parent_id TEXT;
CREATE TRIGGER feedback_private_comment BEFORE UPDATE OF moderation_state,published_at ON request_comments
WHEN NEW.historical_private=1 AND (NEW.moderation_state='approved' OR NEW.published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'historical_comment_private'); END;
CREATE TABLE feedback_import_records (
 target_kind TEXT NOT NULL, target_id TEXT NOT NULL, namespace TEXT NOT NULL,
 source_id TEXT NOT NULL, artifact_hash TEXT NOT NULL, source_hash TEXT NOT NULL,
 revision TEXT NOT NULL, row_keys_json TEXT NOT NULL, attribution TEXT NOT NULL CHECK(attribution='historical-unverified'),
 PRIMARY KEY(target_kind,target_id)
);
CREATE TABLE feedback_import_tombstones (
 target_kind TEXT NOT NULL, target_id TEXT NOT NULL, PRIMARY KEY(target_kind,target_id)
);

CREATE TRIGGER penny_feedback_import_records_insert BEFORE INSERT ON feedback_import_records
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_feedback_import_records_update BEFORE UPDATE ON feedback_import_records
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_feedback_import_records_delete BEFORE DELETE ON feedback_import_records
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_feedback_import_tombstones_insert BEFORE INSERT ON feedback_import_tombstones
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_feedback_import_tombstones_update BEFORE UPDATE ON feedback_import_tombstones
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_feedback_import_tombstones_delete BEFORE DELETE ON feedback_import_tombstones
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_batches_insert BEFORE INSERT ON ik_batches
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_batches_update BEFORE UPDATE ON ik_batches
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_batches_delete BEFORE DELETE ON ik_batches
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_assertions_insert BEFORE INSERT ON ik_d1_assertions
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_assertions_update BEFORE UPDATE ON ik_d1_assertions
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_assertions_delete BEFORE DELETE ON ik_d1_assertions
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_creation_plans_insert BEFORE INSERT ON ik_d1_creation_plans
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_creation_plans_update BEFORE UPDATE ON ik_d1_creation_plans
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_creation_plans_delete BEFORE DELETE ON ik_d1_creation_plans
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_entries_insert BEFORE INSERT ON ik_d1_entries
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_entries_update BEFORE UPDATE ON ik_d1_entries
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_entries_delete BEFORE DELETE ON ik_d1_entries
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_history_insert BEFORE INSERT ON ik_d1_history
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_history_update BEFORE UPDATE ON ik_d1_history
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_history_delete BEFORE DELETE ON ik_d1_history
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_original_chunks_insert BEFORE INSERT ON ik_d1_original_chunks
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_original_chunks_update BEFORE UPDATE ON ik_d1_original_chunks
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_original_chunks_delete BEFORE DELETE ON ik_d1_original_chunks
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_plan_chunks_insert BEFORE INSERT ON ik_d1_plan_chunks
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_plan_chunks_update BEFORE UPDATE ON ik_d1_plan_chunks
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_plan_chunks_delete BEFORE DELETE ON ik_d1_plan_chunks
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_reversal_reports_insert BEFORE INSERT ON ik_d1_reversal_reports
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_reversal_reports_update BEFORE UPDATE ON ik_d1_reversal_reports
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_reversal_reports_delete BEFORE DELETE ON ik_d1_reversal_reports
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_jobs_insert BEFORE INSERT ON ik_jobs
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_jobs_update BEFORE UPDATE ON ik_jobs
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_jobs_delete BEFORE DELETE ON ik_jobs
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_original_sets_insert BEFORE INSERT ON ik_original_sets
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_original_sets_update BEFORE UPDATE ON ik_original_sets
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_original_sets_delete BEFORE DELETE ON ik_original_sets
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_originals_insert BEFORE INSERT ON ik_originals
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_originals_update BEFORE UPDATE ON ik_originals
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_originals_delete BEFORE DELETE ON ik_originals
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_provenance_insert BEFORE INSERT ON ik_provenance
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_provenance_update BEFORE UPDATE ON ik_provenance
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_provenance_delete BEFORE DELETE ON ik_provenance
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_sources_insert BEFORE INSERT ON ik_sources
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_sources_update BEFORE UPDATE ON ik_sources
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_sources_delete BEFORE DELETE ON ik_sources
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_stages_insert BEFORE INSERT ON ik_stages
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_stages_update BEFORE UPDATE ON ik_stages
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_stages_delete BEFORE DELETE ON ik_stages
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_targets_insert BEFORE INSERT ON ik_targets
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_targets_update BEFORE UPDATE ON ik_targets
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_targets_delete BEFORE DELETE ON ik_targets
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
