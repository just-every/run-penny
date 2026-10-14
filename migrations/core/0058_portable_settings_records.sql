-- Embedding settings join integration destinations and tracker connections as
-- durable records that product archives carry (credentials stay in their
-- installation tables); maintenance fences settings writes like other records.
CREATE TRIGGER data_guard_penny_frame_settings_insert BEFORE INSERT ON penny_frame_settings
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_penny_frame_settings_update BEFORE UPDATE ON penny_frame_settings
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_penny_frame_settings_delete BEFORE DELETE ON penny_frame_settings
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
-- Penny maintenance admission for Base's preparation-steps control table (0056).
CREATE TRIGGER penny_ik_d1_preparation_steps_insert BEFORE INSERT ON ik_d1_preparation_steps
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER penny_ik_d1_preparation_steps_update BEFORE UPDATE ON ik_d1_preparation_steps
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER penny_ik_d1_preparation_steps_delete BEFORE DELETE ON ik_d1_preparation_steps
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
