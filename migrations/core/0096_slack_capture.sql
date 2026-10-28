-- Credentials, grants and resumable ingress work belong to this installation.
CREATE TABLE penny_chat_connections (
 id TEXT PRIMARY KEY, team_id TEXT NOT NULL, app_id TEXT NOT NULL,
 channels_json TEXT NOT NULL, mappings_json TEXT NOT NULL, reaction TEXT NOT NULL,
 purge_days INTEGER NOT NULL CHECK(purge_days BETWEEN 0 AND 365),
 native_operator_id TEXT NOT NULL, operator_version INTEGER NOT NULL,
 actor_id TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'active' CHECK(state IN('active','paused','revoked')),
 created_at INTEGER NOT NULL, last_success_at INTEGER, last_failure TEXT
);
CREATE TABLE penny_chat_secrets (
 connection_id TEXT PRIMARY KEY REFERENCES penny_chat_connections(id) ON DELETE CASCADE,
 bot_token TEXT NOT NULL, signing_secret TEXT NOT NULL
);
CREATE TABLE penny_chat_jobs (
 id TEXT PRIMARY KEY, connection_id TEXT NOT NULL REFERENCES penny_chat_connections(id),
 receipt TEXT NOT NULL, channel_id TEXT NOT NULL, message_ts TEXT NOT NULL,
 capturer TEXT, kind TEXT NOT NULL CHECK(kind IN('capture','refresh','remove')),
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN('pending','running','failed','succeeded','stopped')),
 attempts INTEGER NOT NULL DEFAULT 0, due_at INTEGER NOT NULL, lease TEXT, lease_until INTEGER,
 failure TEXT, created_at INTEGER NOT NULL,
 UNIQUE(connection_id,receipt)
);
CREATE INDEX penny_chat_jobs_due ON penny_chat_jobs(state,due_at);
-- Only the selected, redacted excerpt is evidence. No event envelope or thread is retained.
CREATE TABLE penny_chat_sources (
 evidence_id TEXT PRIMARY KEY REFERENCES evidence_items(id) ON DELETE CASCADE,
 connection_id TEXT NOT NULL, workspace_id TEXT NOT NULL, channel_id TEXT NOT NULL, message_ts TEXT NOT NULL,
 thread_ts TEXT NOT NULL, source_url TEXT NOT NULL, source_author TEXT,
 capturer TEXT, source_team TEXT, fingerprint TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'captured' CHECK(state IN('captured','changed','removed','purged')),
 removed_at INTEGER, purge_at INTEGER, check_at INTEGER NOT NULL,
 UNIQUE(workspace_id,channel_id,message_ts)
);
CREATE INDEX penny_chat_sources_due ON penny_chat_sources(check_at);
