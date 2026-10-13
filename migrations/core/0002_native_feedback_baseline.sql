-- Additive Stage 1 foundation. Stage 0 migration is retained byte-for-byte.
-- Parked 0002_auth is comparison source; its entire dependency graph is unported.
CREATE TABLE native_magic_links (
 id TEXT PRIMARY KEY NOT NULL, purpose TEXT NOT NULL CHECK(purpose IN ('operator','requester')),
 email TEXT NOT NULL, display_name TEXT, token_hash TEXT NOT NULL UNIQUE,
 expires_at TEXT NOT NULL, consumed_at TEXT, claim_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE native_requester_sessions (
 id TEXT PRIMARY KEY NOT NULL, requester_id TEXT NOT NULL REFERENCES requesters(id),
 address_id TEXT NOT NULL REFERENCES requester_addresses(id), token_hash TEXT NOT NULL UNIQUE,
 expires_at TEXT NOT NULL, last_used_at TEXT NOT NULL, revoked_at TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE native_rate_limits (
 scope TEXT NOT NULL, subject_hash TEXT NOT NULL, count INTEGER NOT NULL,
 expires_at TEXT NOT NULL, PRIMARY KEY(scope,subject_hash)
);
-- Explicit local/test transport only. Never read by an HTTP route.
CREATE TABLE local_auth_outbox (
 id TEXT PRIMARY KEY NOT NULL REFERENCES native_magic_links(id), recipient TEXT NOT NULL,
 purpose TEXT NOT NULL, token TEXT NOT NULL, expires_at TEXT NOT NULL,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE request_submission_keys (
 key_hash TEXT PRIMARY KEY NOT NULL, body_hash TEXT NOT NULL,
 request_id TEXT NOT NULL REFERENCES requests(id), evidence_id TEXT NOT NULL REFERENCES evidence_items(id),
 expires_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
ALTER TABLE requests ADD COLUMN approved_author_name TEXT;
CREATE TABLE native_moderation_events (
 id TEXT PRIMARY KEY NOT NULL, request_id TEXT NOT NULL REFERENCES requests(id),
 actor_id TEXT NOT NULL REFERENCES operators(id), verdict TEXT NOT NULL CHECK(verdict IN ('approved','rejected')),
 reason TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
