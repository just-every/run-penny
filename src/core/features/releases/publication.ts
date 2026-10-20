import { publicationActor,type PublicationActor } from '../releases/publication-actor'
import { releaseMediaGuard } from './media-approval'
import { MutationError } from '@/core/app/operator-mutations'
import { createUlid } from '@/core/shared/ulid'
import { recipientSelection } from './recipients'
import { publicationGuard,visibleRequestIds } from './publication-policy'
const validTargets=`EXISTS(SELECT 1 FROM release_targets WHERE release_id=v.release_id)
 AND NOT EXISTS(SELECT 1 FROM release_targets t JOIN roadmap_items i ON i.id=t.roadmap_item_id
 LEFT JOIN roadmap_publications p ON p.roadmap_item_id=i.id WHERE t.release_id=v.release_id AND
 (i.status!='shipped' OR i.decision_id IS NOT t.decision_id OR p.id IS NOT t.approval_id OR p.approved_at IS NOT t.approval_at
 OR p.updated_at IS NOT t.approval_updated_at OR p.withdrawn_at IS NOT NULL OR p.public_title IS NOT t.public_title
 OR p.public_summary IS NOT t.public_summary OR p.public_slug IS NOT t.public_slug))
 AND NOT EXISTS(SELECT 1 FROM release_targets t WHERE t.release_id=v.release_id AND NOT EXISTS(SELECT 1 FROM release_draft_mappings m WHERE m.release_id=t.release_id AND m.roadmap_item_id=t.roadmap_item_id))
 AND NOT EXISTS(SELECT 1 FROM release_draft_mappings d LEFT JOIN roadmap_request_mappings m ON m.roadmap_item_id=d.roadmap_item_id AND m.request_id=d.request_id
 WHERE d.release_id=v.release_id AND (m.request_id IS NULL OR m.approved_at IS NOT d.approval_at OR m.updated_at IS NOT d.approval_updated_at OR m.withdrawn_at IS NOT NULL OR d.request_id NOT IN(${visibleRequestIds})))
 AND NOT EXISTS(SELECT 1 FROM roadmap_request_mappings m JOIN release_targets t ON t.roadmap_item_id=m.roadmap_item_id
 WHERE t.release_id=v.release_id AND m.approved_at IS NOT NULL AND m.withdrawn_at IS NULL AND NOT EXISTS(SELECT 1 FROM release_draft_mappings d WHERE d.release_id=t.release_id AND d.roadmap_item_id=m.roadmap_item_id AND d.request_id=m.request_id))`
