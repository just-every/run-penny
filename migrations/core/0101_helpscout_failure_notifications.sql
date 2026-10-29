-- The newly adopted Help Scout connector reports capture/source failures on
-- its connection. Use the same installation-only episode and preference path.
CREATE TRIGGER helpscout_connector_fault AFTER UPDATE OF failure,enabled ON penny_helpscout_connection
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle'
BEGIN
 INSERT OR IGNORE INTO penny_connector_faults(connector_key,work_key,operator_id,created_at)
 SELECT 'helpscout:'||NEW.id,'connection',NEW.actor_id,NEW.updated_at
 WHERE NEW.enabled=1 AND NEW.failure IS NOT NULL;
 DELETE FROM penny_connector_faults WHERE connector_key='helpscout:'||NEW.id
 AND (NEW.enabled=0 OR NEW.failure IS NULL);
END;
CREATE TRIGGER helpscout_connector_forgotten AFTER DELETE ON penny_helpscout_connection
BEGIN DELETE FROM penny_connector_faults WHERE connector_key='helpscout:'||OLD.id; END;
