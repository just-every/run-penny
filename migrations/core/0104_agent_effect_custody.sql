CREATE TRIGGER penny_publication_agent_replacement AFTER UPDATE ON penny_publication_schedules
WHEN NEW.id IS NOT OLD.id
BEGIN
 DELETE FROM penny_agent_work WHERE kind='publication' AND id=OLD.id;
 INSERT INTO penny_agent_work(kind,id,principal,label)
 SELECT 'publication',NEW.id,json_object('person',json_object('id',native_id),'agent',json_extract(agent,'$.agent'),
 'consent',consent,'scopes',json(scopes),'clientId',client_id),label FROM penny_agent_transaction;
END;
CREATE TRIGGER penny_integration_agent_custody AFTER INSERT ON penny_integration_events
 WHEN EXISTS(SELECT 1 FROM penny_agent_transaction) BEGIN
 INSERT OR IGNORE INTO penny_agent_work(kind,id,principal,label)
 SELECT 'integration-event',NEW.id,json_object('person',json_object('id',native_id),'agent',json_extract(agent,'$.agent'),
 'consent',consent,'scopes',json(scopes),'clientId',client_id),label FROM penny_agent_transaction;
END;
CREATE TRIGGER penny_release_agent_name AFTER INSERT ON release_versions
 WHEN EXISTS(SELECT 1 FROM penny_agent_transaction) BEGIN
 UPDATE release_versions SET author_name=(SELECT label FROM penny_agent_transaction) WHERE id=NEW.id;
END;
CREATE TRIGGER penny_release_agent_seal AFTER UPDATE OF author_name ON release_versions
 WHEN OLD.snapshot_sealed_at IS NULL AND EXISTS(SELECT 1 FROM penny_agent_transaction)
 AND NEW.author_name IS NOT (SELECT label FROM penny_agent_transaction) BEGIN
 UPDATE release_versions SET author_name=(SELECT label FROM penny_agent_transaction) WHERE id=NEW.id;
END;
ALTER TABLE request_notes ADD COLUMN agent_label TEXT;
ALTER TABLE request_notes ADD COLUMN agent_prepared_by TEXT;
ALTER TABLE request_notes ADD COLUMN agent_approvers TEXT;
CREATE TRIGGER penny_note_agent_name AFTER INSERT ON request_notes
 WHEN EXISTS(SELECT 1 FROM penny_agent_transaction) BEGIN
 UPDATE request_notes SET agent_label=(SELECT label FROM penny_agent_transaction),
 agent_prepared_by=(SELECT agent FROM penny_agent_transaction),agent_approvers=(SELECT approvers FROM penny_agent_transaction)
 WHERE id=NEW.id;
END;
