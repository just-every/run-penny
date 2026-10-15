import { activeSubscription } from './subscription'
import { eligibleRecipient } from '../notifications/eligibility'
export interface ReleaseMailContext {email:string;requestTitle:string|null;requestSlug:string|null;title:string;releaseType:string;body:string;publicationDate:string;setupUrl:string|null;slug:string}
export const releaseContentSql=`SELECT DISTINCT a.email,CASE WHEN ${eligibleRecipient} THEN c.title END AS requestTitle,CASE WHEN ${eligibleRecipient} THEN c.slug END AS requestSlug,v.title,v.release_type AS releaseType,v.body,v.publication_date AS publicationDate,v.setup_url AS setupUrl,release.slug
 FROM notification_outbox n JOIN release_recipient_snapshots s ON s.id=n.release_snapshot_id
 LEFT JOIN release_recipient_contexts c ON c.snapshot_id=s.id JOIN release_versions v ON v.id=n.subject_id AND COALESCE(v.original_publication_version_id,v.id)=s.release_version_id
 JOIN releases release ON release.id=v.release_id JOIN requester_addresses a ON a.id=n.address_id
 LEFT JOIN requests r ON r.id=c.request_id LEFT JOIN boards b ON b.id=r.board_id LEFT JOIN requesters author ON author.id=r.author_requester_id
 WHERE n.id=? AND release.state='published' AND s.requester_id=n.requester_id AND s.requester_address_id=a.id
 AND a.email=s.recipient_email AND a.verified_at IS NOT NULL AND a.suppressed_at IS NULL
 AND EXISTS(SELECT 1 FROM requesters WHERE id=n.requester_id AND blocked_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM requester_identity_merges WHERE source_requester_id=n.requester_id)
 AND NOT EXISTS(SELECT 1 FROM requester_notification_preferences WHERE requester_id=n.requester_id AND muted_at IS NOT NULL)
 AND (${activeSubscription} OR (${eligibleRecipient}
 AND EXISTS(SELECT 1 FROM roadmap_publications p JOIN roadmap_request_mappings m ON m.roadmap_item_id=p.roadmap_item_id
 WHERE p.roadmap_item_id=c.roadmap_item_id AND m.request_id=c.request_id AND p.approved_at IS NOT NULL AND p.withdrawn_at IS NULL AND m.approved_at IS NOT NULL AND m.withdrawn_at IS NULL)))
 ORDER BY c.request_id`
export async function releaseContent(db:D1Database,id:string){return (await db.prepare(releaseContentSql).bind(id).all<ReleaseMailContext>()).results}
export async function admitReleaseDelivery(db:D1Database,id:string,claim:string,email:string){
 const [content,admission]=await db.batch([
  db.prepare(releaseContentSql).bind(id),
  db.prepare(`UPDATE notification_outbox_attempts SET recipient_email=?,recipient_verification_epoch=(SELECT a.verification_epoch FROM notification_outbox n JOIN requester_addresses a ON a.id=n.address_id WHERE n.id=outbox_id)
   WHERE id=? AND outbox_id=? AND state='sending' AND recipient_email IS NULL
   AND EXISTS(SELECT 1 FROM notification_outbox WHERE id=? AND claim_id=? AND delivery_state='queued')
   AND EXISTS(SELECT 1 FROM (${releaseContentSql}) WHERE email=?) AND (SELECT phase FROM data_state WHERE singleton=1)='idle' RETURNING 1 AS affected`).bind(email,claim,id,id,claim,id,email),
 ])
 return {contexts:content.results as unknown as ReleaseMailContext[],owned:admission.results.length===1}
}
