import type { DatabaseConnection } from '@/core/platform/database'
import { createRequestId } from './lifecycle-ids'
import { RequestLifecycleError, type ModerationSubject, type ModerationVerdict } from './lifecycle-types'

export interface VerdictInput {
  readonly operatorId: string
  readonly verdict: ModerationVerdict
  readonly reason?: string
  readonly notifyAuthor?: boolean
  readonly body?: string
  readonly now: string
}
export function requireRejectionReason(input: VerdictInput): void {
  if (input.verdict === 'rejected' && !input.reason) throw new RequestLifecycleError(400, 'rejection_reason_required', 'A rejection reason is required.')
}
export const activeModerationAuthor = (id: string): string => `(${id} IS NULL OR EXISTS(
  SELECT 1 FROM requesters author WHERE author.id=${id} AND author.blocked_at IS NULL
  AND NOT EXISTS(SELECT 1 FROM requester_identity_merges WHERE source_requester_id=author.id)))`
export const currentModerationRequest = (alias: string): string => `${alias}.withdrawn_at IS NULL AND ${alias}.merged_into_request_id IS NULL AND ${activeModerationAuthor(`${alias}.author_requester_id`)}`
export const lastModeration = (type: ModerationSubject, id: string): string => `(SELECT id FROM request_moderation_events WHERE subject_type='${type}' AND subject_id=${id} ORDER BY rowid DESC LIMIT 1)`

type Snapshot = { id: string; requestId: string } & Record<string, string | number | null>
/** The query and its aliases are repository-owned SQL. Compare the complete
 * selected context, including verdict history, so a later review cycle cannot
 * admit a decision prepared for an earlier one (even with equal timestamps). */
export function moderationClaim(db: DatabaseConnection, type: ModerationSubject, query: string, values: (string | number | null)[], selected: Snapshot, input: VerdictInput) {
  const id = createRequestId()
  const fields = Object.entries(selected)
  const statement = db.binding.prepare(`INSERT INTO request_moderation_events
    (id,subject_type,subject_id,request_id,verdict,reason,actor_operator_id,created_at,updated_at)
    SELECT ?,?,candidate.id,candidate.requestId,?,?,?,?,? FROM (${query}) candidate
    WHERE ${fields.map(([field]) => `candidate."${field}" IS ?`).join(' AND ')} RETURNING 1 AS affected`)
    .bind(id,type,input.verdict,input.reason??null,input.operatorId,input.now,input.now,...values,...fields.map(([,value])=>value))
  return { id, statement, gate: 'EXISTS(SELECT 1 FROM request_moderation_events WHERE id=?)' }
}
export async function commitModeration(db: DatabaseConnection, claim: ReturnType<typeof moderationClaim>, input: VerdictInput, statements: D1PreparedStatement[], missing = false): Promise<void> {
  const results = await db.binding.batch([
    claim.statement,
    ...statements,
    db.binding.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,details_json,created_at,updated_at)
      SELECT ?,'operator',?,'request.moderated',subject_type,subject_id,?,NULL,?,? FROM request_moderation_events WHERE id=?`)
      .bind(createRequestId(),input.operatorId,input.now,input.now,input.now,claim.id),
  ])
  if (results[0].results.length !== 1) throw new RequestLifecycleError(missing?404:409,missing?'not_found':'moderation_conflict','The moderation subject changed before this verdict.')
}
