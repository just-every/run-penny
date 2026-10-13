-- Provisional successor to the unapplied T-117 0005. Applied 0001..0004 and
-- candidate 0005 are unchanged. Keep direct contributions at their origin;
-- request_votes/follows/evidence_links remain the current canonical projection.
CREATE VIEW request_canonical_roots AS
WITH RECURSIVE paths(origin_id, current_id, depth) AS (
  SELECT id, id, 0 FROM requests
  UNION ALL
  SELECT paths.origin_id, r.merged_into_request_id, paths.depth+1 FROM paths
  JOIN requests r ON r.id = paths.current_id WHERE r.merged_into_request_id IS NOT NULL
)
SELECT paths.origin_id, paths.current_id AS canonical_id,paths.depth FROM paths
JOIN requests r ON r.id = paths.current_id WHERE r.merged_into_request_id IS NULL;

CREATE TABLE request_vote_contributions (
  request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  requester_id TEXT NOT NULL REFERENCES requesters(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY(request_id, requester_id)
);
CREATE TABLE request_follow_contributions (
  request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  requester_id TEXT NOT NULL REFERENCES requesters(id) ON DELETE CASCADE,
  permission_granted_at TEXT NOT NULL, muted_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY(request_id, requester_id)
);
CREATE TABLE request_evidence_contributions (
  request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  evidence_id TEXT NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY(request_id, evidence_id)
);

-- Recover origins from active snapshots plus current rows. An unchanged copy
-- introduced by an incoming merge is inherited, not a second direct contribution.
INSERT INTO request_vote_contributions
SELECT v.request_id,v.requester_id,v.created_at,v.updated_at FROM request_votes v
WHERE NOT EXISTS (SELECT 1 FROM request_merges m JOIN request_merge_vote_transfers t ON t.merge_id=m.id
 WHERE m.unmerged_at IS NULL AND m.target_request_id=v.request_id AND t.requester_id=v.requester_id
 AND t.target_had_vote=0 AND t.source_created_at=v.created_at AND t.source_updated_at=v.updated_at);
INSERT OR IGNORE INTO request_vote_contributions
SELECT m.source_request_id,t.requester_id,t.source_created_at,t.source_updated_at
FROM request_merges m JOIN request_merge_vote_transfers t ON t.merge_id=m.id
JOIN request_canonical_roots root ON root.origin_id=m.source_request_id
WHERE m.unmerged_at IS NULL
 AND EXISTS(SELECT 1 FROM request_votes v WHERE v.request_id=root.canonical_id AND v.requester_id=t.requester_id)
 AND NOT EXISTS(SELECT 1 FROM request_merges child JOIN request_merge_vote_transfers ct ON ct.merge_id=child.id
 WHERE child.unmerged_at IS NULL AND child.target_request_id=m.source_request_id AND ct.requester_id=t.requester_id
 AND ct.target_had_vote=0 AND ct.source_created_at=t.source_created_at AND ct.source_updated_at=t.source_updated_at);

INSERT INTO request_follow_contributions
SELECT f.request_id,f.requester_id,f.permission_granted_at,f.muted_at,f.created_at,f.updated_at FROM request_follows f
WHERE NOT EXISTS(SELECT 1 FROM request_merges m JOIN request_merge_follow_transfers t ON t.merge_id=m.id
 WHERE m.unmerged_at IS NULL AND m.target_request_id=f.request_id AND t.requester_id=f.requester_id
 AND t.target_had_follow=0 AND t.source_created_at=f.created_at AND t.source_updated_at=f.updated_at);
INSERT OR IGNORE INTO request_follow_contributions
SELECT m.source_request_id,t.requester_id,t.source_permission_granted_at,CASE WHEN f.updated_at>t.source_updated_at THEN f.muted_at ELSE t.source_muted_at END,t.source_created_at,t.source_updated_at
FROM request_merges m JOIN request_merge_follow_transfers t ON t.merge_id=m.id
JOIN request_canonical_roots root ON root.origin_id=m.source_request_id
JOIN request_follows f ON f.request_id=root.canonical_id AND f.requester_id=t.requester_id
WHERE m.unmerged_at IS NULL AND NOT EXISTS(SELECT 1 FROM request_merges child JOIN request_merge_follow_transfers ct ON ct.merge_id=child.id
 WHERE child.unmerged_at IS NULL AND child.target_request_id=m.source_request_id AND ct.requester_id=t.requester_id
 AND ct.target_had_follow=0 AND ct.source_created_at=t.source_created_at AND ct.source_updated_at=t.source_updated_at);

INSERT INTO request_evidence_contributions
SELECT l.request_id,l.evidence_id,l.created_at FROM request_evidence_links l
WHERE NOT EXISTS(SELECT 1 FROM request_merges m JOIN request_merge_evidence_transfers t ON t.merge_id=m.id
 WHERE m.unmerged_at IS NULL AND m.target_request_id=l.request_id AND t.evidence_id=l.evidence_id AND t.target_was_linked=0);
INSERT OR IGNORE INTO request_evidence_contributions
SELECT m.source_request_id,t.evidence_id,t.created_at FROM request_merges m JOIN request_merge_evidence_transfers t ON t.merge_id=m.id
WHERE m.unmerged_at IS NULL AND NOT EXISTS(SELECT 1 FROM request_merges child JOIN request_merge_evidence_transfers ct ON ct.merge_id=child.id
 WHERE child.unmerged_at IS NULL AND child.target_request_id=m.source_request_id AND ct.evidence_id=t.evidence_id AND ct.target_was_linked=0);

ALTER TABLE request_comments ADD COLUMN origin_request_id TEXT;
ALTER TABLE attachments ADD COLUMN origin_request_id TEXT;
UPDATE request_comments SET origin_request_id=COALESCE((
 SELECT m.source_request_id FROM request_merges m JOIN request_merge_comment_transfers t ON t.merge_id=m.id
 WHERE m.unmerged_at IS NULL AND t.comment_id=request_comments.id ORDER BY (SELECT depth FROM request_canonical_roots WHERE origin_id=m.source_request_id) DESC,m.merged_at,m.id LIMIT 1),request_id);
UPDATE attachments SET origin_request_id=COALESCE((
 SELECT m.source_request_id FROM request_merges m JOIN request_merge_attachment_transfers t ON t.merge_id=m.id
 WHERE m.unmerged_at IS NULL AND t.attachment_id=attachments.id ORDER BY (SELECT depth FROM request_canonical_roots WHERE origin_id=m.source_request_id) DESC,m.merged_at,m.id LIMIT 1),request_id);
CREATE TRIGGER request_comment_origin AFTER INSERT ON request_comments WHEN NEW.origin_request_id IS NULL
BEGIN UPDATE request_comments SET origin_request_id=NEW.request_id WHERE id=NEW.id; END;
CREATE TRIGGER request_attachment_origin AFTER INSERT ON attachments WHEN NEW.origin_request_id IS NULL
BEGIN UPDATE attachments SET origin_request_id=NEW.request_id WHERE id=NEW.id; END;

CREATE TRIGGER request_unmerge_once BEFORE UPDATE OF unmerged_at ON request_merges
WHEN OLD.unmerged_at IS NOT NULL
BEGIN SELECT RAISE(ABORT,'request_unmerge_conflict'); END;

ALTER TABLE request_moderation_appeals ADD COLUMN resolution TEXT;
ALTER TABLE request_moderation_appeals ADD COLUMN resolution_reason TEXT;
ALTER TABLE request_moderation_appeals ADD COLUMN resolution_id TEXT;

ALTER TABLE native_magic_links ADD COLUMN pending_email_hash TEXT;
ALTER TABLE request_content_submissions ADD COLUMN is_initial INTEGER NOT NULL DEFAULT 0 CHECK(is_initial IN (0,1));
UPDATE request_content_submissions SET is_initial=1 WHERE id=(
 SELECT original.id FROM request_content_submissions original WHERE original.request_id=request_content_submissions.request_id ORDER BY original.created_at,original.id LIMIT 1)
 AND EXISTS(SELECT 1 FROM requests r WHERE r.id=request_id AND r.author_requester_id IS NOT NULL);

CREATE TABLE request_attachment_uploads (
  id TEXT PRIMARY KEY NOT NULL,
  request_id TEXT NOT NULL REFERENCES requests(id),
  storage_key TEXT NOT NULL UNIQUE, original_filename TEXT NOT NULL,
  content_type TEXT NOT NULL, byte_size INTEGER NOT NULL, sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
