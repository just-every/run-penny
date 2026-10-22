CREATE TABLE penny_requester_oauth (
 provider TEXT PRIMARY KEY CHECK(provider IN ('google','github')),
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1))
);
CREATE TABLE penny_requester_oauth_states (
 state_hash TEXT PRIMARY KEY,
 provider TEXT NOT NULL CHECK(provider IN ('google','github')),
 challenge TEXT NOT NULL,
 pending_token TEXT,
 expires_at TEXT NOT NULL,
 claim_id TEXT,
 completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1))
);
