import { requestStatusExpression } from './status-sql'
import type { DatabaseConnection } from '@/core/platform/database'
import type { RequesterReference } from './lifecycle-types'
import { RequestLifecycleError } from './lifecycle-types'
import { createRequestId } from './lifecycle-ids'

// Native callers carry the session/address they authenticated. Host assertions
// carry the verified address. A stale identity is rejected, never silently moved.
export function requesterAdmission(identity: RequesterReference) {
  return {
    sql: `EXISTS(SELECT 1 FROM requesters actor JOIN requester_addresses address ON address.requester_id=actor.id
      WHERE actor.id=? AND actor.blocked_at IS NULL AND address.email=? AND address.verified_at IS NOT NULL
      AND (? IS NULL OR address.id=?)
      AND (? IS NULL OR address.verified_at=?)
      AND (? IS NULL OR (SELECT count(*) FROM native_requester_sessions WHERE address_id=address.id)=?)
      AND NOT EXISTS(SELECT 1 FROM requester_identity_merges WHERE source_requester_id=actor.id)
      AND (? IS NULL OR EXISTS(SELECT 1 FROM native_requester_sessions session
        WHERE session.id=? AND session.requester_id=actor.id AND session.address_id=address.id
          AND session.revoked_at IS NULL AND session.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')))
      ${identity.hostEmailHash?`AND NOT EXISTS(SELECT 1 FROM host_identity_tombstones WHERE email_hash=?)
        AND EXISTS(SELECT 1 FROM host_identity_claims WHERE email_hash=? AND requester_id=actor.id AND claim_hash=? AND issued_at>=strftime('%Y-%m-%dT%H:%M:%fZ','now','-24 hours'))`:''})`,
    values: [identity.requesterId, identity.verifiedEmail, identity.addressId??null, identity.addressId??null,
      identity.verifiedAt??null, identity.verifiedAt??null, identity.verificationSessions??null, identity.verificationSessions??null,
      identity.sessionId??null, identity.sessionId??null,...(identity.hostEmailHash?[identity.hostEmailHash,identity.hostEmailHash,identity.hostClaimHash??null]:[])],
  }
}

export const publishedAdmission = `EXISTS(SELECT 1 FROM requests r JOIN boards b ON b.id=r.board_id
  LEFT JOIN requesters author ON author.id=r.author_requester_id WHERE r.id=? AND r.moderation_state='approved'
  AND r.published_at IS NOT NULL AND r.withdrawn_at IS NULL AND r.merged_into_request_id IS NULL
  AND b.visibility='public' AND r.public_state NOT IN ('unpublished','withdrawn') AND (author.id IS NULL OR author.blocked_at IS NULL))`
export const votingAdmission = `${publishedAdmission} AND EXISTS(SELECT 1 FROM requests r WHERE r.id=? AND ${requestStatusExpression} IN ('open','under_review','planned','in_progress'))`
export const ownRequestAdmission = `EXISTS(SELECT 1 FROM requests WHERE id=? AND author_requester_id=?
  AND withdrawn_at IS NULL AND merged_into_request_id IS NULL)`

/** The transient assertion and all effects execute in one D1 transaction. */
export async function requesterWrite(database: DatabaseConnection, identity: RequesterReference,
  statements: D1PreparedStatement[], scope = {sql:'1',values:[] as (string|number|null)[]}) {
  const id=createRequestId(), actor=requesterAdmission(identity), db=database.binding
  try {
    return await db.batch([
      db.prepare(`INSERT INTO requester_write_guards(id,permitted) VALUES(?,CASE WHEN ${actor.sql} AND (${scope.sql}) THEN 1 ELSE 0 END)`).bind(id,...actor.values,...scope.values),
      ...statements,
      db.prepare('DELETE FROM requester_write_guards WHERE id=?').bind(id),
    ])
  } catch(error) {
    if(String(error).includes('requester_write_admitted'))throw new RequestLifecycleError(409,'requester_action_changed','Your identity or this request changed. Refresh before trying again.')
    throw error
  }
}
