/** Aliases: batch n, request r, board b, request author author, address a. */
export const eligibleRecipient = `a.requester_id=n.requester_id AND a.verified_at IS NOT NULL AND a.suppressed_at IS NULL
 AND EXISTS(SELECT 1 FROM requesters person WHERE person.id=n.requester_id AND person.blocked_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM requester_identity_merges retired WHERE retired.source_requester_id=n.requester_id)
 AND r.moderation_state='approved' AND r.published_at IS NOT NULL AND r.withdrawn_at IS NULL
 AND r.merged_into_request_id IS NULL AND b.visibility='public' AND (author.id IS NULL OR author.blocked_at IS NULL)
 AND EXISTS(SELECT 1 FROM request_follows f WHERE f.request_id=r.id AND f.requester_id=n.requester_id AND f.muted_at IS NULL)
 AND EXISTS(SELECT 1 FROM requester_update_permissions p JOIN request_canonical_roots root ON root.origin_id=p.request_id
   WHERE p.requester_id=n.requester_id AND p.requester_address_id=a.id AND p.revoked_at IS NULL AND p.suppressed_at IS NULL AND root.canonical_id=r.id)
 AND NOT EXISTS(SELECT 1 FROM requester_notification_preferences p WHERE p.requester_id=n.requester_id AND p.muted_at IS NOT NULL)
 AND NOT EXISTS(SELECT 1 FROM request_notification_mutes m JOIN request_canonical_roots root ON root.origin_id=m.request_id WHERE m.requester_id=n.requester_id AND root.canonical_id=r.id)`

export const visibleEvent = `(e.kind='status' AND EXISTS(SELECT 1 FROM request_status_updates s WHERE s.id=e.subject_id AND s.request_id=e.request_id))
 OR (e.kind='comment' AND EXISTS(SELECT 1 FROM request_comments c LEFT JOIN requesters person ON person.id=c.requester_id
   WHERE c.id=e.subject_id AND c.request_id=e.request_id AND c.moderation_state='approved' AND c.published_at IS NOT NULL
   AND c.requester_id IS NOT n.requester_id
   AND (c.requester_id IS NULL OR person.blocked_at IS NULL)))`

export function quietHours(now: Date, timezone: string): boolean {
 const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hour:'2-digit',hourCycle:'h23'}).format(now))
 return hour>=20 || hour<8
}

/** Identity merges can bring two address-specific queues together. A terminal
 * delivery fact keeps custody of its event; moving an identity never resends it. */
export const unmailedEvent = `NOT EXISTS(SELECT 1 FROM notification_intents prior
 JOIN notification_batches delivered ON delivered.id=prior.batch_id
 WHERE prior.event_id=i.event_id AND delivered.requester_id=n.requester_id
 AND delivered.id!=n.id AND delivered.state IN('accepted','unknown','failed'))`
