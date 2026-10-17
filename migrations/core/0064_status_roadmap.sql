-- Keep an existing roadmap's publication policy; empty installations start
-- from the requests' public statuses. No request or approval is changed.
CREATE TABLE penny_status_roadmap_settings (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 source TEXT NOT NULL CHECK(source IN ('approved_items','request_statuses')),
 board_slugs_json TEXT NOT NULL CHECK(json_valid(board_slugs_json) AND json_type(board_slugs_json)='array'),
 columns_json TEXT NOT NULL CHECK(json_valid(columns_json) AND json_type(columns_json)='array' AND json_array_length(columns_json)=4),
 shipped_days INTEGER CHECK(shipped_days IS NULL OR shipped_days IN (30,90,365)),
 updated_at TEXT NOT NULL
);
INSERT INTO penny_status_roadmap_settings(singleton,source,board_slugs_json,columns_json,shipped_days,updated_at)
SELECT 1,CASE WHEN EXISTS(SELECT 1 FROM roadmap_items) THEN 'approved_items' ELSE 'request_statuses' END,
 '[]','[{"status":"under_review","label":"Under review","visible":true},{"status":"planned","label":"Planned","visible":true},{"status":"in_progress","label":"In progress","visible":true},{"status":"shipped","label":"Shipped","visible":true}]',NULL,
 strftime('%Y-%m-%dT%H:%M:%fZ','now');

CREATE TRIGGER data_guard_penny_status_roadmap_settings_insert BEFORE INSERT ON penny_status_roadmap_settings
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_status_roadmap_settings_update BEFORE UPDATE ON penny_status_roadmap_settings
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_status_roadmap_settings_delete BEFORE DELETE ON penny_status_roadmap_settings
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
