-- Bind product actor foreign keys to immutable native operator identities.
CREATE TABLE penny_agent_people (
 native_operator_id TEXT PRIMARY KEY REFERENCES oa_operators(id),
 actor_id TEXT NOT NULL UNIQUE REFERENCES operators(id)
);
INSERT INTO penny_agent_people(native_operator_id,actor_id)
 SELECT n.id,p.id FROM oa_operators n JOIN operators p ON p.email=n.email;
ALTER TABLE audit_entries ADD COLUMN agent_id TEXT;
ALTER TABLE audit_entries ADD COLUMN agent_name TEXT;
ALTER TABLE audit_entries ADD COLUMN sponsor_native_id TEXT;
ALTER TABLE audit_entries ADD COLUMN prepared_by TEXT;
ALTER TABLE audit_entries ADD COLUMN approvers_json TEXT;
ALTER TABLE audit_entries ADD COLUMN door_operation_id TEXT;
-- This transient row exists only inside a guarded native transaction.
CREATE TABLE penny_agent_attribution (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), agent_id TEXT NOT NULL,
 agent_name TEXT NOT NULL, sponsor_native_id TEXT NOT NULL, prepared_by TEXT NOT NULL,
 approvers_json TEXT NOT NULL, operation_id TEXT NOT NULL
);
CREATE TRIGGER penny_agent_audit AFTER INSERT ON audit_entries
 WHEN EXISTS(SELECT 1 FROM penny_agent_attribution WHERE singleton=1)
 BEGIN
 UPDATE audit_entries SET
  agent_id=(SELECT agent_id FROM penny_agent_attribution),
  agent_name=(SELECT agent_name FROM penny_agent_attribution),
  sponsor_native_id=(SELECT sponsor_native_id FROM penny_agent_attribution),
  prepared_by=(SELECT prepared_by FROM penny_agent_attribution),
  approvers_json=(SELECT approvers_json FROM penny_agent_attribution),
  door_operation_id=(SELECT operation_id FROM penny_agent_attribution)
 WHERE id=NEW.id;
 END;
