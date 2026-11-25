-- Agent door upgrade from the 0.2.94 schema to the rer 0.2.113 runtime (Base c2efb501: erasure/replay custody, relay,
-- policy-reference suppression, relay privacy), as modules/agent-door/ADOPTING.md prescribes for a copy older than 0.2.96.
ALTER TABLE agent_door_agents ADD COLUMN tombstone TEXT;
ALTER TABLE agent_door_calls ADD COLUMN expires_at INTEGER;
-- Backfill only legacy completed calls, using their start, never upgrade time.
UPDATE agent_door_calls SET expires_at=created_at + 30*24*60*60*1000
WHERE state NOT IN ('running','pending') AND expires_at IS NULL;
CREATE INDEX IF NOT EXISTS agent_door_calls_expiry ON agent_door_calls(expires_at);
CREATE TABLE IF NOT EXISTS agent_door_replay_aliases (
  agent TEXT NOT NULL, alias TEXT NOT NULL, call_id TEXT NOT NULL, tombstone TEXT NOT NULL,
  PRIMARY KEY(agent,alias)
);
CREATE TRIGGER IF NOT EXISTS agent_door_delete_replay_aliases AFTER DELETE ON agent_door_calls
BEGIN
  DELETE FROM agent_door_replay_aliases WHERE agent=OLD.agent AND call_id=OLD.decision_id;
END;
CREATE INDEX IF NOT EXISTS agent_door_replay_aliases_call ON agent_door_replay_aliases(agent,call_id);

