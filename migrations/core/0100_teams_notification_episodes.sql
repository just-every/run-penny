-- Append-only correction of Teams notification identities and connector episodes.
-- No captured wording, authority or accepted delivery receipt is rewritten.
DROP TRIGGER teams_notice_inbox_evidence;
CREATE TRIGGER teams_notice_inbox_evidence AFTER INSERT ON audit_entries
WHEN NEW.action='evidence.recorded' AND NEW.entity_type='evidence'
 AND (SELECT phase FROM data_state WHERE singleton=1)='idle'
BEGIN
 INSERT OR IGNORE INTO penny_teams_events(id,operator_id,event,cadence,revision,created_at)
 SELECT 'inbox:'||NEW.entity_id||':'||p.operator_id,p.operator_id,'inbox',
 json_extract(p.events_json,'$.inbox'),p.revision,NEW.created_at
 FROM penny_evidence_owners a JOIN penny_teams_preferences p ON p.operator_id=a.operator_id
 JOIN operators o ON o.id=p.operator_id JOIN oa_operators n ON n.email=o.email
 WHERE a.evidence_id=NEW.entity_id AND p.enabled=1 AND n.status='active'
 AND json_extract(p.events_json,'$.inbox') IN('immediate','daily','weekly');
END;
CREATE INDEX penny_teams_event_cadence_due ON penny_teams_events(cadence,delivery_id,created_at);

-- Active faults are separate from historical jobs. Retrying does not resolve a
-- fault; success or an explicit stop does. Concurrent failing work shares one
-- episode until every outstanding fault has been resolved.
DROP TRIGGER teams_notice_failure;
CREATE TABLE penny_connector_episodes (
 connector_key TEXT PRIMARY KEY, episode_id TEXT NOT NULL,
 operator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 state TEXT NOT NULL CHECK(state IN('active','resolved')),
 opened_at TEXT NOT NULL, resolved_at TEXT
);
CREATE TABLE penny_connector_faults (
 connector_key TEXT NOT NULL, work_key TEXT NOT NULL,
 operator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL, PRIMARY KEY(connector_key,work_key)
);
CREATE TRIGGER penny_connector_fault_open AFTER INSERT ON penny_connector_faults
BEGIN
 INSERT INTO penny_connector_episodes(connector_key,episode_id,operator_id,state,opened_at)
 VALUES(NEW.connector_key,lower(hex(randomblob(16))),NEW.operator_id,'active',NEW.created_at)
 ON CONFLICT(connector_key) DO UPDATE SET episode_id=excluded.episode_id,
 operator_id=excluded.operator_id,state='active',opened_at=excluded.opened_at,resolved_at=NULL
 WHERE penny_connector_episodes.state='resolved';
END;
CREATE TRIGGER penny_connector_fault_resolve AFTER DELETE ON penny_connector_faults
BEGIN
 UPDATE penny_connector_episodes SET state='resolved',resolved_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE connector_key=OLD.connector_key AND state='active'
 AND NOT EXISTS(SELECT 1 FROM penny_connector_faults WHERE connector_key=OLD.connector_key);
END;

CREATE TRIGGER teams_connector_capture_fault AFTER UPDATE OF state ON penny_teams_jobs
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle'
BEGIN
 INSERT OR IGNORE INTO penny_connector_faults(connector_key,work_key,operator_id,created_at)
 SELECT 'teams','capture:'||NEW.id,actor_id,NEW.updated_at FROM penny_teams_settings
 WHERE singleton=1 AND NEW.state='failed' AND EXISTS(SELECT 1 FROM operators WHERE id=actor_id);
 DELETE FROM penny_connector_faults WHERE connector_key='teams' AND work_key='capture:'||NEW.id
 AND NEW.state IN('done','stopped');
END;
CREATE TRIGGER teams_connector_capture_forget AFTER DELETE ON penny_teams_jobs
BEGIN DELETE FROM penny_connector_faults WHERE connector_key='teams' AND work_key='capture:'||OLD.id; END;
CREATE TRIGGER teams_connector_source_fault AFTER UPDATE ON penny_teams_sources
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle'
BEGIN
 INSERT OR IGNORE INTO penny_connector_faults(connector_key,work_key,operator_id,created_at)
 SELECT 'teams','source:'||NEW.evidence_id,actor_id,strftime('%Y-%m-%dT%H:%M:%fZ','now')
 FROM penny_teams_settings WHERE singleton=1 AND EXISTS(SELECT 1 FROM operators WHERE id=actor_id) AND NEW.check_claim IS NULL
 AND NEW.check_failure IS NOT NULL AND NEW.source_state IN('current','changed','removed');
 DELETE FROM penny_connector_faults WHERE connector_key='teams' AND work_key='source:'||NEW.evidence_id
 AND NEW.check_failure IS NULL AND ((OLD.check_claim IS NOT NULL AND NEW.check_claim IS NULL)
 OR NEW.source_state IN('removed','purged'));
