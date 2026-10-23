CREATE TABLE penny_saved_views (
 id TEXT PRIMARY KEY,
 list_kind TEXT NOT NULL CHECK(list_kind IN ('requests','evidence','roadmap')),
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 160),
 scope TEXT NOT NULL CHECK(scope IN ('private','shared')),
 creator_id TEXT REFERENCES operators(id) ON DELETE SET NULL,
 filter_json TEXT NOT NULL CHECK(json_valid(filter_json)),
 sort TEXT NOT NULL,
 columns_json TEXT NOT NULL CHECK(json_valid(columns_json)),
 presentation_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(presentation_json)),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
 restored_private INTEGER NOT NULL DEFAULT 0 CHECK(restored_private IN (0,1)),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX penny_saved_views_visibility ON penny_saved_views(list_kind,scope,creator_id);
CREATE TRIGGER data_guard_penny_saved_views_insert BEFORE INSERT ON penny_saved_views
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_saved_views_update BEFORE UPDATE ON penny_saved_views
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_saved_views_delete BEFORE DELETE ON penny_saved_views
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
