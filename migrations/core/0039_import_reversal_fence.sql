-- Additive import-kit D1 reversal fence from Base 479094f0b26a639a1868fa521004581ec8dbcb63 (d1ReversalFenceSchema).
-- An undo of a large job reads only its own rows while the job's custody revision is unchanged.
-- Existing numbered migrations and original job/plan bytes stay unchanged.

-- d1ReversalFenceSchema
CREATE TABLE IF NOT EXISTS ik_d1_reversal_fences (job_id TEXT PRIMARY KEY REFERENCES ik_jobs(id) ON DELETE CASCADE,action TEXT NOT NULL,fence INTEGER NOT NULL,state_revision INTEGER NOT NULL,erased_records INTEGER NOT NULL,reused INTEGER NOT NULL);

CREATE INDEX IF NOT EXISTS ik_provenance_job ON ik_provenance(job_id,reversed,ordinal,effect_ordinal);

CREATE INDEX IF NOT EXISTS ik_provenance_source ON ik_provenance(source_identity,reversed);

CREATE INDEX IF NOT EXISTS ik_d1_history_source ON ik_d1_history(source_identity);

CREATE INDEX IF NOT EXISTS ik_sources_job ON ik_sources(job_id);

-- Penny maintenance admission for the newly retained custody table.
CREATE TRIGGER penny_ik_d1_reversal_fences_insert BEFORE INSERT ON ik_d1_reversal_fences
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_reversal_fences_update BEFORE UPDATE ON ik_d1_reversal_fences
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_ik_d1_reversal_fences_delete BEFORE DELETE ON ik_d1_reversal_fences
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