END;
CREATE TRIGGER teams_connector_source_forget AFTER DELETE ON penny_teams_sources
BEGIN DELETE FROM penny_connector_faults WHERE connector_key='teams' AND work_key='source:'||OLD.evidence_id; END;
-- Seed existing unresolved work without replaying historical alerts on upgrade.
INSERT OR IGNORE INTO penny_connector_faults(connector_key,work_key,operator_id,created_at)
 SELECT 'teams','capture:'||j.id,s.actor_id,j.updated_at
 FROM penny_teams_jobs j JOIN penny_teams_settings s ON s.singleton=1 JOIN operators o ON o.id=s.actor_id WHERE j.state='failed';
INSERT OR IGNORE INTO penny_connector_faults(connector_key,work_key,operator_id,created_at)
 SELECT 'teams','source:'||j.evidence_id,s.actor_id,s.updated_at
 FROM penny_teams_sources j JOIN penny_teams_settings s ON s.singleton=1 JOIN operators o ON o.id=s.actor_id
 WHERE j.check_failure IS NOT NULL AND j.check_claim IS NULL;

CREATE TRIGGER discord_connector_capture_fault AFTER UPDATE OF state ON penny_discord_jobs
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle'
BEGIN
 INSERT OR IGNORE INTO penny_connector_faults(connector_key,work_key,operator_id,created_at)
 SELECT 'discord','capture:'||NEW.id,actor_id,NEW.updated_at FROM penny_discord_settings
 WHERE singleton=1 AND NEW.state='failed' AND EXISTS(SELECT 1 FROM operators WHERE id=actor_id);
 DELETE FROM penny_connector_faults WHERE connector_key='discord' AND work_key='capture:'||NEW.id
 AND NEW.state IN('done','stopped');
END;
CREATE TRIGGER discord_connector_capture_forget AFTER DELETE ON penny_discord_jobs
BEGIN DELETE FROM penny_connector_faults WHERE connector_key='discord' AND work_key='capture:'||OLD.id; END;
CREATE TRIGGER discord_connector_source_fault AFTER UPDATE ON penny_discord_sources
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle'
BEGIN
 INSERT OR IGNORE INTO penny_connector_faults(connector_key,work_key,operator_id,created_at)
 SELECT 'discord','source:'||NEW.evidence_id,actor_id,strftime('%Y-%m-%dT%H:%M:%fZ','now')
 FROM penny_discord_settings WHERE singleton=1 AND EXISTS(SELECT 1 FROM operators WHERE id=actor_id) AND NEW.check_claim IS NULL
 AND NEW.check_failure IS NOT NULL AND NEW.source_state IN('current','changed','removed');
 DELETE FROM penny_connector_faults WHERE connector_key='discord' AND work_key='source:'||NEW.evidence_id
 AND NEW.check_failure IS NULL AND ((OLD.check_claim IS NOT NULL AND NEW.check_claim IS NULL)
 OR NEW.source_state IN('removed','purged'));
END;
CREATE TRIGGER discord_connector_source_forget AFTER DELETE ON penny_discord_sources
BEGIN DELETE FROM penny_connector_faults WHERE connector_key='discord' AND work_key='source:'||OLD.evidence_id; END;
-- Seed existing unresolved work without replaying historical alerts on upgrade.
INSERT OR IGNORE INTO penny_connector_faults(connector_key,work_key,operator_id,created_at)
 SELECT 'discord','capture:'||j.id,s.actor_id,j.updated_at
 FROM penny_discord_jobs j JOIN penny_discord_settings s ON s.singleton=1 JOIN operators o ON o.id=s.actor_id WHERE j.state='failed';
INSERT OR IGNORE INTO penny_connector_faults(connector_key,work_key,operator_id,created_at)
 SELECT 'discord','source:'||j.evidence_id,s.actor_id,s.updated_at
 FROM penny_discord_sources j JOIN penny_discord_settings s ON s.singleton=1 JOIN operators o ON o.id=s.actor_id
 WHERE j.check_failure IS NOT NULL AND j.check_claim IS NULL;

CREATE TRIGGER integration_connector_fault AFTER UPDATE OF state ON integration_deliveries
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle'
BEGIN
 INSERT OR IGNORE INTO penny_connector_faults(connector_key,work_key,operator_id,created_at)
 SELECT connector_key,NEW.namespace||':'||NEW.id,operator_id,strftime('%Y-%m-%dT%H:%M:%fZ','now')
 FROM (SELECT 'destination:'||d.id connector_key,d.actor_id operator_id
 FROM penny_integration_targets t JOIN penny_integration_destinations d ON d.id=t.destination_id
 WHERE NEW.namespace='penny-events' AND t.id=NEW.id
 UNION ALL SELECT 'tracker:'||c.id,c.actor_id FROM penny_tracker_commands j
 JOIN penny_tracker_connections c ON c.id=j.connection_id
 WHERE NEW.namespace='penny-trackers' AND j.id=NEW.id) WHERE NEW.state IN('rejected','uncertain') AND EXISTS(SELECT 1 FROM operators WHERE id=operator_id);
 DELETE FROM penny_connector_faults WHERE work_key=NEW.namespace||':'||NEW.id AND NEW.state='accepted';
