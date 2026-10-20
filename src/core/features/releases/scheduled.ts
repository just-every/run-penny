import { MutationError } from '@/core/app/operator-mutations'
import { NativeError } from '../auth/native-tokens'
import { guardedDatabase } from '../integrations/guarded-database'
import { publishRoadmapUpdate } from '../roadmap/update-publication'
import { publishRelease } from './publication'

const scheduler={system:'publication.scheduler'}
/** The schedule guard and completion surround the existing publication batch.
 * There is no lease to strand after a crash: either publication, snapshots,
 * outbox, audit and completion all commit, or the entire batch rolls back. */
export async function drainScheduledPublications(db:D1Database,scheduledTime:number){
 const now=new Date(scheduledTime).toISOString()
 const due=(await db.prepare(`SELECT s.id,s.release_id AS releaseId,s.roadmap_update_id AS updateId,r.slug FROM penny_publication_schedules s LEFT JOIN releases r ON r.id=s.release_id
  WHERE s.state='scheduled' AND s.scheduled_at<=? AND (SELECT phase FROM data_state WHERE singleton=1)='idle' ORDER BY s.scheduled_at,s.id LIMIT 50`).bind(now).all<{id:string;releaseId:string|null;updateId:string|null;slug:string|null}>()).results
 for(const row of due){
  const guarded=guardedDatabase(db,{sql:"EXISTS(SELECT 1 FROM penny_publication_schedules WHERE id=? AND state='scheduled' AND scheduled_at<=?) AND (SELECT phase FROM data_state WHERE singleton=1)='idle'",params:[row.id,now]})
  const complete=()=>guarded.prepare("UPDATE penny_publication_schedules SET state='published',completed_at=?,updated_at=? WHERE id=? AND state='scheduled'").bind(now,now,row.id)
  const publicationDb=new Proxy(guarded,{get(target,key){if(key==='batch')return (statements:D1PreparedStatement[])=>target.batch([...statements,complete()]);const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value}})
  try{
   if(row.releaseId)await publishRelease(publicationDb,row.slug!,now,scheduler)
   else await publishRoadmapUpdate(publicationDb,row.updateId!,now,scheduler)
   // A manually published release returns before making a batch. Settle its
   // schedule without re-sending; a concurrent tick may already have settled it.
   await db.prepare("UPDATE penny_publication_schedules SET state='published',completed_at=?,updated_at=? WHERE id=? AND state='scheduled' AND (SELECT phase FROM data_state WHERE singleton=1)='idle'").bind(now,now,row.id).run()
  }catch(error){
   if(error instanceof NativeError&&error.code==='integration_authority_changed')continue
   if(!(error instanceof MutationError))throw error
   // This failed row is also the durable, dismissible in-app author notice.
   // It becomes terminal exactly once and creates no requester delivery.
   await db.prepare("UPDATE penny_publication_schedules SET state='failed',last_error=?,completed_at=?,updated_at=? WHERE id=? AND state='scheduled' AND (SELECT phase FROM data_state WHERE singleton=1)='idle'").bind(error.message,now,now,row.id).run()
  }
 }
}