CREATE TABLE IF NOT EXISTS agent_door_relay (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT, decision_id TEXT NOT NULL, business TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS agent_door_relay_business ON agent_door_relay(business,sequence);
CREATE INDEX IF NOT EXISTS agent_door_relay_decision ON agent_door_relay(decision_id,sequence);
-- Plain INSERT then DELETE, never INSERT OR REPLACE: an outer UPSERT's conflict policy overrides a trigger's.
CREATE TRIGGER IF NOT EXISTS agent_door_relay_audit_insert AFTER INSERT ON agent_door_audit
WHEN json_extract(NEW.row,'$.door')='mcp' AND json_extract(NEW.row,'$.consent') IS NOT NULL
 AND (SELECT json_extract(envelope,'$.business') FROM agent_door_state WHERE id=1) IS NOT NULL
BEGIN
  INSERT INTO agent_door_relay(decision_id,business) VALUES(NEW.id,
    COALESCE((SELECT business FROM agent_door_relay WHERE decision_id=NEW.id ORDER BY sequence DESC LIMIT 1),
             (SELECT json_extract(envelope,'$.business') FROM agent_door_state WHERE id=1)));
  DELETE FROM agent_door_relay WHERE decision_id=NEW.id AND sequence<(SELECT MAX(sequence) FROM agent_door_relay WHERE decision_id=NEW.id);
END;
-- Membership survives erasure, which drops door and consent from the row.
CREATE TRIGGER IF NOT EXISTS agent_door_relay_audit_update AFTER UPDATE ON agent_door_audit
WHEN EXISTS(SELECT 1 FROM agent_door_relay WHERE decision_id=NEW.id)
  OR (json_extract(NEW.row,'$.door')='mcp' AND json_extract(NEW.row,'$.consent') IS NOT NULL
      AND (SELECT json_extract(envelope,'$.business') FROM agent_door_state WHERE id=1) IS NOT NULL)
BEGIN
  INSERT INTO agent_door_relay(decision_id,business) VALUES(NEW.id,
    COALESCE((SELECT business FROM agent_door_relay WHERE decision_id=NEW.id ORDER BY sequence DESC LIMIT 1),
             (SELECT json_extract(envelope,'$.business') FROM agent_door_state WHERE id=1)));
  DELETE FROM agent_door_relay WHERE decision_id=NEW.id AND sequence<(SELECT MAX(sequence) FROM agent_door_relay WHERE decision_id=NEW.id);
END;
CREATE TRIGGER IF NOT EXISTS agent_door_relay_approval AFTER UPDATE OF state ON agent_door_approvals
WHEN EXISTS(SELECT 1 FROM agent_door_relay WHERE decision_id=json_extract(NEW.saved,'$.decision_id'))
BEGIN
  INSERT INTO agent_door_relay(decision_id,business)
    SELECT decision_id,business FROM agent_door_relay WHERE decision_id=json_extract(NEW.saved,'$.decision_id') ORDER BY sequence DESC LIMIT 1;
  DELETE FROM agent_door_relay WHERE decision_id=json_extract(NEW.saved,'$.decision_id')
    AND sequence<(SELECT MAX(sequence) FROM agent_door_relay WHERE decision_id=json_extract(NEW.saved,'$.decision_id'));
END;
CREATE TRIGGER IF NOT EXISTS agent_door_relay_review AFTER UPDATE OF state ON agent_door_reviews
WHEN EXISTS(SELECT 1 FROM agent_door_relay WHERE decision_id=json_extract(NEW.saved,'$.decision_id'))
BEGIN
  INSERT INTO agent_door_relay(decision_id,business)
    SELECT decision_id,business FROM agent_door_relay WHERE decision_id=json_extract(NEW.saved,'$.decision_id') ORDER BY sequence DESC LIMIT 1;
  DELETE FROM agent_door_relay WHERE decision_id=json_extract(NEW.saved,'$.decision_id')
    AND sequence<(SELECT MAX(sequence) FROM agent_door_relay WHERE decision_id=json_extract(NEW.saved,'$.decision_id'));
END;
-- 0040 only, once: pre-existing Business-token rows, attributed to the current envelope's Business (platform P11 drops pre-join history).
INSERT INTO agent_door_relay(decision_id,business)
  SELECT id,(SELECT json_extract(envelope,'$.business') FROM agent_door_state WHERE id=1) FROM agent_door_audit
  WHERE json_extract(row,'$.door')='mcp' AND json_extract(row,'$.consent') IS NOT NULL
    AND (SELECT json_extract(envelope,'$.business') FROM agent_door_state WHERE id=1) IS NOT NULL
    AND NOT EXISTS(SELECT 1 FROM agent_door_relay r WHERE r.decision_id=agent_door_audit.id)
  ORDER BY sequence;

CREATE TABLE agent_door_retired_refs (digest TEXT PRIMARY KEY, marker TEXT NOT NULL);

-- Old relay triggers can assign an old Business's approval execution to a new
-- Business. Any seed that applied 0040 and re-paired with a pending approval can
-- already contain these rows. Remove only provable cross-Business memberships;
-- retain every audit and do not infer missing historical membership.
-- Count affected memberships before applying:
-- SELECT COUNT(*) FROM agent_door_relay r JOIN agent_door_audit a ON a.id=r.decision_id
-- WHERE EXISTS(SELECT 1 FROM agent_door_relay parent
--   WHERE parent.decision_id=json_extract(a.row,'$.decision_id') AND parent.business<>r.business);
DELETE FROM agent_door_relay
WHERE sequence IN (
  SELECT r.sequence FROM agent_door_relay r JOIN agent_door_audit a ON a.id=r.decision_id
  WHERE EXISTS(SELECT 1 FROM agent_door_relay parent
    WHERE parent.decision_id=json_extract(a.row,'$.decision_id') AND parent.business<>r.business)
);

-- Recreate even on databases where the shipped triggers already exist.
DROP TRIGGER IF EXISTS agent_door_relay_audit_insert;
DROP TRIGGER IF EXISTS agent_door_relay_audit_update;
-- Executions inherit only their decision's membership, including no membership.
-- Erasure drops the link, door and consent; preserve its existing membership.
-- Plain INSERT then DELETE: an outer UPSERT's conflict policy overrides a trigger's.
CREATE TRIGGER IF NOT EXISTS agent_door_relay_audit_insert AFTER INSERT ON agent_door_audit
WHEN json_extract(NEW.row,'$.door')='mcp' AND json_extract(NEW.row,'$.consent') IS NOT NULL
BEGIN
  INSERT INTO agent_door_relay(decision_id,business)
    SELECT NEW.id,business FROM (SELECT CASE WHEN json_extract(NEW.row,'$.decision_id') IS NOT NULL THEN
      (SELECT business FROM agent_door_relay WHERE decision_id=json_extract(NEW.row,'$.decision_id') ORDER BY sequence DESC LIMIT 1)
    ELSE COALESCE((SELECT business FROM agent_door_relay WHERE decision_id=NEW.id ORDER BY sequence DESC LIMIT 1),
      (SELECT json_extract(envelope,'$.business') FROM agent_door_state WHERE id=1)) END AS business)
    WHERE business IS NOT NULL;
  DELETE FROM agent_door_relay WHERE decision_id=NEW.id AND (
    sequence<(SELECT MAX(sequence) FROM agent_door_relay WHERE decision_id=NEW.id)
    OR (json_extract(NEW.row,'$.decision_id') IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM agent_door_relay WHERE decision_id=json_extract(NEW.row,'$.decision_id'))));
END;
CREATE TRIGGER IF NOT EXISTS agent_door_relay_audit_update AFTER UPDATE ON agent_door_audit
WHEN EXISTS(SELECT 1 FROM agent_door_relay WHERE decision_id=NEW.id)
  OR (json_extract(NEW.row,'$.door')='mcp' AND json_extract(NEW.row,'$.consent') IS NOT NULL)
BEGIN
  INSERT INTO agent_door_relay(decision_id,business)
    SELECT NEW.id,business FROM (SELECT CASE WHEN json_extract(NEW.row,'$.decision_id') IS NOT NULL THEN
      (SELECT business FROM agent_door_relay WHERE decision_id=json_extract(NEW.row,'$.decision_id') ORDER BY sequence DESC LIMIT 1)
    ELSE COALESCE((SELECT business FROM agent_door_relay WHERE decision_id=NEW.id ORDER BY sequence DESC LIMIT 1),
      (SELECT json_extract(envelope,'$.business') FROM agent_door_state WHERE id=1)) END AS business)
    WHERE business IS NOT NULL;
  DELETE FROM agent_door_relay WHERE decision_id=NEW.id AND (
    sequence<(SELECT MAX(sequence) FROM agent_door_relay WHERE decision_id=NEW.id)
    OR (json_extract(NEW.row,'$.decision_id') IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM agent_door_relay WHERE decision_id=json_extract(NEW.row,'$.decision_id'))));
END;
