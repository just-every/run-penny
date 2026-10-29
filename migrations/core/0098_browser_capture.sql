-- Browser drafts are explicit selected-page work. Native session custody never travels.
CREATE TABLE penny_browser_captures (
 id TEXT PRIMARY KEY,
 evidence_id TEXT NOT NULL UNIQUE REFERENCES evidence_items(id) ON DELETE CASCADE,
 page_url TEXT NOT NULL, source_hash TEXT NOT NULL, payload_hash TEXT NOT NULL,
 source_state TEXT NOT NULL DEFAULT 'current' CHECK(source_state IN('current','changed','removed','purged')),
 purge_days INTEGER NOT NULL CHECK(purge_days BETWEEN 0 AND 365), purge_at TEXT,
 state TEXT NOT NULL CHECK(state IN('uploading','pending','running','failed','done','stopped','held')),
 failure TEXT, started_at TEXT, claim TEXT,
 screenshot_hash TEXT, screenshot_bytes INTEGER,
 request_id TEXT REFERENCES requests(id), requester_id TEXT REFERENCES requesters(id),
 proxy_vote INTEGER NOT NULL CHECK(proxy_vote IN(0,1)),
 actor_id TEXT REFERENCES operators(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX penny_browser_due ON penny_browser_captures(state,created_at);
CREATE TABLE penny_browser_authority (
 capture_id TEXT PRIMARY KEY REFERENCES penny_browser_captures(id) ON DELETE CASCADE,
 session_id TEXT NOT NULL, owner_id TEXT NOT NULL, owner_version INTEGER NOT NULL
);
-- Wording-free retry custody prevents recreation after erasure.
CREATE TABLE penny_browser_receipts (capture_digest TEXT PRIMARY KEY, created_at TEXT NOT NULL);
CREATE TRIGGER penny_browser_redaction_insert AFTER INSERT ON penny_browser_captures
BEGIN UPDATE penny_redaction_content SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER penny_browser_redaction_update AFTER UPDATE ON penny_browser_captures
BEGIN UPDATE penny_redaction_content SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER penny_browser_redaction_delete AFTER DELETE ON penny_browser_captures
BEGIN UPDATE penny_redaction_content SET revision=revision+1 WHERE singleton=1; END;
