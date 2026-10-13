-- Preview metadata has its own monotonic witness: undo preflight writes receipt
-- notes, and must not invalidate feedback_import_native_revision itself.
-- Installation-only; no native product definition or portable identity changes.
CREATE TABLE IF NOT EXISTS feedback_import_preview_revision(singleton INTEGER PRIMARY KEY CHECK(singleton=1),revision INTEGER NOT NULL CHECK(revision>=0));
INSERT OR IGNORE INTO feedback_import_preview_revision VALUES(1,0);
CREATE TRIGGER IF NOT EXISTS feedback_preview_revision_monotonic BEFORE UPDATE ON feedback_import_preview_revision WHEN NEW.singleton IS NOT OLD.singleton OR NEW.revision<=OLD.revision BEGIN SELECT RAISE(ABORT,'feedback_preview_revision_changed'); END;
CREATE TRIGGER IF NOT EXISTS feedback_preview_revision_delete BEFORE DELETE ON feedback_import_preview_revision BEGIN SELECT RAISE(ABORT,'feedback_preview_revision_changed'); END;
CREATE TRIGGER IF NOT EXISTS feedback_preview_feedback_import_bundles_insert AFTER INSERT ON feedback_import_bundles BEGIN UPDATE feedback_import_preview_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER IF NOT EXISTS feedback_preview_feedback_import_bundles_update AFTER UPDATE ON feedback_import_bundles BEGIN UPDATE feedback_import_preview_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER IF NOT EXISTS feedback_preview_feedback_import_bundles_delete AFTER DELETE ON feedback_import_bundles BEGIN UPDATE feedback_import_preview_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER IF NOT EXISTS feedback_preview_feedback_import_original_chunks_insert AFTER INSERT ON feedback_import_original_chunks BEGIN UPDATE feedback_import_preview_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER IF NOT EXISTS feedback_preview_feedback_import_original_chunks_update AFTER UPDATE ON feedback_import_original_chunks BEGIN UPDATE feedback_import_preview_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER IF NOT EXISTS feedback_preview_feedback_import_original_chunks_delete AFTER DELETE ON feedback_import_original_chunks BEGIN UPDATE feedback_import_preview_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER IF NOT EXISTS feedback_preview_feedback_import_receipt_notes_insert AFTER INSERT ON feedback_import_receipt_notes BEGIN UPDATE feedback_import_preview_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER IF NOT EXISTS feedback_preview_feedback_import_receipt_notes_update AFTER UPDATE ON feedback_import_receipt_notes BEGIN UPDATE feedback_import_preview_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER IF NOT EXISTS feedback_preview_feedback_import_receipt_notes_delete AFTER DELETE ON feedback_import_receipt_notes BEGIN UPDATE feedback_import_preview_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER IF NOT EXISTS feedback_preview_feedback_import_records_insert AFTER INSERT ON feedback_import_records BEGIN UPDATE feedback_import_preview_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER IF NOT EXISTS feedback_preview_feedback_import_records_update AFTER UPDATE ON feedback_import_records BEGIN UPDATE feedback_import_preview_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER IF NOT EXISTS feedback_preview_feedback_import_records_delete AFTER DELETE ON feedback_import_records BEGIN UPDATE feedback_import_preview_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER IF NOT EXISTS feedback_preview_feedback_import_tombstones_insert AFTER INSERT ON feedback_import_tombstones BEGIN UPDATE feedback_import_preview_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER IF NOT EXISTS feedback_preview_feedback_import_tombstones_update AFTER UPDATE ON feedback_import_tombstones BEGIN UPDATE feedback_import_preview_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER IF NOT EXISTS feedback_preview_feedback_import_tombstones_delete AFTER DELETE ON feedback_import_tombstones BEGIN UPDATE feedback_import_preview_revision SET revision=revision+1 WHERE singleton=1; END;
