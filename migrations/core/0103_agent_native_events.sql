-- Native events contain references and attribution, never private record text.
CREATE TRIGGER penny_agent_resource_event AFTER INSERT ON audit_entries
 WHEN NEW.actor_type='operator' AND NEW.entity_type IN('request','evidence','decision','roadmap','release','account','requester','board')
 AND EXISTS(SELECT 1 FROM penny_agent_transaction)
 BEGIN
 INSERT OR IGNORE INTO agent_door_events(id,uri,event)
 SELECT 'activity:'||NEW.id,
 'penny://'||CASE NEW.entity_type WHEN 'roadmap' THEN 'roadmap-item' WHEN 'requester' THEN 'person' ELSE NEW.entity_type END||'/'||NEW.entity_id,
 json_object('id','activity:'||NEW.id,'type',NEW.action,
 'uri','penny://'||CASE NEW.entity_type WHEN 'roadmap' THEN 'roadmap-item' WHEN 'requester' THEN 'person' ELSE NEW.entity_type END||'/'||NEW.entity_id,
 'at',NEW.occurred_at,'actor',json(json_set(agent,'$.kind','agent')))
 FROM penny_agent_transaction;
 END;
CREATE TRIGGER penny_person_resource_event AFTER INSERT ON audit_entries
 WHEN NEW.actor_type='operator' AND NEW.entity_type IN('request','evidence','decision','roadmap','release','account','requester','board')
 AND NOT EXISTS(SELECT 1 FROM penny_agent_transaction)
 BEGIN
 INSERT OR IGNORE INTO agent_door_events(id,uri,event)
 SELECT 'activity:'||NEW.id,
 'penny://'||CASE NEW.entity_type WHEN 'roadmap' THEN 'roadmap-item' WHEN 'requester' THEN 'person' ELSE NEW.entity_type END||'/'||NEW.entity_id,
 json_object('id','activity:'||NEW.id,'type',NEW.action,
 'uri','penny://'||CASE NEW.entity_type WHEN 'roadmap' THEN 'roadmap-item' WHEN 'requester' THEN 'person' ELSE NEW.entity_type END||'/'||NEW.entity_id,
 'at',NEW.occurred_at,'actor',json_object('kind','person','person',json_object('id',o.id,'name',o.display_name)))
 FROM penny_operator_bindings b JOIN oa_operators o ON o.id=b.native_operator_id WHERE b.actor_id=NEW.actor_id;
 END;
-- Agent publications share the existing signed webhook identifier.
CREATE TRIGGER penny_agent_webhook_event AFTER INSERT ON penny_integration_events
 WHEN EXISTS(SELECT 1 FROM penny_agent_transaction)
 BEGIN
 INSERT OR IGNORE INTO agent_door_events(id,uri,event)
 SELECT NEW.id,'penny://'||CASE WHEN NEW.release_id IS NOT NULL THEN 'release/'||NEW.release_id ELSE 'request/'||NEW.request_id END,
 json_object('id',NEW.id,'type',NEW.event,
 'uri','penny://'||CASE WHEN NEW.release_id IS NOT NULL THEN 'release/'||NEW.release_id ELSE 'request/'||NEW.request_id END,
 'at',strftime('%Y-%m-%dT%H:%M:%fZ',NEW.created_at/1000.0,'unixepoch'),'actor',json(json_set(agent,'$.kind','agent')))
 FROM penny_agent_transaction;
 END;
