import type { DatabaseConnection } from '@/core/platform/database'
import { createUlid } from '@/core/shared/ulid'
import type { VerdictInput } from './moderation-claim'

/** Only the winning verdict creates an intent. The address is fixed now and all
 * permissions are checked again at send time; a merge never moves this audience. */
export function rejectionNotice(database: DatabaseConnection, input: VerdictInput,
  subjectType: 'request'|'comment'|'request_edit'|'comment_edit', subjectId: string,
  requesterId: string|null, eventId: string): D1PreparedStatement[] {
  if (!input.notifyAuthor || input.verdict!=='rejected') return []
  return [database.binding.prepare(`INSERT OR IGNORE INTO notification_outbox
    (id,event_type,subject_id,event_version,requester_id,address_id,dedupe_key,payload_json,delivery_state,attempt_count,available_at,created_at,updated_at)
    SELECT ?,'moderation_rejected',?,1,?,selected.id,
      ?,json_object('subjectType',?,'eventId',event.id,'requestId',event.request_id,'addressEpoch',selected.verification_epoch),'queued',0,?,?,?
    FROM request_moderation_events event LEFT JOIN requester_addresses selected ON selected.id=(SELECT a.id FROM requester_addresses a
       LEFT JOIN requester_update_permissions p ON p.requester_address_id=a.id AND p.requester_id=a.requester_id
         AND p.request_id=event.request_id AND p.revoked_at IS NULL AND p.suppressed_at IS NULL
       WHERE a.requester_id=? AND a.verified_at IS NOT NULL
       ORDER BY p.granted_at IS NULL,a.verified_at DESC,a.id LIMIT 1) WHERE event.id=? AND event.verdict='rejected'`)
    .bind(createUlid(),subjectId,requesterId,`moderation-rejected:${subjectType}:${subjectId}:${eventId}`,
      subjectType,input.now,input.now,input.now,requesterId,eventId)]
}
