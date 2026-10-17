import { NativeError } from '../auth/native-tokens'

/** Optional board context for evidence without a linked request. The owner is
 * read during capture, never cached from the form or an earlier board read. */
export function capturedEvidenceOwner(db: D1Database, id: string, boardSlug: string | null | undefined, now: string): D1PreparedStatement[] {
 if (!boardSlug) return []
 const guard = crypto.randomUUID()
 return [
  db.prepare(`INSERT INTO penny_ownership_guards(id,allowed) VALUES (?,EXISTS(SELECT 1 FROM boards WHERE slug=? AND archived_at IS NULL))`).bind(guard, boardSlug),
  db.prepare(`INSERT INTO penny_evidence_owners(evidence_id,operator_id,updated_at)
   SELECT ?,d.operator_id,? FROM boards b JOIN penny_board_owners d ON d.board_id=b.id
   JOIN operators p ON p.id=d.operator_id JOIN oa_operators n ON n.email=p.email
   WHERE b.slug=? AND b.archived_at IS NULL AND n.status='active'`).bind(id, now, boardSlug),
  db.prepare('DELETE FROM penny_ownership_guards WHERE id=?').bind(guard),
 ]
}

export function captureOwnerFailure(error: unknown): never {
 if (String(error).includes('penny_ownership_admitted')) throw new NativeError('ownership_board_changed', 409, 'The capture board is no longer available. Choose an active board and try again.')
 throw error
}
