-- Additive board policy; existing requests and publication snapshots are retained.
ALTER TABLE boards ADD COLUMN category_mode TEXT NOT NULL DEFAULT 'off' CHECK(category_mode IN ('off','optional','required'));
ALTER TABLE boards ADD COLUMN posting_policy TEXT NOT NULL DEFAULT 'requesters' CHECK(posting_policy IN ('requesters','operators'));
ALTER TABLE boards ADD COLUMN comments_allowed INTEGER NOT NULL DEFAULT 1 CHECK(comments_allowed IN (0,1));
ALTER TABLE boards ADD COLUMN show_vote_counts INTEGER NOT NULL DEFAULT 1 CHECK(show_vote_counts IN (0,1));
ALTER TABLE boards ADD COLUMN show_voters INTEGER NOT NULL DEFAULT 0 CHECK(show_voters IN (0,1));
ALTER TABLE boards ADD COLUMN anonymous_requesters INTEGER NOT NULL DEFAULT 0 CHECK(anonymous_requesters IN (0,1));
CREATE TABLE request_categories (
 id TEXT PRIMARY KEY NOT NULL,
 board_id TEXT NOT NULL REFERENCES boards(id),
 parent_id TEXT REFERENCES request_categories(id),
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 160),
 position INTEGER NOT NULL DEFAULT 0 CHECK(position>=0),
 archived_at TEXT,
 merged_into_category_id TEXT REFERENCES request_categories(id),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 CHECK(parent_id IS NULL OR parent_id<>id),
 CHECK(merged_into_category_id IS NULL OR (merged_into_category_id<>id AND archived_at IS NOT NULL))
);
ALTER TABLE requests ADD COLUMN category_id TEXT REFERENCES request_categories(id);
CREATE INDEX request_categories_board_order_idx ON request_categories(board_id,parent_id,position,name);
CREATE INDEX requests_category_public_idx ON requests(category_id,moderation_state,published_at);
CREATE INDEX request_votes_trending_idx ON request_votes(request_id,created_at);
CREATE TRIGGER request_category_shape_insert BEFORE INSERT ON request_categories
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' BEGIN
 SELECT CASE WHEN NEW.parent_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM request_categories parent WHERE parent.id=NEW.parent_id AND parent.board_id=NEW.board_id
   AND parent.parent_id IS NULL AND parent.merged_into_category_id IS NULL
 ) THEN RAISE(ABORT,'invalid_category_parent') END;
 SELECT CASE WHEN NEW.parent_id IS NOT NULL AND EXISTS(SELECT 1 FROM request_categories child WHERE child.parent_id=NEW.id)
  THEN RAISE(ABORT,'category_depth_exceeded') END;
 SELECT CASE WHEN NEW.merged_into_category_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM request_categories target WHERE target.id=NEW.merged_into_category_id AND target.board_id=NEW.board_id
   AND target.archived_at IS NULL AND target.merged_into_category_id IS NULL
 ) THEN RAISE(ABORT,'invalid_category_merge') END;
END;
CREATE TRIGGER request_category_shape_update BEFORE UPDATE ON request_categories
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' BEGIN
 SELECT CASE WHEN NEW.parent_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM request_categories parent WHERE parent.id=NEW.parent_id AND parent.board_id=NEW.board_id
   AND parent.parent_id IS NULL AND parent.merged_into_category_id IS NULL
 ) THEN RAISE(ABORT,'invalid_category_parent') END;
 SELECT CASE WHEN NEW.parent_id IS NOT NULL AND EXISTS(SELECT 1 FROM request_categories child WHERE child.parent_id=NEW.id)
  THEN RAISE(ABORT,'category_depth_exceeded') END;
 SELECT CASE WHEN NEW.merged_into_category_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM request_categories target WHERE target.id=NEW.merged_into_category_id AND target.board_id=NEW.board_id
   AND target.archived_at IS NULL AND target.merged_into_category_id IS NULL
 ) THEN RAISE(ABORT,'invalid_category_merge') END;
END;
CREATE TRIGGER request_category_board_insert BEFORE INSERT ON requests
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND NEW.category_id IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM request_categories c WHERE c.id=NEW.category_id AND c.board_id=NEW.board_id AND c.merged_into_category_id IS NULL)
 THEN RAISE(ABORT,'invalid_request_category') END;
END;
CREATE TRIGGER request_category_board_update BEFORE UPDATE OF board_id,category_id ON requests
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND NEW.category_id IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM request_categories c WHERE c.id=NEW.category_id AND c.board_id=NEW.board_id AND c.merged_into_category_id IS NULL)
 THEN RAISE(ABORT,'invalid_request_category') END;
END;
CREATE TRIGGER data_guard_request_categories_insert BEFORE INSERT ON request_categories
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_request_categories_update BEFORE UPDATE ON request_categories
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_request_categories_delete BEFORE DELETE ON request_categories
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

-- Category work participates in the saved-import reversal freshness fence.
CREATE TRIGGER feedback_native_request_categories_insert AFTER INSERT ON request_categories BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER feedback_native_request_categories_update AFTER UPDATE ON request_categories BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER feedback_native_request_categories_delete AFTER DELETE ON request_categories BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
