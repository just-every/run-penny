-- Product actor creation remains the native session's existing lifecycle.
-- Bind its native OA id once; an address change cannot move an existing binding.
CREATE TRIGGER penny_agent_bind_product_actor AFTER INSERT ON operators
 BEGIN
 INSERT INTO penny_agent_people(native_operator_id,actor_id)
 SELECT n.id,NEW.id FROM oa_operators n WHERE n.email=NEW.email AND n.status='active'
 ON CONFLICT(native_operator_id) DO NOTHING;
 END;

-- A pristine restore may replace its bootstrap actor. Once any company agent
-- has been admitted, the stable binding and decision evidence remain in custody.
CREATE TRIGGER penny_agent_restore_custody BEFORE INSERT ON data_operations
 WHEN NEW.kind='restore' AND (EXISTS(SELECT 1 FROM agent_door_agents)
 OR EXISTS(SELECT 1 FROM agent_door_audit) OR EXISTS(SELECT 1 FROM agent_door_calls)
 OR EXISTS(SELECT 1 FROM agent_door_approvals) OR EXISTS(SELECT 1 FROM agent_door_reviews))
 BEGIN SELECT RAISE(ABORT,'agent_retained_evidence_requires_review'); END;
CREATE TRIGGER penny_agent_release_bootstrap_binding BEFORE DELETE ON operators
 BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM agent_door_agents)
 OR EXISTS(SELECT 1 FROM agent_door_audit) OR EXISTS(SELECT 1 FROM agent_door_calls)
 OR EXISTS(SELECT 1 FROM agent_door_approvals) OR EXISTS(SELECT 1 FROM agent_door_reviews)
 THEN RAISE(ABORT,'agent_retained_evidence_requires_review') END;
 DELETE FROM penny_agent_people WHERE actor_id=OLD.id;
 END;
