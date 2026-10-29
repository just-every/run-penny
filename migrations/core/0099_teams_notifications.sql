-- Teams preferences and delivery custody belong to this installation, never archives.
CREATE TABLE penny_teams_preferences (
 operator_id TEXT PRIMARY KEY REFERENCES operators(id) ON DELETE CASCADE,
 events_json TEXT NOT NULL, demand_threshold INTEGER NOT NULL CHECK(demand_threshold>0),
 enabled INTEGER NOT NULL CHECK(enabled IN(0,1)), revision INTEGER NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE penny_teams_events (
 id TEXT PRIMARY KEY, operator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 event TEXT NOT NULL, cadence TEXT NOT NULL CHECK(cadence IN('immediate','daily','weekly')),
 revision INTEGER NOT NULL, created_at TEXT NOT NULL, delivery_id TEXT
);
CREATE INDEX penny_teams_event_due ON penny_teams_events(delivery_id,created_at);
CREATE TABLE penny_teams_deliveries (
 id TEXT PRIMARY KEY, operator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL, state TEXT NOT NULL CHECK(state IN('pending','sending','accepted','failed','unknown','stopped')),
 claim TEXT, failure TEXT, event_count INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TRIGGER teams_notice_mention AFTER INSERT ON penny_note_mentions
 BEGIN
 INSERT OR IGNORE INTO penny_teams_events(id,operator_id,event,cadence,revision,created_at)
 SELECT 'mention:'||(NEW.note_id)||':'||p.operator_id,p.operator_id,'mention',json_extract(p.events_json,'$.mention'),p.revision,NEW.created_at
 FROM penny_teams_preferences p JOIN operators o ON o.id=p.operator_id JOIN oa_operators n ON n.email=o.email
 WHERE p.enabled=1 AND n.status='active' AND json_extract(p.events_json,'$.mention') IN('immediate','daily','weekly')
 AND (SELECT phase FROM data_state WHERE singleton=1)='idle' AND (p.operator_id=NEW.operator_id);
 END;
CREATE TRIGGER teams_notice_aging AFTER INSERT ON penny_triage_reminders
 BEGIN
 INSERT OR IGNORE INTO penny_teams_events(id,operator_id,event,cadence,revision,created_at)
 SELECT 'aging:'||(NEW.id)||':'||p.operator_id,p.operator_id,'aging',json_extract(p.events_json,'$.aging'),p.revision,NEW.created_at
 FROM penny_teams_preferences p JOIN operators o ON o.id=p.operator_id JOIN oa_operators n ON n.email=o.email
 WHERE p.enabled=1 AND n.status='active' AND json_extract(p.events_json,'$.aging') IN('immediate','daily','weekly')
 AND (SELECT phase FROM data_state WHERE singleton=1)='idle' AND (p.operator_id=NEW.owner_operator_id);
 END;
CREATE TRIGGER teams_notice_review AFTER INSERT ON decision_review_notifications
 BEGIN
 INSERT OR IGNORE INTO penny_teams_events(id,operator_id,event,cadence,revision,created_at)
 SELECT 'review:'||(NEW.id)||':'||p.operator_id,p.operator_id,'review',json_extract(p.events_json,'$.review'),p.revision,NEW.created_at
 FROM penny_teams_preferences p JOIN operators o ON o.id=p.operator_id JOIN oa_operators n ON n.email=o.email
 WHERE p.enabled=1 AND n.status='active' AND json_extract(p.events_json,'$.review') IN('immediate','daily','weekly')
 AND (SELECT phase FROM data_state WHERE singleton=1)='idle' AND (p.operator_id=NEW.owner_operator_id);
 END;
CREATE TRIGGER teams_notice_release AFTER INSERT ON audit_entries
 BEGIN
 INSERT OR IGNORE INTO penny_teams_events(id,operator_id,event,cadence,revision,created_at)
 SELECT 'release:'||(NEW.id)||':'||p.operator_id,p.operator_id,'release',json_extract(p.events_json,'$.release'),p.revision,NEW.created_at
 FROM penny_teams_preferences p JOIN operators o ON o.id=p.operator_id JOIN oa_operators n ON n.email=o.email
 WHERE p.enabled=1 AND n.status='active' AND json_extract(p.events_json,'$.release') IN('immediate','daily','weekly')
 AND (SELECT phase FROM data_state WHERE singleton=1)='idle' AND (NEW.action='release.published');
 END;
CREATE TRIGGER teams_notice_assign_request_insert AFTER INSERT ON penny_request_owners
 BEGIN
 INSERT OR IGNORE INTO penny_teams_events(id,operator_id,event,cadence,revision,created_at)
 SELECT 'assignment:'||(NEW.request_id||':'||NEW.updated_at)||':'||p.operator_id,p.operator_id,'assignment',json_extract(p.events_json,'$.assignment'),p.revision,NEW.updated_at
 FROM penny_teams_preferences p JOIN operators o ON o.id=p.operator_id JOIN oa_operators n ON n.email=o.email
 WHERE p.enabled=1 AND n.status='active' AND json_extract(p.events_json,'$.assignment') IN('immediate','daily','weekly')
 AND (SELECT phase FROM data_state WHERE singleton=1)='idle' AND (p.operator_id=NEW.operator_id);
 END;
CREATE TRIGGER teams_notice_assign_request_update AFTER UPDATE ON penny_request_owners
 BEGIN
 INSERT OR IGNORE INTO penny_teams_events(id,operator_id,event,cadence,revision,created_at)
 SELECT 'assignment:'||(NEW.request_id||':'||NEW.updated_at)||':'||p.operator_id,p.operator_id,'assignment',json_extract(p.events_json,'$.assignment'),p.revision,NEW.updated_at
 FROM penny_teams_preferences p JOIN operators o ON o.id=p.operator_id JOIN oa_operators n ON n.email=o.email
 WHERE p.enabled=1 AND n.status='active' AND json_extract(p.events_json,'$.assignment') IN('immediate','daily','weekly')
 AND (SELECT phase FROM data_state WHERE singleton=1)='idle' AND (p.operator_id=NEW.operator_id AND OLD.operator_id IS NOT NEW.operator_id);
 END;
CREATE TRIGGER teams_notice_assign_evidence_insert AFTER INSERT ON penny_evidence_owners
 BEGIN
 INSERT OR IGNORE INTO penny_teams_events(id,operator_id,event,cadence,revision,created_at)
 SELECT 'assignment:'||(NEW.evidence_id||':'||NEW.updated_at)||':'||p.operator_id,p.operator_id,'assignment',json_extract(p.events_json,'$.assignment'),p.revision,NEW.updated_at
 FROM penny_teams_preferences p JOIN operators o ON o.id=p.operator_id JOIN oa_operators n ON n.email=o.email
 WHERE p.enabled=1 AND n.status='active' AND json_extract(p.events_json,'$.assignment') IN('immediate','daily','weekly')
 AND (SELECT phase FROM data_state WHERE singleton=1)='idle' AND (p.operator_id=NEW.operator_id);
 END;
CREATE TRIGGER teams_notice_assign_evidence_update AFTER UPDATE ON penny_evidence_owners
 BEGIN
 INSERT OR IGNORE INTO penny_teams_events(id,operator_id,event,cadence,revision,created_at)
 SELECT 'assignment:'||(NEW.evidence_id||':'||NEW.updated_at)||':'||p.operator_id,p.operator_id,'assignment',json_extract(p.events_json,'$.assignment'),p.revision,NEW.updated_at
 FROM penny_teams_preferences p JOIN operators o ON o.id=p.operator_id JOIN oa_operators n ON n.email=o.email
 WHERE p.enabled=1 AND n.status='active' AND json_extract(p.events_json,'$.assignment') IN('immediate','daily','weekly')
 AND (SELECT phase FROM data_state WHERE singleton=1)='idle' AND (p.operator_id=NEW.operator_id AND OLD.operator_id IS NOT NEW.operator_id);
 END;
CREATE TRIGGER teams_notice_inbox_request AFTER INSERT ON requests
 BEGIN
 INSERT OR IGNORE INTO penny_teams_events(id,operator_id,event,cadence,revision,created_at)
 SELECT 'inbox:'||(NEW.id)||':'||p.operator_id,p.operator_id,'inbox',json_extract(p.events_json,'$.inbox'),p.revision,NEW.created_at
 FROM penny_teams_preferences p JOIN operators o ON o.id=p.operator_id JOIN oa_operators n ON n.email=o.email
 WHERE p.enabled=1 AND n.status='active' AND json_extract(p.events_json,'$.inbox') IN('immediate','daily','weekly')
 AND (SELECT phase FROM data_state WHERE singleton=1)='idle' AND (EXISTS(SELECT 1 FROM penny_board_owners b WHERE b.board_id=NEW.board_id AND b.operator_id=p.operator_id));
 END;
CREATE TRIGGER teams_notice_inbox_evidence AFTER INSERT ON penny_evidence_owners
 BEGIN
 INSERT OR IGNORE INTO penny_teams_events(id,operator_id,event,cadence,revision,created_at)
 SELECT 'inbox:'||(NEW.evidence_id)||':'||p.operator_id,p.operator_id,'inbox',json_extract(p.events_json,'$.inbox'),p.revision,NEW.updated_at
 FROM penny_teams_preferences p JOIN operators o ON o.id=p.operator_id JOIN oa_operators n ON n.email=o.email
 WHERE p.enabled=1 AND n.status='active' AND json_extract(p.events_json,'$.inbox') IN('immediate','daily','weekly')
 AND (SELECT phase FROM data_state WHERE singleton=1)='idle' AND (p.operator_id=NEW.operator_id);
 END;
CREATE TRIGGER teams_notice_failure AFTER UPDATE ON penny_teams_jobs
 BEGIN
 INSERT OR IGNORE INTO penny_teams_events(id,operator_id,event,cadence,revision,created_at)
 SELECT 'failure:'||(NEW.id)||':'||p.operator_id,p.operator_id,'failure',json_extract(p.events_json,'$.failure'),p.revision,NEW.updated_at
 FROM penny_teams_preferences p JOIN operators o ON o.id=p.operator_id JOIN oa_operators n ON n.email=o.email
 WHERE p.enabled=1 AND n.status='active' AND json_extract(p.events_json,'$.failure') IN('immediate','daily','weekly')
 AND (SELECT phase FROM data_state WHERE singleton=1)='idle' AND (NEW.state='failed' AND OLD.state!='failed' AND p.operator_id=NEW.actor_id);
 END;
CREATE TRIGGER teams_notice_demand AFTER INSERT ON request_votes
 BEGIN
 INSERT OR IGNORE INTO penny_teams_events(id,operator_id,event,cadence,revision,created_at)
 SELECT 'demand:'||(NEW.request_id||':'||p.demand_threshold)||':'||p.operator_id,p.operator_id,'demand',json_extract(p.events_json,'$.demand'),p.revision,NEW.created_at
 FROM penny_teams_preferences p JOIN operators o ON o.id=p.operator_id JOIN oa_operators n ON n.email=o.email
 WHERE p.enabled=1 AND n.status='active' AND json_extract(p.events_json,'$.demand') IN('immediate','daily','weekly')
 AND (SELECT phase FROM data_state WHERE singleton=1)='idle' AND ((SELECT count(*) FROM request_votes v WHERE v.request_id=NEW.request_id)=p.demand_threshold AND EXISTS(SELECT 1 FROM requests r JOIN penny_board_owners b ON b.board_id=r.board_id WHERE r.id=NEW.request_id AND b.operator_id=p.operator_id));
 END;
