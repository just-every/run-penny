import type { DatabaseConnection } from '@/core/platform/database'
import { RequestLifecycleError } from './lifecycle-types'

/** Read before changing the merge graph. Each person contributes one address,
 * and someone already following the canonical request needs no merge notice. */
export const mergeNoticeAudienceSql=`SELECT f.requester_id AS requesterId,a.id AS addressId
 FROM request_follows f JOIN requesters person ON person.id=f.requester_id
 JOIN requester_addresses a ON a.requester_id=f.requester_id
 WHERE f.request_id=?1 AND f.muted_at IS NULL AND person.blocked_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM requester_identity_merges retired WHERE retired.source_requester_id=person.id)
 AND NOT EXISTS(SELECT 1 FROM request_follows existing WHERE existing.request_id=?2 AND existing.requester_id=person.id)
 AND NOT EXISTS(SELECT 1 FROM requester_notification_preferences p WHERE p.requester_id=person.id AND p.muted_at IS NOT NULL)
 AND NOT EXISTS(SELECT 1 FROM request_notification_mutes m JOIN request_canonical_roots root ON root.origin_id=m.request_id WHERE m.requester_id=person.id AND root.canonical_id IN(?1,?2))
 AND a.id=(SELECT candidate.id FROM requester_addresses candidate
   JOIN requester_update_permissions permission ON permission.requester_address_id=candidate.id
   JOIN request_canonical_roots root ON root.origin_id=permission.request_id
   WHERE candidate.requester_id=person.id AND candidate.verified_at IS NOT NULL AND candidate.suppressed_at IS NULL
   AND permission.requester_id=person.id AND permission.revoked_at IS NULL AND permission.suppressed_at IS NULL AND root.canonical_id=?1
   ORDER BY permission.granted_at,candidate.id LIMIT 1)`

export async function previewMergeNotice(database:DatabaseConnection,sourceSlug:string,targetSlug:string){
 const db=database.binding
 const source=await db.prepare('SELECT id FROM requests WHERE slug=? AND merged_into_request_id IS NULL').bind(sourceSlug).first<{id:string}>()
 const target=await db.prepare('SELECT root.canonical_id AS id FROM requests r JOIN request_canonical_roots root ON root.origin_id=r.id WHERE r.slug=?').bind(targetSlug).first<{id:string}>()
 if(!source||!target)throw new RequestLifecycleError(404,'request_not_found','Choose an existing duplicate and canonical request.')
 if(source.id===target.id)throw new RequestLifecycleError(409,'merge_cycle','A request cannot merge into itself.')
 const result=await db.prepare(`SELECT COUNT(*) AS count FROM (${mergeNoticeAudienceSql})`).bind(source.id,target.id).first<{count:number}>()
 return {recipientCount:Number(result?.count??0)}
}

export function captureMergeNotice(db:D1Database,mergeId:string,sourceId:string,targetId:string,enabled:boolean,now:string){
 return [
  db.prepare('INSERT INTO penny_merge_notices(merge_id,enabled,created_at) VALUES(?,?,?)').bind(mergeId,enabled?1:0,now),
  db.prepare(`INSERT INTO penny_merge_notice_recipients(merge_id,requester_id,address_id,created_at)
   SELECT ?3,requesterId,addressId,?4 FROM (${mergeNoticeAudienceSql}) WHERE ?5=1`).bind(sourceId,targetId,mergeId,now,enabled?1:0),
 ]
}

/** A private canonical request keeps its captured audience pending. The first
 * notification wakeup after public approval activates it; restored intent stays held. */
export function activateMergeNoticeStatements(db:D1Database,now:string){
 return [
  db.prepare(`INSERT OR IGNORE INTO notification_events(id,request_id,kind,subject_id,body,created_at,updated_at)
   SELECT 'merge:'||n.merge_id,r.id,'merge',n.merge_id,'',?,?
   FROM penny_merge_notices n JOIN request_merges m ON m.id=n.merge_id
   JOIN request_canonical_roots root ON root.origin_id=m.target_request_id
   JOIN requests r ON r.id=root.canonical_id JOIN boards b ON b.id=r.board_id
   LEFT JOIN requesters author ON author.id=r.author_requester_id
   WHERE n.enabled=1 AND n.queued_at IS NULL AND n.restoration_hold_at IS NULL AND m.unmerged_at IS NULL
    AND r.moderation_state='approved' AND r.published_at IS NOT NULL AND r.withdrawn_at IS NULL
    AND r.merged_into_request_id IS NULL AND b.visibility='public' AND (author.id IS NULL OR author.blocked_at IS NULL)
    AND (SELECT phase FROM data_state WHERE singleton=1)='idle'`).bind(now,now),
  db.prepare("UPDATE penny_merge_notices SET queued_at=? WHERE queued_at IS NULL AND restoration_hold_at IS NULL AND EXISTS(SELECT 1 FROM notification_events e WHERE e.kind='merge' AND e.subject_id=penny_merge_notices.merge_id)").bind(now),
 ]
}
