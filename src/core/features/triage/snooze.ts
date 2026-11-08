import { NativeError } from '../auth/native-tokens'
import { createUlid } from '@/core/shared/ulid'

/** Both native doors keep snooze state and its attributed activity atomic. */
export async function snoozeEvidence(db: D1Database, id: string, until: string | null, actor: string, now: string) {
  const untilAt = until === null ? null : new Date(until).toISOString()
  if (untilAt && untilAt <= now) throw new NativeError('snooze_must_be_future', 400)
  if (!await db.prepare('SELECT id FROM evidence_items WHERE id=?').bind(id).first()) throw new NativeError('not_found', 404)
  await db.batch([
    untilAt
      ? db.prepare('INSERT INTO penny_evidence_snoozes(evidence_id,until_at,updated_at) VALUES(?,?,?) ON CONFLICT(evidence_id) DO UPDATE SET until_at=excluded.until_at,updated_at=excluded.updated_at').bind(id, untilAt, now)
      : db.prepare('DELETE FROM penny_evidence_snoozes WHERE evidence_id=?').bind(id),
    db.prepare("INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) VALUES(?,'operator',?,?,'evidence',?,?,?,?)")
      .bind(createUlid(), actor, untilAt ? 'triage.snoozed' : 'triage.unsnoozed', id, now, now, now),
  ])
}
