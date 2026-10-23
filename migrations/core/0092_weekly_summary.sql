-- Explicit, address-bound weekly choice; owner sending stays off until enabled.
CREATE TABLE penny_weekly_summary (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 enabled INTEGER NOT NULL CHECK(enabled IN(0,1)), enabled_at TEXT, updated_at TEXT NOT NULL
);
CREATE TABLE penny_weekly_choices (
 requester_id TEXT PRIMARY KEY REFERENCES requesters(id),
 address_id TEXT NOT NULL REFERENCES requester_addresses(id),
 subscribed INTEGER NOT NULL CHECK(subscribed IN(0,1)), verification_epoch INTEGER NOT NULL,
 granted_at TEXT NOT NULL, revoked_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TRIGGER data_guard_penny_weekly_summary_insert BEFORE INSERT ON penny_weekly_summary
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_weekly_summary_insert AFTER INSERT ON penny_weekly_summary
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_weekly_summary_update BEFORE UPDATE ON penny_weekly_summary
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_weekly_summary_update AFTER UPDATE ON penny_weekly_summary
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_weekly_summary_delete BEFORE DELETE ON penny_weekly_summary
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_weekly_summary_delete AFTER DELETE ON penny_weekly_summary
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_weekly_choices_insert BEFORE INSERT ON penny_weekly_choices
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_weekly_choices_insert AFTER INSERT ON penny_weekly_choices
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_weekly_choices_update BEFORE UPDATE ON penny_weekly_choices
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_weekly_choices_update AFTER UPDATE ON penny_weekly_choices
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_weekly_choices_delete BEFORE DELETE ON penny_weekly_choices
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_weekly_choices_delete AFTER DELETE ON penny_weekly_choices
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
