import type { PennyRuntime } from '@/core/app/runtime'
import { createUlid } from '@/core/shared/ulid'
import {NativeError} from './native-tokens'
import {hostEmailHash} from './host-custody'
import { requesterWrite } from '@/core/features/requests/write-admission'
import { RequestLifecycleError } from '@/core/features/requests/lifecycle-types'

export interface VerifiedRequester { requesterId: string; displayName: string; verifiedEmail: string; addressId?: string; verifiedAt?: string; verificationSessions?: number; hostEmailHash?: string; hostClaimHash?: string }
export interface ExistingHostIdentity extends VerifiedRequester { addressId: string; verifiedAt: string; verificationSessions: number }
export interface HostClaim {
  email: string; displayName: string; aud: string; issuedAt: string; claimHash: string; accountId?: string; accountName?: string
  revenueCents?: number; renewalDate?: string; health?: string
}

/** Called only after signature, schema and freshness verification. */
export async function verifyHostRequester(runtime: PennyRuntime, claim: HostClaim, existing?: ExistingHostIdentity): Promise<VerifiedRequester> {
  const db = runtime.database.binding, now = new Date().toISOString()
  const blocked = await db.prepare('SELECT r.blocked_at AS blocked FROM requesters r JOIN requester_addresses a ON a.requester_id=r.id WHERE a.email=?').bind(claim.email).first<{blocked:string|null}>()
  if (blocked?.blocked) throw new NativeError('requester_blocked', 403)
  const emailHash=await hostEmailHash(claim.email),guardId=createUlid()
  const gate=`NOT EXISTS(SELECT 1 FROM host_identity_tombstones WHERE email_hash=?)
    AND NOT EXISTS(SELECT 1 FROM requesters r JOIN requester_addresses a ON a.requester_id=r.id WHERE a.email=? AND (r.blocked_at IS NOT NULL OR EXISTS(SELECT 1 FROM requester_identity_merges WHERE source_requester_id=r.id)))
    AND NOT EXISTS(SELECT 1 FROM host_identity_claims WHERE email_hash=? AND (issued_at>? OR (issued_at=? AND claim_hash!=?)))`
  const gateValues=[emailHash,claim.email,emailHash,claim.issuedAt,claim.issuedAt,claim.claimHash]
  const admitted=()=>db.prepare(`INSERT INTO requester_write_guards(id,permitted) VALUES(?,CASE WHEN ${gate} THEN 1 ELSE 0 END)`).bind(guardId,...gateValues)
  const requesterId = createUlid(), accountId = createUlid()
  // Existing-only admission never executes requester/address provisioning. The
  // witness is checked inside the same transaction as every commercial write.
  const statements = existing ? [] : [
    db.prepare('INSERT INTO requesters(id,display_name,created_at,updated_at) SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM requester_addresses WHERE email=?)').bind(requesterId,claim.displayName,now,now,claim.email),
    db.prepare('INSERT INTO requester_addresses(id,requester_id,email,verified_at,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET verified_at=COALESCE(verified_at,excluded.verified_at)').bind(createUlid(),requesterId,claim.email,now,now,now),
  ]
  if (claim.accountId && claim.accountName) statements.push(
    db.prepare('INSERT INTO accounts(id,slug,name,revenue_cents,renewal_date,health,created_at,updated_at) SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM host_identity_accounts WHERE host_account_id=?)').bind(accountId,`host-${accountId.toLowerCase()}`,claim.accountName,claim.revenueCents??null,claim.renewalDate??null,claim.health??null,now,now,claim.accountId),
    db.prepare('INSERT OR IGNORE INTO host_identity_accounts(host_account_id,account_id,created_at) VALUES(?,?,?)').bind(claim.accountId,accountId,now),
    db.prepare('UPDATE accounts SET revenue_cents=COALESCE(?,revenue_cents),renewal_date=COALESCE(?,renewal_date),health=COALESCE(?,health),updated_at=? WHERE id=(SELECT account_id FROM host_identity_accounts WHERE host_account_id=?)').bind(claim.revenueCents??null,claim.renewalDate??null,claim.health??null,now,claim.accountId),
    db.prepare('INSERT OR IGNORE INTO requester_account_links(requester_id,account_id,created_at) SELECT a.requester_id,h.account_id,? FROM requester_addresses a CROSS JOIN host_identity_accounts h WHERE a.email=? AND h.host_account_id=?').bind(now,claim.email,claim.accountId),
  )
  statements.unshift(admitted())
  statements.push(db.prepare(`INSERT INTO host_identity_claims(email_hash,requester_id,issued_at,claim_hash) SELECT ?,requester_id,?,? FROM requester_addresses WHERE email=?
    ON CONFLICT(email_hash) DO UPDATE SET requester_id=excluded.requester_id,issued_at=excluded.issued_at,claim_hash=excluded.claim_hash`).bind(emailHash,claim.issuedAt,claim.claimHash,claim.email),
    db.prepare('DELETE FROM requester_write_guards WHERE id=?').bind(guardId),admitted(),db.prepare('DELETE FROM requester_write_guards WHERE id=?').bind(guardId))
  if (existing) {
    if (existing.verifiedEmail !== claim.email) throw new NativeError('mail_unavailable', 503)
    try { await requesterWrite(runtime.database, existing, statements) }
    catch (error) {
      if (error instanceof RequestLifecycleError && error.code === 'requester_action_changed') throw new NativeError('mail_unavailable', 503)
      throw error
    }
    return {...existing,hostEmailHash:emailHash,hostClaimHash:claim.claimHash}
  }
  try{await db.batch(statements)}catch(error){if(String(error).includes('requester_write_admitted'))throw new NativeError('requester_identity_required',401);throw error}
  const result = await db.prepare('SELECT r.id AS requesterId,r.display_name AS displayName,a.email AS verifiedEmail,r.blocked_at AS blocked FROM requesters r JOIN requester_addresses a ON a.requester_id=r.id WHERE a.email=?').bind(claim.email).first<VerifiedRequester & {blocked:string|null}>()
  if (!result || result.blocked) throw new NativeError('requester_blocked',403)
  return {requesterId:result.requesterId,displayName:result.displayName,verifiedEmail:result.verifiedEmail,hostEmailHash:emailHash,hostClaimHash:claim.claimHash}
}
