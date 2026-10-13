-- Native invitation custody is recorded with the token transaction. No token,
-- email address or message body belongs in portable product audit history.
CREATE TRIGGER penny_operator_invitation_audit AFTER INSERT ON oa_tokens
WHEN NEW.kind='invite'
BEGIN
 INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,details_json,created_at,updated_at)
 VALUES(lower(hex(randomblob(16))),'operator',NEW.issuer_id,'operator.invitation_issued','operator',NEW.operator_id,
 strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('deliveryId',NEW.id,'outcome','pending'),
 strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
