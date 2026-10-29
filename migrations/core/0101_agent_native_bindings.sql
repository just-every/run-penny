-- Native identities keep their existing product actor; addresses are never a
-- credential lookup after this one-time migration/explicit account creation.
CREATE TABLE penny_operator_bindings (
 native_operator_id TEXT PRIMARY KEY REFERENCES oa_operators(id) ON DELETE CASCADE,
 actor_id TEXT NOT NULL UNIQUE REFERENCES operators(id) ON DELETE CASCADE
);
INSERT INTO operators(id,email,display_name,created_at,updated_at)
 SELECT o.id,o.email,o.display_name,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')
 FROM oa_operators o WHERE NOT EXISTS(SELECT 1 FROM operators p WHERE p.email=o.email);
INSERT INTO penny_operator_bindings(native_operator_id,actor_id)
 SELECT o.id,p.id FROM oa_operators o JOIN operators p ON p.email=o.email;
CREATE TRIGGER penny_operator_actor_insert AFTER INSERT ON oa_operators BEGIN
 INSERT INTO operators(id,email,display_name,created_at,updated_at)
  VALUES(NEW.id,NEW.email,NEW.display_name,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
 INSERT INTO penny_operator_bindings(native_operator_id,actor_id) VALUES(NEW.id,NEW.id);
END;
CREATE TABLE penny_agent_transaction (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), native_id TEXT NOT NULL,
 agent TEXT NOT NULL, label TEXT NOT NULL, approvers TEXT NOT NULL, consent TEXT,
 scopes TEXT NOT NULL, client_id TEXT
);
CREATE TRIGGER penny_agent_native_audit AFTER INSERT ON audit_entries
 WHEN EXISTS(SELECT 1 FROM penny_agent_transaction) BEGIN
 UPDATE audit_entries SET details_json=json_set(COALESCE(details_json,'{}'),
  '$.preparedBy',json((SELECT agent FROM penny_agent_transaction)),
  '$.sponsorId',(SELECT native_id FROM penny_agent_transaction),
  '$.actorLabel',(SELECT label FROM penny_agent_transaction),
  '$.approvers',json((SELECT approvers FROM penny_agent_transaction)),
  '$.consent',(SELECT consent FROM penny_agent_transaction)) WHERE id=NEW.id;
END;

CREATE TRIGGER penny_operator_actor_update AFTER UPDATE OF email,display_name ON oa_operators BEGIN
 UPDATE operators SET email=NEW.email,display_name=NEW.display_name,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE id=(SELECT actor_id FROM penny_operator_bindings WHERE native_operator_id=NEW.id);
END;