END;
CREATE TRIGGER integration_connector_resolved AFTER INSERT ON integration_resolutions
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle'
BEGIN DELETE FROM penny_connector_faults WHERE work_key=NEW.namespace||':'||NEW.delivery_id; END;
CREATE TRIGGER learning_connector_fault AFTER UPDATE OF state ON learning_runs
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle'
BEGIN
 INSERT OR IGNORE INTO penny_connector_faults(connector_key,work_key,operator_id,created_at)
 SELECT 'learning:'||s.id,'learning:'||NEW.id,i.actor_id,COALESCE(NEW.finished_at,NEW.created_at)
 FROM learning_investigations i JOIN learning_sources s ON s.id=i.source_id
 WHERE i.id=NEW.investigation_id AND s.provider='orbit'
 AND NEW.state IN('refused','uncertain') AND NEW.reason IN('learning_provider_unavailable','learning_provider_revoked','learning_source_revision_invalid','learning_source_audience_denied','learning_source_url_invalid');
 -- Learning run history is immutable: a later successful sync resolves that
 -- source's outage rather than changing the old run's recorded outcome.
 DELETE FROM penny_connector_faults WHERE connector_key IN(
 SELECT 'learning:'||source_id FROM learning_investigations WHERE id=NEW.investigation_id)
 AND NEW.state='complete';
END;

-- Explicit connector stops and erased work resolve their faults as well.
CREATE TRIGGER integration_connector_forgotten AFTER DELETE ON integration_deliveries
BEGIN DELETE FROM penny_connector_faults WHERE work_key=OLD.namespace||':'||OLD.id; END;
CREATE TRIGGER destination_connector_stopped AFTER UPDATE OF revoked_at ON penny_integration_destinations
WHEN NEW.revoked_at IS NOT NULL
BEGIN DELETE FROM penny_connector_faults WHERE connector_key='destination:'||NEW.id; END;
CREATE TRIGGER tracker_connector_stopped AFTER UPDATE OF revoked_at ON penny_tracker_connections
WHEN NEW.revoked_at IS NOT NULL
BEGIN DELETE FROM penny_connector_faults WHERE connector_key='tracker:'||NEW.id; END;
CREATE TRIGGER learning_connector_stopped AFTER UPDATE OF state ON learning_sources
WHEN NEW.state<>'active'
BEGIN DELETE FROM penny_connector_faults WHERE connector_key='learning:'||NEW.id; END;
CREATE TRIGGER learning_connector_forgotten AFTER DELETE ON learning_runs
BEGIN DELETE FROM penny_connector_faults WHERE work_key='learning:'||OLD.id; END;

CREATE TRIGGER teams_notice_connector_episode_insert AFTER INSERT ON penny_connector_episodes
WHEN NEW.state='active' AND (SELECT phase FROM data_state WHERE singleton=1)='idle'
BEGIN
 INSERT OR IGNORE INTO penny_teams_events(id,operator_id,event,cadence,revision,created_at)
 SELECT 'failure:'||NEW.episode_id||':'||p.operator_id,p.operator_id,'failure',
 json_extract(p.events_json,'$.failure'),p.revision,NEW.opened_at
 FROM penny_teams_preferences p JOIN operators o ON o.id=p.operator_id JOIN oa_operators n ON n.email=o.email
 WHERE p.enabled=1 AND n.status='active' AND p.operator_id=NEW.operator_id
 AND json_extract(p.events_json,'$.failure') IN('immediate','daily','weekly');
END;

CREATE TRIGGER teams_notice_connector_episode_update AFTER UPDATE ON penny_connector_episodes
WHEN NEW.state='active' AND OLD.episode_id<>NEW.episode_id AND (SELECT phase FROM data_state WHERE singleton=1)='idle'
BEGIN
 INSERT OR IGNORE INTO penny_teams_events(id,operator_id,event,cadence,revision,created_at)
 SELECT 'failure:'||NEW.episode_id||':'||p.operator_id,p.operator_id,'failure',
 json_extract(p.events_json,'$.failure'),p.revision,NEW.opened_at
 FROM penny_teams_preferences p JOIN operators o ON o.id=p.operator_id JOIN oa_operators n ON n.email=o.email
 WHERE p.enabled=1 AND n.status='active' AND p.operator_id=NEW.operator_id
 AND json_extract(p.events_json,'$.failure') IN('immediate','daily','weekly');
END;
