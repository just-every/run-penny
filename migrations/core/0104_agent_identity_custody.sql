-- Even catalogue-only agent admission retains sponsor names in native identity.
CREATE TRIGGER penny_agent_identity_erasure_fence BEFORE INSERT ON data_operations
 WHEN NEW.kind='erase' AND EXISTS(SELECT 1 FROM agent_door_agents)
 BEGIN SELECT RAISE(ABORT,'agent_retained_evidence_requires_review'); END;
