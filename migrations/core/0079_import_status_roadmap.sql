-- A reviewed import owns a reversible settings transition, not a second roadmap.
CREATE TABLE penny_import_roadmaps (
 id TEXT PRIMARY KEY,
 before_json TEXT NOT NULL CHECK(json_valid(before_json) AND json_array_length(before_json)=5),
 after_json TEXT NOT NULL CHECK(json_valid(after_json) AND json_array_length(after_json)=5),
 created_at TEXT NOT NULL
);
CREATE TRIGGER import_roadmap_apply BEFORE INSERT ON penny_import_roadmaps
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM penny_status_roadmap_settings WHERE singleton=1 AND json_array(source,board_slugs_json,columns_json,shipped_days,updated_at)=NEW.before_json) THEN 1 ELSE RAISE(ABORT,'feedback_roadmap_changed') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM json_each(json_extract(NEW.after_json,'$[1]')) selected WHERE NOT EXISTS(SELECT 1 FROM boards b WHERE b.slug=selected.value AND b.visibility='public' AND b.archived_at IS NULL)) THEN 1 ELSE RAISE(ABORT,'public_roadmap_board_unavailable') END;
 UPDATE penny_status_roadmap_settings SET source=json_extract(NEW.after_json,'$[0]'),board_slugs_json=json_extract(NEW.after_json,'$[1]'),columns_json=json_extract(NEW.after_json,'$[2]'),shipped_days=json_extract(NEW.after_json,'$[3]'),updated_at=json_extract(NEW.after_json,'$[4]') WHERE singleton=1;
END;
CREATE TRIGGER import_roadmap_reverse BEFORE DELETE ON penny_import_roadmaps
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM penny_status_roadmap_settings WHERE singleton=1 AND json_array(source,board_slugs_json,columns_json,shipped_days,updated_at)=OLD.after_json) THEN 1 ELSE RAISE(ABORT,'feedback_roadmap_changed') END;
 UPDATE penny_status_roadmap_settings SET source=json_extract(OLD.before_json,'$[0]'),board_slugs_json=json_extract(OLD.before_json,'$[1]'),columns_json=json_extract(OLD.before_json,'$[2]'),shipped_days=json_extract(OLD.before_json,'$[3]'),updated_at=json_extract(OLD.before_json,'$[4]') WHERE singleton=1;
END;
CREATE TRIGGER feedback_native_penny_import_roadmaps_insert AFTER INSERT ON penny_import_roadmaps
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER feedback_native_penny_import_roadmaps_update AFTER UPDATE ON penny_import_roadmaps
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER feedback_native_penny_import_roadmaps_delete AFTER DELETE ON penny_import_roadmaps
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER feedback_native_penny_status_roadmap_settings_insert AFTER INSERT ON penny_status_roadmap_settings
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER feedback_native_penny_status_roadmap_settings_update AFTER UPDATE ON penny_status_roadmap_settings
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER feedback_native_penny_status_roadmap_settings_delete AFTER DELETE ON penny_status_roadmap_settings
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_import_roadmaps_insert BEFORE INSERT ON penny_import_roadmaps
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_import_roadmaps_update BEFORE UPDATE ON penny_import_roadmaps
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_import_roadmaps_delete BEFORE DELETE ON penny_import_roadmaps
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
