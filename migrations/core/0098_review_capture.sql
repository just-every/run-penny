-- CAP-020. Additive only. Provider credentials never enter portable archives.
CREATE TABLE penny_review_connections (
 id TEXT PRIMARY KEY, site TEXT NOT NULL CHECK(site IN('g2','capterra','trustradius','trustpilot','producthunt','appstore','googleplay')),
 listing TEXT NOT NULL, public_url TEXT, terms_accepted INTEGER NOT NULL CHECK(terms_accepted IN(0,1)),
 interval_hours INTEGER NOT NULL CHECK(interval_hours BETWEEN 1 AND 168), purge_days INTEGER NOT NULL CHECK(purge_days BETWEEN 0 AND 365), extract INTEGER NOT NULL CHECK(extract IN(0,1)),
 owner_id TEXT NOT NULL, owner_version INTEGER NOT NULL, actor_id TEXT NOT NULL,
 revision INTEGER NOT NULL, state TEXT NOT NULL CHECK(state IN('scheduled','running','failed','paused','disconnected','held')),
 cursor TEXT, claim TEXT, started_at TEXT, next_due TEXT NOT NULL, last_success TEXT, failure TEXT,
 captured INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL,
 UNIQUE(site,listing)
);
CREATE TABLE penny_review_credentials (
 connection_id TEXT PRIMARY KEY REFERENCES penny_review_connections(id) ON DELETE CASCADE,
 encrypted_token TEXT NOT NULL, refresh_claim TEXT
);
CREATE TABLE penny_review_sources (
 evidence_id TEXT PRIMARY KEY REFERENCES evidence_items(id) ON DELETE CASCADE,
 connection_id TEXT NOT NULL REFERENCES penny_review_connections(id), site TEXT NOT NULL, review_id TEXT NOT NULL,
 review_url TEXT NOT NULL, rating REAL, title TEXT, app_version TEXT, country TEXT,
 source_hash TEXT NOT NULL, source_state TEXT NOT NULL CHECK(source_state IN('current','changed','removed','purged')),
 captured_at TEXT NOT NULL, next_check TEXT NOT NULL, removed_at TEXT, purge_at TEXT,
 check_claim TEXT, check_started_at TEXT, check_failure TEXT,
 ai_state TEXT NOT NULL CHECK(ai_state IN('pending','running','failed','done','stopped')), ai_claim TEXT, ai_started_at TEXT, ai_failure TEXT,
 UNIQUE(site,review_id)
);
CREATE TABLE penny_review_proposals (
 id TEXT PRIMARY KEY, evidence_id TEXT NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
 version_id TEXT NOT NULL REFERENCES evidence_versions(id) ON DELETE CASCADE,
 problem TEXT NOT NULL, start_byte INTEGER NOT NULL, end_byte INTEGER NOT NULL, span TEXT NOT NULL,
 closest_request_id TEXT REFERENCES requests(id) ON DELETE SET NULL, created_at TEXT NOT NULL
);
CREATE TABLE penny_review_receipts (
 source_digest TEXT PRIMARY KEY CHECK(length(source_digest)=64), created_at TEXT NOT NULL
);
CREATE INDEX penny_reviews_due ON penny_review_connections(state,next_due);
CREATE INDEX penny_reviews_check_due ON penny_review_sources(source_state,next_check);
CREATE TRIGGER penny_review_no_identity_insert BEFORE INSERT ON evidence_items WHEN NEW.source_type='review' AND (NEW.requester_id IS NOT NULL OR NEW.admitted_sender IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'review_identity_forbidden'); END;
CREATE TRIGGER penny_review_no_identity_update BEFORE UPDATE ON evidence_items WHEN (OLD.source_type='review' OR NEW.source_type='review') AND (NEW.requester_id IS NOT NULL OR NEW.admitted_sender IS NOT NULL OR NEW.source_type<>'review')
BEGIN SELECT RAISE(ABORT,'review_identity_forbidden'); END;
-- A rewrite cannot leave a purported byte-exact citation pointing at new bytes.
CREATE TRIGGER penny_review_version_redaction AFTER UPDATE OF wording ON evidence_versions WHEN OLD.wording<>NEW.wording
BEGIN
 DELETE FROM penny_review_proposals WHERE version_id=NEW.id;
 UPDATE penny_review_sources SET ai_state='stopped',ai_claim=NULL,ai_failure='review_wording_changed' WHERE evidence_id=NEW.evidence_id;
END;
CREATE TRIGGER penny_review_metadata_redaction_insert AFTER INSERT ON penny_review_sources
BEGIN UPDATE penny_redaction_content SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER penny_review_metadata_redaction_update AFTER UPDATE ON penny_review_sources
BEGIN UPDATE penny_redaction_content SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER penny_review_metadata_redaction_delete AFTER DELETE ON penny_review_sources
BEGIN UPDATE penny_redaction_content SET revision=revision+1 WHERE singleton=1; END;
