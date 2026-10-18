ALTER TABLE request_notes ADD COLUMN parent_note_id TEXT REFERENCES request_notes(id) ON DELETE CASCADE;
CREATE INDEX request_notes_parent_idx ON request_notes(parent_note_id);
CREATE TABLE penny_note_mentions (
 note_id TEXT NOT NULL REFERENCES request_notes(id) ON DELETE CASCADE,
 operator_id TEXT NOT NULL REFERENCES operators(id),
 created_at TEXT NOT NULL,
 dismissed_at TEXT,
 PRIMARY KEY(note_id,operator_id)
);
CREATE TABLE penny_discussion_guards(id TEXT PRIMARY KEY,allowed INTEGER NOT NULL CONSTRAINT penny_discussion_admitted CHECK(allowed=1));
CREATE TRIGGER penny_note_thread_insert BEFORE INSERT ON request_notes WHEN NEW.parent_note_id IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM request_notes p WHERE p.id=NEW.parent_note_id AND p.request_id=NEW.request_id AND p.parent_note_id IS NULL) THEN RAISE(ABORT,'invalid_note_parent') END;
END;
CREATE TRIGGER data_guard_note_mentions_insert BEFORE INSERT ON penny_note_mentions WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id)))) BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_note_mentions_insert AFTER INSERT ON penny_note_mentions BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_note_mentions_update BEFORE UPDATE ON penny_note_mentions WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id)))) BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_note_mentions_update AFTER UPDATE ON penny_note_mentions BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_note_mentions_delete BEFORE DELETE ON penny_note_mentions WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id)))) BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_note_mentions_delete AFTER DELETE ON penny_note_mentions BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