export async function publishRelease(db:D1Database,slug:string,now=new Date().toISOString(),actorId?:PublicationActor){
 const release=await db.prepare(`SELECT r.id,r.state,r.current_version_id AS versionId,v.title,v.body,v.publication_date AS publicationDate FROM releases r JOIN release_versions v ON v.id=r.current_version_id WHERE r.slug=?`).bind(slug).first<{id:string;state:string;versionId:string;title:string;body:string;publicationDate:string|null}>()
 if(!release)throw new MutationError(404,'Release not found.')
 if(release.state==='published')return {id:release.id,versionId:release.versionId}
 const targets=await db.prepare(`SELECT i.id,p.public_title AS title,i.status FROM release_targets t JOIN roadmap_items i ON i.id=t.roadmap_item_id LEFT JOIN roadmap_publications p ON p.roadmap_item_id=i.id WHERE t.release_id=?`).bind(release.id).all<{id:string;title:string;status:string}>()
 const missing=[...(!release.title.trim()?['Title']:[]),...(!release.body.trim()?['Body']:[]),...(!release.publicationDate?['Publication date']:[]),...(!targets.results.length?['At least one target']:[]),...targets.results.filter(t=>t.status!=='shipped').map(t=>`${t.title}: must be Shipped`)]
 if(missing.length)throw new MutationError(422,`Required: ${missing.join('; ')}.`)
 const media=releaseMediaGuard(slug,release.body)
 const claim=createUlid(),versionId=release.versionId
 const source=`SELECT request_id FROM release_target_snapshots WHERE version_id=? AND EXISTS(SELECT 1 FROM release_versions WHERE id=? AND publication_claim=?)`
 try{await db.batch([
  publicationGuard(db,claim,`EXISTS(SELECT 1 FROM releases r JOIN release_versions v ON v.id=r.current_version_id WHERE r.id=? AND (r.state='published' OR
   (v.id=? AND trim(v.title)!='' AND trim(v.body)!='' AND v.publication_date IS NOT NULL AND json_array_length(v.subject_tags_json)>0
    AND NOT EXISTS(SELECT 1 FROM json_each(v.subject_tags_json) selected WHERE NOT EXISTS(SELECT 1 FROM tags WHERE id=selected.value)) AND ${validTargets} AND ${media.sql})))`,[release.id,versionId,...media.values]),
  db.prepare(`UPDATE release_versions SET publication_claim=?,updated_at=?,author_name=(SELECT o.display_name FROM releases r JOIN operators o ON o.id=r.author_operator_id WHERE r.id=release_id),tag_names_json=(SELECT json_group_array(name) FROM (SELECT tag.name FROM tags tag JOIN json_each(subject_tags_json) selected ON selected.value=tag.id ORDER BY tag.name)) WHERE id=? AND publication_claim IS NULL AND EXISTS(SELECT 1 FROM releases WHERE id=release_id AND state='draft')`).bind(claim,now,versionId),
  db.prepare(`INSERT INTO release_target_snapshots(version_id,roadmap_item_id,decision_id,request_id,created_at,updated_at)
   SELECT ?,t.roadmap_item_id,t.decision_id,m.request_id,?,? FROM release_targets t JOIN release_draft_mappings m ON m.release_id=t.release_id AND m.roadmap_item_id=t.roadmap_item_id
   WHERE t.release_id=? AND EXISTS(SELECT 1 FROM release_versions WHERE id=? AND publication_claim=?)`).bind(versionId,now,now,release.id,versionId,claim),
  db.prepare(`INSERT INTO release_recipient_snapshots(id,release_version_id,requester_id,requester_address_id,request_id,recipient_email,verification_epoch,created_at,updated_at)
   SELECT lower(hex(randomblob(16))),?,c.requester_id,c.address_id,MIN(c.request_id),a.email,a.verification_epoch,?,? FROM (${recipientSelection(source,true)}) c JOIN requester_addresses a ON a.id=c.address_id GROUP BY c.requester_id,c.address_id`).bind(versionId,now,now,versionId,versionId,claim),
  db.prepare(`INSERT INTO release_recipient_contexts(snapshot_id,request_id,roadmap_item_id,title,slug,created_at,updated_at)
   SELECT s.id,c.request_id,t.roadmap_item_id,c.title,c.slug,?,? FROM (${recipientSelection(source,true)}) c
   JOIN release_recipient_snapshots s ON s.release_version_id=? AND s.requester_id=c.requester_id AND s.requester_address_id=c.address_id
   JOIN release_target_snapshots t ON t.version_id=s.release_version_id AND t.request_id=c.request_id`).bind(now,now,versionId,versionId,claim,versionId),
  db.prepare('UPDATE release_versions SET snapshot_sealed_at=?,delivery_requested_at=? WHERE id=? AND publication_claim=? AND snapshot_sealed_at IS NULL').bind(now,now,versionId,claim),
  db.prepare(`INSERT INTO notification_outbox(id,event_type,subject_id,event_version,requester_id,dedupe_key,payload_json,delivery_state,available_at,address_id,release_snapshot_id,created_at,updated_at)
   SELECT 'release:'||v.id||':'||s.requester_id,'release_version',v.id,v.version_number,s.requester_id,'release:'||v.id||':'||s.requester_id,'{}','queued',?,s.requester_address_id,s.id,?,?
   FROM release_recipient_snapshots s JOIN release_versions v ON v.id=s.release_version_id WHERE v.id=? AND v.publication_claim=?`).bind(now,now,now,versionId,claim),
  db.prepare('UPDATE release_versions SET is_portal_current=1 WHERE id=? AND publication_claim=?').bind(versionId,claim),
  db.prepare("UPDATE releases SET state='published',published_at=?,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM release_versions WHERE id=? AND publication_claim=?)").bind(now,now,release.id,versionId,claim),
  db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) SELECT ?,?,?,'release.published','release',?,?,?,? WHERE EXISTS(SELECT 1 FROM release_versions WHERE id=? AND publication_claim=?)`).bind(createUlid(),...publicationActor(actorId,'release.publication'),release.id,now,now,now,versionId,claim),
  db.prepare('DELETE FROM requester_write_guards WHERE id=?').bind(claim),
 ])}catch(error){if(String(error).includes('requester_write_admitted')||String(error).includes('permitted'))throw new MutationError(409,'Release targets, approved wording, images or mappings changed; review every target, approved image and Shipped status.');throw error}
 return {id:release.id,versionId}
}
