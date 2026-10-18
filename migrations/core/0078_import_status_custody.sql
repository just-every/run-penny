-- Invalidate saved-import reversal preflights when shared status definitions change.
CREATE TRIGGER feedback_native_request_internal_statuses_insert AFTER INSERT ON request_internal_statuses
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER feedback_native_request_internal_statuses_update AFTER UPDATE ON request_internal_statuses
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER feedback_native_request_internal_statuses_delete AFTER DELETE ON request_internal_statuses
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
