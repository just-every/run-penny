import type { DatabaseConnection } from '@/core/platform/database'

/** Direct actions keep their origin across any number/order of merge reversals.
 * Call inside the same D1 batch as the action or graph change. */
export function projectContributions(database: DatabaseConnection, roots: readonly string[]): D1PreparedStatement[] {
  const db = database.binding
  const placeholders = roots.map(() => '?').join(',')
  const canonical = `SELECT canonical_id FROM request_canonical_roots WHERE origin_id IN (${placeholders})`
  const origins = `SELECT origin_id FROM request_canonical_roots WHERE canonical_id IN (${canonical})`
  return [
    db.prepare(`DELETE FROM request_votes WHERE request_id IN (${origins})`).bind(...roots),
    db.prepare(`INSERT INTO request_votes(request_id,requester_id,created_at,updated_at)
      SELECT r.canonical_id,c.requester_id,MIN(c.created_at),MAX(c.updated_at)
      FROM request_vote_contributions c JOIN requests origin ON origin.id=c.request_id AND origin.withdrawn_at IS NULL
      JOIN request_canonical_roots r ON r.origin_id=c.request_id
      WHERE r.canonical_id IN (${canonical}) GROUP BY r.canonical_id,c.requester_id`).bind(...roots),
    db.prepare(`DELETE FROM request_follows WHERE request_id IN (${origins})`).bind(...roots),
    db.prepare(`INSERT INTO request_follows(request_id,requester_id,permission_granted_at,muted_at,created_at,updated_at)
      SELECT r.canonical_id,c.requester_id,MIN(c.permission_granted_at),
        CASE WHEN COUNT(*)=COUNT(c.muted_at) THEN MAX(c.muted_at) ELSE NULL END,MIN(c.created_at),MAX(c.updated_at)
      FROM request_follow_contributions c JOIN request_canonical_roots r ON r.origin_id=c.request_id
      WHERE r.canonical_id IN (${canonical}) AND (
        NOT EXISTS(SELECT 1 FROM requester_update_permissions p WHERE p.request_id=c.request_id AND p.requester_id=c.requester_id) OR
        EXISTS(SELECT 1 FROM requester_update_permissions p WHERE p.request_id=c.request_id AND p.requester_id=c.requester_id AND p.revoked_at IS NULL)) GROUP BY r.canonical_id,c.requester_id`).bind(...roots),
    db.prepare(`DELETE FROM request_evidence_links WHERE request_id IN (${origins})`).bind(...roots),
    db.prepare(`INSERT INTO request_evidence_links(request_id,evidence_id,created_at)
      SELECT r.canonical_id,c.evidence_id,MIN(c.created_at)
      FROM request_evidence_contributions c JOIN request_canonical_roots r ON r.origin_id=c.request_id
      WHERE r.canonical_id IN (${canonical}) GROUP BY r.canonical_id,c.evidence_id`).bind(...roots),
    db.prepare(`UPDATE request_comments SET request_id=(SELECT canonical_id FROM request_canonical_roots WHERE origin_id=origin_request_id)
      WHERE origin_request_id IN (${origins})`).bind(...roots),
    // Private originals stay at their origin. Once transferred, custody follows
    // reversals even when the file is subsequently rejected.
    db.prepare(`UPDATE attachments SET request_id=(SELECT canonical_id FROM request_canonical_roots WHERE origin_id=origin_request_id)
      WHERE (public_state='published' OR request_id!=origin_request_id) AND origin_request_id IN (${origins})`).bind(...roots),
  ]
}

export const contributionScope = 'SELECT origin_id FROM request_canonical_roots WHERE canonical_id=(SELECT canonical_id FROM request_canonical_roots WHERE origin_id=?)'
