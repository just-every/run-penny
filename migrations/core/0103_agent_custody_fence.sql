-- Admission and retained agent evidence share the erasure reservation transaction.
-- Native writers already require data_state idle. This closes the opposite race.
CREATE TRIGGER penny_agent_erasure_fence BEFORE INSERT ON data_operations
 WHEN NEW.kind='erase' AND (
  EXISTS(SELECT 1 FROM agent_door_audit) OR EXISTS(SELECT 1 FROM agent_door_calls)
  OR EXISTS(SELECT 1 FROM agent_door_approvals) OR EXISTS(SELECT 1 FROM agent_door_reviews))
 BEGIN SELECT RAISE(ABORT,'agent_retained_evidence_requires_review'); END;
