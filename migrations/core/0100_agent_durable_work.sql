CREATE TABLE penny_agent_work (
 kind TEXT NOT NULL, id TEXT NOT NULL, principal TEXT NOT NULL, label TEXT NOT NULL,
 PRIMARY KEY(kind,id)
);
CREATE TRIGGER penny_learning_agent_custody AFTER INSERT ON learning_investigations
 WHEN EXISTS(SELECT 1 FROM penny_agent_transaction) BEGIN
 INSERT INTO penny_agent_work(kind,id,principal,label)
 SELECT 'learning',NEW.id,json_object('person',json_object('id',native_id),'agent',json_extract(agent,'$.agent'),
 'consent',consent,'scopes',json(scopes),'clientId',client_id),label FROM penny_agent_transaction;
END;
CREATE TRIGGER penny_publication_agent_custody AFTER INSERT ON penny_publication_schedules
 WHEN EXISTS(SELECT 1 FROM penny_agent_transaction) BEGIN
 INSERT INTO penny_agent_work(kind,id,principal,label)
 SELECT 'publication',NEW.id,json_object('person',json_object('id',native_id),'agent',json_extract(agent,'$.agent'),
 'consent',consent,'scopes',json(scopes),'clientId',client_id),label FROM penny_agent_transaction;
END;
CREATE TRIGGER penny_notification_agent_custody AFTER INSERT ON notification_events
 WHEN EXISTS(SELECT 1 FROM penny_agent_transaction) BEGIN
 INSERT OR IGNORE INTO penny_agent_work(kind,id,principal,label)
 SELECT 'notification-event',NEW.id,json_object('person',json_object('id',native_id),'agent',json_extract(agent,'$.agent'),
 'consent',consent,'scopes',json(scopes),'clientId',client_id),label FROM penny_agent_transaction;
END;
CREATE TRIGGER penny_outbox_agent_custody AFTER INSERT ON notification_outbox
 WHEN EXISTS(SELECT 1 FROM penny_agent_transaction) BEGIN
 INSERT OR IGNORE INTO penny_agent_work(kind,id,principal,label)
 SELECT 'mail-outbox',NEW.id,json_object('person',json_object('id',native_id),'agent',json_extract(agent,'$.agent'),
 'consent',consent,'scopes',json(scopes),'clientId',client_id),label FROM penny_agent_transaction;
END;
