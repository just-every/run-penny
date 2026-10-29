/** A source name is never a customer identity. Only explicit native contact
 * relationships contribute; review evidence is excluded in both source arms. */
export const capturedContacts=`SELECT e.requester_id FROM request_evidence_links l JOIN evidence_items e ON e.id=l.evidence_id
 WHERE l.request_id=r.id AND e.source_type<>'review' AND e.requester_id IS NOT NULL
 UNION SELECT p.requester_id FROM penny_proxy_votes p LEFT JOIN evidence_items e ON e.id=p.evidence_id
 WHERE p.request_id IN(SELECT origin_id FROM request_canonical_roots WHERE canonical_id=r.id)
 AND (p.evidence_id IS NULL OR e.source_type<>'review')`
export const capturedSafety=`a.suppressed_at IS NULL AND a.verified_at IS NOT NULL AND person.blocked_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM requester_identity_merges WHERE source_requester_id=person.id)
 AND NOT EXISTS(SELECT 1 FROM requester_notification_preferences WHERE requester_id=person.id AND muted_at IS NOT NULL)
 AND NOT EXISTS(SELECT 1 FROM request_follows WHERE requester_id=person.id AND request_id=r.id AND muted_at IS NOT NULL)
 AND NOT EXISTS(SELECT 1 FROM request_notification_mutes m JOIN request_canonical_roots root ON root.origin_id=m.request_id WHERE m.requester_id=person.id AND root.canonical_id=r.id)
 AND NOT EXISTS(SELECT 1 FROM requester_update_permissions WHERE requester_address_id=a.id AND (revoked_at IS NOT NULL OR suppressed_at IS NOT NULL))`
export const capturedSelection=`SELECT person.id AS requesterId,a.id AS addressId,a.email,person.display_name AS displayName
 FROM requests r JOIN requesters person ON person.id IN(${capturedContacts}) JOIN requester_addresses a ON a.requester_id=person.id
 WHERE r.id=? AND ${capturedSafety}
 AND a.id=(SELECT MIN(chosen.id) FROM requester_addresses chosen WHERE chosen.requester_id=person.id AND chosen.verified_at IS NOT NULL AND chosen.suppressed_at IS NULL)`
export const capturedPostal=`EXISTS(SELECT 1 FROM penny_mail_identity WHERE singleton=1 AND trim(postal_address)<>'')`
export async function capturedPreview(db:D1Database,slug:string){
 const r=await db.prepare('SELECT id FROM requests WHERE slug=?').bind(slug).first<{id:string}>()
 if(!r)return null
 const contacts=(await db.prepare(capturedSelection).bind(r.id).all()).results
 return {count:contacts.length,contacts,postalAddressRecorded:!!await db.prepare('SELECT 1 WHERE '+capturedPostal).first()}
}
export function capturedIntents(db:D1Database,requestId:string,updateId:string,selected:boolean,now:string){
 return db.prepare(`INSERT INTO notification_intents(event_id,requester_id,address_id,created_at,updated_at,captured_contact)
 SELECT ?,requesterId,addressId,?,?,1 FROM (${capturedSelection}) WHERE ?=1 AND ${capturedPostal}
 AND EXISTS(SELECT 1 FROM request_status_updates WHERE id=? AND notify_captured_contacts=1)
 ON CONFLICT(event_id,address_id) DO UPDATE SET captured_contact=1`).bind(updateId,now,now,requestId,Number(selected),updateId)
}
/** Delivery rechecks the contact relationship, suppression, prior unsubscribe
 * and postal address. The selected per-update intent grants no permission. */
export const capturedEventEligible=`i.captured_contact=1 AND ${capturedPostal}
 AND EXISTS(SELECT 1 FROM request_status_updates selected WHERE selected.id=i.event_id AND selected.notify_captured_contacts=1)
 AND EXISTS(SELECT 1 FROM requests r JOIN requesters person ON person.id=n.requester_id JOIN requester_addresses a ON a.id=n.address_id
 WHERE r.id=n.request_id AND person.id IN(${capturedContacts}) AND ${capturedSafety})`
