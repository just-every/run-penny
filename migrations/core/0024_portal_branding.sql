CREATE TABLE penny_portal_branding (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 description TEXT NOT NULL, accent TEXT NOT NULL, show_logo INTEGER NOT NULL CHECK(show_logo IN(0,1)),
 updated_at INTEGER NOT NULL
);
CREATE TRIGGER data_guard_penny_portal_branding_insert BEFORE INSERT ON penny_portal_branding
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_portal_branding_update BEFORE UPDATE ON penny_portal_branding
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_portal_branding_delete BEFORE DELETE ON penny_portal_branding
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
