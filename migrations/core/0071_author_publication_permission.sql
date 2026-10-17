-- Publication notices belong to authors who subscribed when they submitted.
-- A publication without that permission creates no unused notification record.
DROP TRIGGER notification_author_publication;
CREATE TRIGGER notification_author_publication AFTER UPDATE OF published_at ON requests
WHEN OLD.published_at IS NULL AND NEW.published_at IS NOT NULL AND NEW.moderation_state='approved'
 AND NEW.author_requester_id IS NOT NULL
 AND EXISTS(SELECT 1 FROM requester_update_permissions p WHERE p.request_id=NEW.id AND p.requester_id=NEW.author_requester_id
  AND p.source='submission' AND p.revoked_at IS NULL AND p.suppressed_at IS NULL)
 AND (SELECT phase FROM data_state WHERE singleton=1)='idle'
BEGIN
 INSERT OR IGNORE INTO notification_events(id,request_id,kind,subject_id,body,created_at,updated_at)
 VALUES('publication:'||NEW.id,NEW.id,'status',NEW.id,'Your request is now public.',NEW.published_at,NEW.published_at);
END;

