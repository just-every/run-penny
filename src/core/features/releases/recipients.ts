import { activeSubscription } from './subscription'
import { eligibleRecipient } from '../notifications/eligibility'
/** SQL runs in the publication transaction. Sources expose request_id. */
export function recipientSelection(source:string,subscriptions=false):string {
 return `WITH sources AS MATERIALIZED (${source}), candidates AS MATERIALIZED (
 SELECT DISTINCT f.requester_id AS requester_id,a.id AS address_id,r.id AS request_id,r.public_title AS title,r.slug,
 (SELECT MIN(p.granted_at) FROM requester_update_permissions p JOIN request_canonical_roots root ON root.origin_id=p.request_id
 WHERE p.requester_id=f.requester_id AND p.requester_address_id=a.id AND p.revoked_at IS NULL AND root.canonical_id=r.id) AS granted_at
 FROM sources targets JOIN requests r ON r.id=targets.request_id JOIN boards b ON b.id=r.board_id
 LEFT JOIN requesters author ON author.id=r.author_requester_id JOIN request_follows f ON f.request_id=r.id
 JOIN requester_addresses a ON a.requester_id=f.requester_id
 JOIN (SELECT id AS requester_id FROM requesters) n ON n.requester_id=f.requester_id WHERE ${eligibleRecipient}
 ${subscriptions?`UNION ALL SELECT a.requester_id,a.id,NULL,NULL,NULL,
 (SELECT MIN(p.granted_at) FROM requester_update_permissions p WHERE p.requester_address_id=a.id AND p.source='subscription' AND p.request_id IS NULL AND p.revoked_at IS NULL AND p.suppressed_at IS NULL)
 FROM requester_addresses a JOIN (SELECT id AS requester_id,blocked_at FROM requesters) n ON n.requester_id=a.requester_id
 WHERE EXISTS(SELECT 1 FROM sources) AND a.verified_at IS NOT NULL AND a.suppressed_at IS NULL AND n.blocked_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM requester_identity_merges WHERE source_requester_id=n.requester_id)
 AND NOT EXISTS(SELECT 1 FROM requester_notification_preferences WHERE requester_id=n.requester_id AND muted_at IS NOT NULL)
 AND ${activeSubscription}`:''}
 ), chosen AS (SELECT *,ROW_NUMBER() OVER(PARTITION BY requester_id ORDER BY granted_at,address_id,request_id) AS priority FROM candidates)
 SELECT c.* FROM candidates c JOIN chosen a ON a.requester_id=c.requester_id AND a.priority=1 AND a.address_id=c.address_id`
}
export const activeMappings=`SELECT m.request_id FROM roadmap_request_mappings m JOIN requests r ON r.id=m.request_id
 WHERE m.approved_at IS NOT NULL AND m.withdrawn_at IS NULL`
