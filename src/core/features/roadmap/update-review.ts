import { MutationError } from '@/core/app/operator-mutations'
import { createUlid } from '@/core/shared/ulid'
import { publicationGuard } from '../releases/publication-policy'
import { validRoadmapUpdateDraft } from './update-policy'

/** Discard retains the rejected witness and wording; only a later deliberate
 * roadmap transition prepares a new draft under the current approval. */
export async function discardStaleRoadmapUpdate(db: D1Database, id: string, actor: string, now = new Date().toISOString()) {
 if (!await db.prepare('SELECT id FROM roadmap_update_versions WHERE id=?').bind(id).first()) throw new MutationError(404, 'Status update not found.')
 const guard = createUlid()
 try {
  await db.batch([
   publicationGuard(db, guard, `EXISTS(SELECT 1 FROM roadmap_update_versions v WHERE v.id=? AND v.published_at IS NULL AND (v.discarded_at IS NOT NULL OR NOT (${validRoadmapUpdateDraft})))`, [id]),
   db.prepare('UPDATE roadmap_update_versions SET discarded_at=?,updated_at=? WHERE id=? AND discarded_at IS NULL').bind(now, now, id),
   db.prepare("INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) SELECT ?,'operator',?,'roadmap.update_discarded','roadmap_update',?,?,?,? WHERE changes()=1").bind(createUlid(),actor,id,now,now,now),
   db.prepare('DELETE FROM requester_write_guards WHERE id=?').bind(guard),
  ])
 } catch (error) {
  if (String(error).includes('requester_write_admitted') || String(error).includes('permitted')) throw new MutationError(409, 'Only an unpublished stale draft can be discarded.')
  throw error
 }
 return { id }
}
