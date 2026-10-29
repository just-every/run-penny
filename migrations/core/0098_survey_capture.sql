-- Credentials remain installation bindings. Only selected, redacted answers
-- enter durable work; replay hashes outlive erasure.
CREATE TABLE penny_survey_forms (
 id TEXT PRIMARY KEY, provider TEXT NOT NULL CHECK(provider IN('typeform','surveymonkey','google','pencil')),
 form_id TEXT NOT NULL, mapping_json TEXT NOT NULL, response_url TEXT NOT NULL,
 owner_id TEXT NOT NULL, owner_version INTEGER NOT NULL, actor_id TEXT NOT NULL,
 enabled INTEGER NOT NULL CHECK(enabled IN(0,1)), revision INTEGER NOT NULL,
 purge_days INTEGER NOT NULL CHECK(purge_days BETWEEN 0 AND 365),
 state TEXT NOT NULL CHECK(state IN('idle','running','failed','stopped','held')),
 due_at TEXT NOT NULL, cursor TEXT, claim TEXT, started_at TEXT, failure TEXT,
 attempts INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL,
 UNIQUE(provider,form_id)
);
CREATE TABLE penny_survey_jobs (
 id TEXT PRIMARY KEY, form_id TEXT NOT NULL REFERENCES penny_survey_forms(id) ON DELETE CASCADE,
 response_id TEXT NOT NULL, revision INTEGER NOT NULL, selected_json TEXT,
 state TEXT NOT NULL CHECK(state IN('pending','running','failed','done','stopped','held')),
 attempts INTEGER NOT NULL DEFAULT 0, claim TEXT, started_at TEXT, failure TEXT,
 evidence_id TEXT REFERENCES evidence_items(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(form_id,response_id)
);
CREATE INDEX penny_survey_due ON penny_survey_jobs(state,created_at);
CREATE TABLE penny_survey_sources (
 evidence_id TEXT PRIMARY KEY REFERENCES evidence_items(id) ON DELETE CASCADE,
 job_id TEXT NOT NULL UNIQUE REFERENCES penny_survey_jobs(id) ON DELETE CASCADE,
 response_url TEXT NOT NULL, attributes_json TEXT NOT NULL, source_email TEXT,
 source_hash TEXT NOT NULL, source_state TEXT NOT NULL CHECK(source_state IN('current','changed','removed','purged')),
 removed_at TEXT, purge_at TEXT
);
CREATE TABLE penny_survey_receipts (
 source_digest TEXT PRIMARY KEY CHECK(length(source_digest)=64), created_at TEXT NOT NULL
);
CREATE TRIGGER penny_survey_jobs_redaction_insert AFTER INSERT ON penny_survey_jobs
BEGIN UPDATE penny_redaction_content SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER penny_survey_jobs_redaction_update AFTER UPDATE ON penny_survey_jobs
BEGIN UPDATE penny_redaction_content SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER penny_survey_jobs_redaction_delete AFTER DELETE ON penny_survey_jobs
BEGIN UPDATE penny_redaction_content SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER penny_survey_sources_redaction_insert AFTER INSERT ON penny_survey_sources
BEGIN UPDATE penny_redaction_content SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER penny_survey_sources_redaction_update AFTER UPDATE ON penny_survey_sources
BEGIN UPDATE penny_redaction_content SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER penny_survey_sources_redaction_delete AFTER DELETE ON penny_survey_sources
BEGIN UPDATE penny_redaction_content SET revision=revision+1 WHERE singleton=1; END;
