-- Discord credentials remain deployment secrets; restored work cannot run.
CREATE TABLE penny_discord_settings (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 guild_id TEXT NOT NULL, channels_json TEXT NOT NULL, emoji TEXT NOT NULL,
 owner_id TEXT NOT NULL, owner_version INTEGER NOT NULL, actor_id TEXT NOT NULL,
 enabled INTEGER NOT NULL CHECK(enabled IN(0,1)), revision INTEGER NOT NULL,
 purge_days INTEGER NOT NULL CHECK(purge_days BETWEEN 0 AND 365), updated_at TEXT NOT NULL
);
CREATE TABLE penny_discord_jobs (
 id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, channel_id TEXT NOT NULL, message_id TEXT NOT NULL,
 capturer_id TEXT NOT NULL, capturer_name TEXT, trigger_kind TEXT NOT NULL,
 owner_id TEXT NOT NULL, owner_version INTEGER NOT NULL, actor_id TEXT NOT NULL,
 revision INTEGER NOT NULL, state TEXT NOT NULL CHECK(state IN('pending','running','failed','done','stopped','held')),
 evidence_id TEXT REFERENCES evidence_items(id) ON DELETE CASCADE,
 attempts INTEGER NOT NULL DEFAULT 0, claim TEXT, started_at TEXT, failure TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(guild_id,channel_id,message_id)
);
CREATE INDEX penny_discord_due ON penny_discord_jobs(state,created_at);
CREATE TABLE penny_discord_sources (
 evidence_id TEXT PRIMARY KEY REFERENCES evidence_items(id) ON DELETE CASCADE,
 job_id TEXT NOT NULL UNIQUE REFERENCES penny_discord_jobs(id) ON DELETE CASCADE, guild_id TEXT NOT NULL, channel_id TEXT NOT NULL, message_id TEXT NOT NULL,
 jump_url TEXT NOT NULL, capturer_id TEXT NOT NULL, capturer_name TEXT, author_id TEXT,
 source_hash TEXT NOT NULL, source_state TEXT NOT NULL CHECK(source_state IN('current','changed','removed','purged')),
 removed_at TEXT, purge_at TEXT, next_check TEXT NOT NULL, check_failure TEXT,
 UNIQUE(guild_id,channel_id,message_id)
);
CREATE TRIGGER penny_discord_jobs_redaction_insert AFTER INSERT ON penny_discord_jobs
BEGIN UPDATE penny_redaction_content SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER penny_discord_jobs_redaction_update AFTER UPDATE ON penny_discord_jobs
BEGIN UPDATE penny_redaction_content SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER penny_discord_jobs_redaction_delete AFTER DELETE ON penny_discord_jobs
BEGIN UPDATE penny_redaction_content SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER penny_discord_sources_redaction_insert AFTER INSERT ON penny_discord_sources
BEGIN UPDATE penny_redaction_content SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER penny_discord_sources_redaction_update AFTER UPDATE ON penny_discord_sources
BEGIN UPDATE penny_redaction_content SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER penny_discord_sources_redaction_delete AFTER DELETE ON penny_discord_sources
BEGIN UPDATE penny_redaction_content SET revision=revision+1 WHERE singleton=1; END;
-- Wording-free replay custody survives evidence erasure without retaining IDs.
CREATE TABLE penny_discord_receipts (
 source_digest TEXT PRIMARY KEY CHECK(length(source_digest)=64), created_at TEXT NOT NULL
);
