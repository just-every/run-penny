CREATE TABLE penny_integration_guards (
 id TEXT PRIMARY KEY,
 allowed INTEGER NOT NULL CONSTRAINT penny_integration_authority CHECK(allowed=1)
);
CREATE TABLE penny_api_issuance (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 native_operator_id TEXT NOT NULL,
 operator_version INTEGER NOT NULL,
 actor_id TEXT NOT NULL
);
CREATE TABLE penny_api_issuers (
 token_id TEXT PRIMARY KEY,
 native_operator_id TEXT NOT NULL,
 operator_version INTEGER NOT NULL,
 actor_id TEXT NOT NULL
);
CREATE TRIGGER penny_api_token_admission BEFORE INSERT ON integration_tokens
WHEN NEW.namespace='penny-api' AND NOT EXISTS(SELECT 1 FROM penny_api_issuance WHERE singleton=1)
BEGIN SELECT RAISE(ABORT,'penny_integration_authority'); END;

CREATE TRIGGER penny_api_token_custody AFTER INSERT ON integration_tokens
WHEN NEW.namespace='penny-api'
BEGIN
 INSERT INTO penny_api_issuers(token_id,native_operator_id,operator_version,actor_id)
 SELECT NEW.id,native_operator_id,operator_version,actor_id FROM penny_api_issuance WHERE singleton=1;
END;

CREATE TRIGGER penny_integration_deliveries_insert BEFORE INSERT ON integration_deliveries
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_integration_deliveries_update BEFORE UPDATE ON integration_deliveries
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_integration_deliveries_delete BEFORE DELETE ON integration_deliveries
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_integration_attempts_insert BEFORE INSERT ON integration_attempts
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_integration_attempts_update BEFORE UPDATE ON integration_attempts
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_integration_attempts_delete BEFORE DELETE ON integration_attempts
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_integration_resolutions_insert BEFORE INSERT ON integration_resolutions
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_integration_resolutions_update BEFORE UPDATE ON integration_resolutions
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_integration_resolutions_delete BEFORE DELETE ON integration_resolutions
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_integration_replays_insert BEFORE INSERT ON integration_replays
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_integration_replays_update BEFORE UPDATE ON integration_replays
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

CREATE TRIGGER penny_integration_replays_delete BEFORE DELETE ON integration_replays
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
