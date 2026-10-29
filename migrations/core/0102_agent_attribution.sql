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

CREATE TRIGGER penny_agent_core_notification_events BEFORE INSERT ON notification_events
WHEN EXISTS(SELECT 1 FROM penny_agent_transaction) BEGIN
 SELECT RAISE(ABORT,'agent_family_undeclared');
END;

CREATE TRIGGER penny_agent_core_notification_outbox BEFORE INSERT ON notification_outbox
WHEN EXISTS(SELECT 1 FROM penny_agent_transaction) BEGIN
 SELECT RAISE(ABORT,'agent_family_undeclared');
END;

CREATE TRIGGER penny_agent_core_penny_integration_events BEFORE INSERT ON penny_integration_events
WHEN EXISTS(SELECT 1 FROM penny_agent_transaction) BEGIN
 SELECT RAISE(ABORT,'agent_family_undeclared');
END;

CREATE TRIGGER penny_agent_core_learning_investigations BEFORE INSERT ON learning_investigations
WHEN EXISTS(SELECT 1 FROM penny_agent_transaction) BEGIN
 SELECT RAISE(ABORT,'agent_family_undeclared');
END;

CREATE TRIGGER penny_agent_core_penny_publication_schedules BEFORE INSERT ON penny_publication_schedules
WHEN EXISTS(SELECT 1 FROM penny_agent_transaction) BEGIN
 SELECT RAISE(ABORT,'agent_family_undeclared');
END;
