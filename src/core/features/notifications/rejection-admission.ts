/** This private author-only notice deliberately does not use public follower
 * eligibility. Neither held wording nor request titles enter its mail content. */
const authorStillOwnsSubject=`(
 (e.subject_type='request' AND e.subject_id=r.id AND r.author_requester_id=n.requester_id AND r.moderation_state='rejected')
 OR (e.subject_type='comment' AND EXISTS(SELECT 1 FROM request_comments c WHERE c.id=e.subject_id AND c.request_id=r.id AND c.requester_id=n.requester_id AND c.moderation_state='rejected' AND c.historical_private=0))
 OR (e.subject_type='request_edit' AND EXISTS(SELECT 1 FROM request_content_submissions s WHERE s.id=e.subject_id AND s.request_id=r.id AND s.requester_id=n.requester_id AND r.author_requester_id=n.requester_id AND s.moderation_state='rejected'))
 OR (e.subject_type='comment_edit' AND EXISTS(SELECT 1 FROM request_comment_edits edit JOIN request_comments c ON c.id=edit.comment_id WHERE edit.id=e.subject_id AND c.request_id=r.id AND edit.requester_id=n.requester_id AND c.requester_id=n.requester_id AND edit.moderation_state='rejected' AND c.historical_private=0)))`
export const rejectionContextSql=`SELECT n.id,a.email,a.id AS addressId,n.requester_id AS requesterId,e.request_id AS requestId,e.reason,
 CASE
 WHEN person.id IS NULL THEN 'author_erased_or_missing'
 WHEN person.blocked_at IS NOT NULL THEN 'author_blocked'
 WHEN EXISTS(SELECT 1 FROM requester_identity_merges WHERE source_requester_id=n.requester_id) THEN 'author_merged'
 WHEN e.id IS NULL OR e.verdict!='rejected' OR e.reason IS NULL OR NOT ${authorStillOwnsSubject} THEN 'rejection_no_longer_current'
 WHEN EXISTS(SELECT 1 FROM requesters parent WHERE parent.id=r.author_requester_id AND parent.blocked_at IS NOT NULL) THEN 'request_author_blocked'
 WHEN e.id IS NOT (SELECT id FROM request_moderation_events latest WHERE latest.subject_type=e.subject_type AND latest.subject_id=e.subject_id ORDER BY rowid DESC LIMIT 1) THEN 'rejection_superseded'
 WHEN r.withdrawn_at IS NOT NULL OR r.merged_into_request_id IS NOT NULL THEN 'request_no_longer_available'
 WHEN b.visibility IS NOT 'public' OR b.archived_at IS NOT NULL THEN 'board_not_public'
 WHEN a.id IS NULL OR a.requester_id IS NOT n.requester_id OR a.verified_at IS NULL OR trim(a.email)='' THEN 'verified_address_missing'
 WHEN a.suppressed_at IS NOT NULL THEN 'address_suppressed'
 WHEN a.verification_epoch IS NOT json_extract(n.payload_json,'$.addressEpoch') THEN 'verified_address_changed'
 WHEN EXISTS(SELECT 1 FROM requester_notification_preferences WHERE requester_id=n.requester_id AND muted_at IS NOT NULL) THEN 'all_email_muted'
 WHEN EXISTS(SELECT 1 FROM request_follows WHERE requester_id=n.requester_id AND request_id=r.id AND muted_at IS NOT NULL)
   OR EXISTS(SELECT 1 FROM request_notification_mutes m JOIN request_canonical_roots root ON root.origin_id=m.request_id WHERE m.requester_id=n.requester_id AND root.canonical_id=r.id) THEN 'request_muted'
 WHEN NOT EXISTS(SELECT 1 FROM requester_update_permissions p JOIN request_canonical_roots root ON root.origin_id=p.request_id
   WHERE p.requester_id=n.requester_id AND p.requester_address_id=a.id AND p.revoked_at IS NULL AND p.suppressed_at IS NULL AND root.canonical_id=r.id) THEN 'consent_missing_or_revoked'
 ELSE NULL END AS suppressionReason
 FROM notification_outbox n
 LEFT JOIN request_moderation_events e ON e.id=json_extract(n.payload_json,'$.eventId') AND e.subject_id=n.subject_id
 LEFT JOIN requests r ON r.id=e.request_id LEFT JOIN boards b ON b.id=r.board_id
 LEFT JOIN requesters person ON person.id=n.requester_id LEFT JOIN requester_addresses a ON a.id=n.address_id
 WHERE n.id=? AND n.event_type='moderation_rejected'`
export interface RejectionContext {id:string;email:string|null;addressId:string|null;requesterId:string|null;requestId:string|null;reason:string|null;suppressionReason:string|null}
export function rejectionContext(db:D1Database,id:string){return db.prepare(rejectionContextSql).bind(id).first<RejectionContext>()}
export async function admitRejection(db:D1Database,id:string,claim:string,email:string,now:string){
 const [context,owned]=await db.batch([
  db.prepare(rejectionContextSql).bind(id),
  db.prepare(`UPDATE notification_outbox_attempts SET recipient_email=?,recipient_verification_epoch=(SELECT a.verification_epoch FROM notification_outbox n JOIN requester_addresses a ON a.id=n.address_id WHERE n.id=outbox_id)
   WHERE id=? AND outbox_id=? AND state='sending' AND recipient_email IS NULL
   AND EXISTS(SELECT 1 FROM notification_outbox WHERE id=? AND claim_id=? AND delivery_state='queued')
   AND EXISTS(SELECT 1 FROM (${rejectionContextSql}) WHERE email=? AND suppressionReason IS NULL)
   AND (SELECT phase FROM data_state WHERE singleton=1)='idle' RETURNING 1 AS affected`).bind(email,claim,id,id,claim,id,email),
  db.prepare(`UPDATE notification_outbox SET first_attempt_at=COALESCE(first_attempt_at,?) WHERE id=? AND claim_id=? AND EXISTS(SELECT 1 FROM notification_outbox_attempts WHERE id=? AND recipient_email=?)`).bind(now,id,claim,claim,email),
 ])
 return {context:context.results[0] as unknown as RejectionContext|undefined,owned:owned.results.length===1}
}
