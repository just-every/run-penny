-- Additive import-kit D1 person-erasure schema from Base 479094f0b26a639a1868fa521004581ec8dbcb63 (d1RetirementSchema).
-- Applied after every other import-kit schema: the append-only erasure journal, the retirement rows and the
-- stream revision trigger that admits the retirement transition. Existing migrations stay unchanged.

-- d1RetirementSchema
CREATE TABLE IF NOT EXISTS ik_d1_retirements (id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('job','stream')), destination TEXT NOT NULL, receipt_id TEXT NOT NULL, retired_at TEXT NOT NULL, PRIMARY KEY(id, kind));

CREATE TABLE IF NOT EXISTS ik_d1_erasure_journal (id TEXT PRIMARY KEY, destination TEXT NOT NULL, recorded_at TEXT NOT NULL, records_erased INTEGER NOT NULL CHECK(records_erased>=0), jobs_retired INTEGER NOT NULL CHECK(jobs_retired>=0), streams_retired INTEGER NOT NULL CHECK(streams_retired>=0), stores_json TEXT NOT NULL CHECK(json_valid(stores_json)));

CREATE INDEX IF NOT EXISTS ik_d1_erasure_journal_time ON ik_d1_erasure_journal(destination, recorded_at);

CREATE TRIGGER IF NOT EXISTS ik_d1_erasure_journal_insert BEFORE INSERT ON ik_d1_erasure_journal WHEN EXISTS(SELECT 1 FROM ik_d1_erasure_journal WHERE id=NEW.id) BEGIN SELECT RAISE(ABORT,'IMPORT_ERASURE_JOURNAL_APPEND_ONLY'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_retirement_insert BEFORE INSERT ON ik_d1_retirements WHEN EXISTS(SELECT 1 FROM ik_d1_retirements WHERE id=NEW.id AND kind=NEW.kind) BEGIN SELECT RAISE(ABORT,'IMPORT_RETIREMENT_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_erasure_journal_update BEFORE UPDATE ON ik_d1_erasure_journal BEGIN SELECT RAISE(ABORT,'IMPORT_ERASURE_JOURNAL_APPEND_ONLY'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_erasure_journal_delete BEFORE DELETE ON ik_d1_erasure_journal BEGIN SELECT RAISE(ABORT,'IMPORT_ERASURE_JOURNAL_APPEND_ONLY'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_retirement_update BEFORE UPDATE ON ik_d1_retirements BEGIN SELECT RAISE(ABORT,'IMPORT_RETIREMENT_CHANGED'); END;

CREATE TRIGGER IF NOT EXISTS ik_d1_retirement_delete BEFORE DELETE ON ik_d1_retirements BEGIN SELECT RAISE(ABORT,'IMPORT_RETIREMENT_CHANGED'); END;

CREATE TABLE IF NOT EXISTS ik_d1_erasure_tally (receipt_id TEXT NOT NULL, store TEXT NOT NULL, image TEXT NOT NULL);

DROP TRIGGER IF EXISTS ik_d1_stream_revision_update;

CREATE TRIGGER ik_d1_stream_revision_update BEFORE UPDATE ON ik_d1_stream_revisions WHEN NEW.stream_id IS NOT OLD.stream_id OR NEW.destination IS NOT OLD.destination OR NEW.mapping_version IS NOT OLD.mapping_version OR NEW.principal_id IS NOT OLD.principal_id OR NEW.fingerprint IS NOT OLD.fingerprint OR NEW.total IS NOT OLD.total OR NEW.layout_hash IS NOT OLD.layout_hash OR NEW.layout_revision<OLD.layout_revision OR NEW.progress_revision<=OLD.progress_revision OR ((NEW.namespace IS NOT OLD.namespace OR NEW.operation_key IS NOT OLD.operation_key) AND NOT (NEW.namespace='' AND NEW.operation_key='' AND NOT EXISTS(SELECT 1 FROM ik_d1_streams WHERE id=OLD.stream_id) AND EXISTS(SELECT 1 FROM ik_d1_retirements WHERE id=OLD.stream_id AND kind='stream'))) BEGIN SELECT RAISE(ABORT,'IMPORT_STREAM_REVISION_CHANGED'); END;

-- Penny maintenance admission for the newly retained custody tables.
CREATE TRIGGER penny_ik_d1_retirements_insert BEFORE INSERT ON ik_d1_retirements
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_retirements_update BEFORE UPDATE ON ik_d1_retirements
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_retirements_delete BEFORE DELETE ON ik_d1_retirements
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_erasure_journal_insert BEFORE INSERT ON ik_d1_erasure_journal
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_erasure_journal_update BEFORE UPDATE ON ik_d1_erasure_journal
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_erasure_journal_delete BEFORE DELETE ON ik_d1_erasure_journal
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_erasure_tally_insert BEFORE INSERT ON ik_d1_erasure_tally
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_erasure_tally_update BEFORE UPDATE ON ik_d1_erasure_tally
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_erasure_tally_delete BEFORE DELETE ON ik_d1_erasure_tally
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
