import { publicationActor,type PublicationActor } from '../releases/publication-actor'
import { createUlid } from '@/core/shared/ulid'
import { MutationError } from '@/core/app/operator-mutations'
import { validRoadmapUpdateDraft } from './update-policy'
import { recipientSelection } from '../releases/recipients'
import { publicationGuard } from '../releases/publication-policy'
/** A draft retains the exact approval and mapping set from its transition. A
 * withdrawal or new approval requires reviewing a fresh draft, never silently
 * broadening the old version's authority. */

export async function publishRoadmapUpdate(db:D1Database,id:string,now=new Date().toISOString(),actorId?:PublicationActor){
 const exists=await db.prepare('SELECT id FROM roadmap_update_versions WHERE id=?').bind(id).first()
 if(!exists)throw new MutationError(404,'Status update not found.')
 const claim=createUlid()
 const source=`SELECT t.request_id FROM roadmap_update_targets t JOIN roadmap_update_versions v ON v.id=t.version_id WHERE v.id=? AND v.publication_claim=?`
 try{await db.batch([
  publicationGuard(db,claim,`EXISTS(SELECT 1 FROM roadmap_update_versions v WHERE v.id=? AND (v.published_at IS NOT NULL OR (v.discarded_at IS NULL AND ${validRoadmapUpdateDraft})))`,[id]),
  db.prepare('UPDATE roadmap_update_versions SET publication_claim=?,published_at=?,updated_at=? WHERE id=? AND published_at IS NULL').bind(claim,now,now,id),
  db.prepare(`INSERT INTO roadmap_update_histories(id,request_id,version_id,created_at,updated_at)
   SELECT lower(hex(randomblob(16))),t.request_id,v.id,?,? FROM roadmap_update_versions v JOIN roadmap_update_targets t ON t.version_id=v.id WHERE v.id=? AND v.publication_claim=?`).bind(now,now,id,claim),
  db.prepare(`INSERT INTO roadmap_update_contexts(version_id,requester_id,address_id,request_id,title,slug,created_at,updated_at)
   SELECT ?,requester_id,address_id,request_id,title,slug,?,? FROM (${recipientSelection(source)})`).bind(id,now,now,id,claim),
  db.prepare('UPDATE roadmap_update_versions SET snapshot_sealed_at=? WHERE id=? AND publication_claim=? AND snapshot_sealed_at IS NULL').bind(now,id,claim),
  db.prepare(`INSERT INTO notification_events(id,request_id,kind,subject_id,body,roadmap_update_version_id,created_at,updated_at)
   SELECT h.id,h.request_id,'status',h.id,v.body,v.id,?,? FROM roadmap_update_histories h JOIN roadmap_update_versions v ON v.id=h.version_id WHERE v.id=? AND v.publication_claim=?`).bind(now,now,id,claim),
  db.prepare(`INSERT INTO notification_intents(event_id,requester_id,address_id,created_at,updated_at)
   SELECT e.id,c.requester_id,c.address_id,?,? FROM roadmap_update_contexts c JOIN notification_events e ON e.roadmap_update_version_id=c.version_id AND e.request_id=c.request_id
   JOIN roadmap_update_versions v ON v.id=c.version_id WHERE v.id=? AND v.publication_claim=?
   AND c.request_id=(SELECT MIN(first.request_id) FROM roadmap_update_contexts first WHERE first.version_id=c.version_id AND first.requester_id=c.requester_id)`).bind(now,now,id,claim),
  db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) SELECT ?,?,?,'roadmap.update_published','roadmap_update',?,?,?,? WHERE EXISTS(SELECT 1 FROM roadmap_update_versions WHERE id=? AND publication_claim=?)`).bind(createUlid(),...publicationActor(actorId,'roadmap.update_publication'),id,now,now,now,id,claim),
  db.prepare('DELETE FROM requester_write_guards WHERE id=?').bind(claim),
 ])}catch(error){if(String(error).includes('requester_write_admitted')||String(error).includes('permitted'))throw new MutationError(409,'Approved wording, mappings or request visibility changed. Review the status draft.');throw error}
 return {id}
}
