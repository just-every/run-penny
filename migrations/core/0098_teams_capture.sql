-- Teams credentials remain deployment secrets; restored work cannot run.
CREATE TABLE penny_teams_settings (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 team_id TEXT NOT NULL, channels_json TEXT NOT NULL,
 owner_id TEXT NOT NULL, owner_version INTEGER NOT NULL, actor_id TEXT NOT NULL,
 enabled INTEGER NOT NULL CHECK(enabled IN(0,1)), revision INTEGER NOT NULL,
 purge_days INTEGER NOT NULL CHECK(purge_days BETWEEN 0 AND 365), updated_at TEXT NOT NULL
);
CREATE TABLE penny_teams_jobs (
 id TEXT PRIMARY KEY, team_id TEXT NOT NULL, channel_id TEXT NOT NULL, message_id TEXT NOT NULL, parent_message_id TEXT,
 capturer_id TEXT NOT NULL, capturer_name TEXT, trigger_kind TEXT NOT NULL,
 owner_id TEXT NOT NULL, owner_version INTEGER NOT NULL, actor_id TEXT NOT NULL,
 revision INTEGER NOT NULL, state TEXT NOT NULL CHECK(state IN('pending','running','failed','done','stopped','held')),
 evidence_id TEXT REFERENCES evidence_items(id) ON DELETE CASCADE,
 attempts INTEGER NOT NULL DEFAULT 0, claim TEXT, started_at TEXT, failure TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(team_id,channel_id,message_id)
);
CREATE INDEX penny_teams_due ON penny_teams_jobs(state,created_at);
CREATE TABLE penny_teams_sources (
 evidence_id TEXT PRIMARY KEY REFERENCES evidence_items(id) ON DELETE CASCADE,
 job_id TEXT NOT NULL UNIQUE REFERENCES penny_teams_jobs(id) ON DELETE CASCADE, team_id TEXT NOT NULL, channel_id TEXT NOT NULL, message_id TEXT NOT NULL, parent_message_id TEXT,
 jump_url TEXT NOT NULL, capturer_id TEXT NOT NULL, capturer_name TEXT, author_id TEXT,
 source_hash TEXT NOT NULL, source_state TEXT NOT NULL CHECK(source_state IN('current','changed','removed','purged')),
 removed_at TEXT, purge_at TEXT, next_check TEXT NOT NULL, check_failure TEXT,
 UNIQUE(team_id,channel_id,message_id)
);
CREATE TRIGGER penny_teams_jobs_redaction_insert AFTER INSERT ON penny_teams_jobs
BEGIN UPDATE penny_redaction_content SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER penny_teams_jobs_redaction_update AFTER UPDATE ON penny_teams_jobs
BEGIN UPDATE penny_redaction_content SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER penny_teams_jobs_redaction_delete AFTER DELETE ON penny_teams_jobs
BEGIN UPDATE penny_redaction_content SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER penny_teams_sources_redaction_insert AFTER INSERT ON penny_teams_sources
BEGIN UPDATE penny_redaction_content SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER penny_teams_sources_redaction_update AFTER UPDATE ON penny_teams_sources
BEGIN UPDATE penny_redaction_content SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER penny_teams_sources_redaction_delete AFTER DELETE ON penny_teams_sources
BEGIN UPDATE penny_redaction_content SET revision=revision+1 WHERE singleton=1; END;
-- Wording-free replay custody survives evidence erasure without retaining IDs.
CREATE TABLE penny_teams_receipts (
 source_digest TEXT PRIMARY KEY CHECK(length(source_digest)=64), created_at TEXT NOT NULL
);
-- A source read owns a durable lease; expired or superseded reads cannot commit.
-- Existing provenance, captured wording and applied migrations remain unchanged.
ALTER TABLE penny_teams_sources ADD COLUMN check_claim TEXT;
ALTER TABLE penny_teams_sources ADD COLUMN check_started_at TEXT;
