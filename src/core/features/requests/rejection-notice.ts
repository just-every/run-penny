import type { DatabaseConnection } from '@/core/platform/database'
import { createUlid } from '@/core/shared/ulid'
import type { VerdictInput } from './moderation-claim'

/** The operator's choice to notify the author is recorded here. No mail sender reads
 * this event type, so the row is written in its final state with the reason, never
 * as a queued row that nothing will send. */
export function rejectionNotice(database: DatabaseConnection, input: VerdictInput,
  subjectType: 'request'|'comment'|'request_edit'|'comment_edit', subjectId: string,
  requesterId: string|null, eventId: string): D1PreparedStatement[] {
  if (!input.notifyAuthor || input.verdict!=='rejected' || !requesterId) return []
  return [database.binding.prepare(`INSERT OR IGNORE INTO notification_outbox
    (id,event_type,subject_id,event_version,requester_id,dedupe_key,payload_json,delivery_state,failure_reason,attempt_count,available_at,created_at,updated_at)
    SELECT ?,'moderation_rejected',?,1,?,?,?,'suppressed','no_delivery_path',0,?,?,?
    WHERE EXISTS(SELECT 1 FROM request_moderation_events event JOIN requests r ON r.id=event.request_id
      JOIN boards b ON b.id=r.board_id WHERE event.id=? AND b.visibility='public')`)
    .bind(createUlid(),subjectId,requesterId,`moderation-rejected:${subjectType}:${subjectId}:${eventId}`,
      JSON.stringify({subjectType,title:'Your feedback was reviewed',body:input.reason}),input.now,input.now,input.now,eventId)]
}
