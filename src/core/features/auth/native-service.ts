import { authMail, mailReady } from './mail'
import { bindPendingRequesterActions, replayPendingRequesterAction } from '@/core/features/requests/pending-actions'
import type { PennyRuntime } from '@/core/app/runtime'
import { createUlid } from '@/core/shared/ulid'
import { digest, NativeError, opaqueToken, takeRateLimit } from './native-tokens'
const day = 86400000
export interface RequesterIdentity { id: string; addressId: string; displayName: string; email: string; sessionId?: string; verifiedAt?: string; verificationSessions?: number; hostEmailHash?: string; hostClaimHash?: string }

export async function issueNativeLink(runtime: PennyRuntime, purpose: 'requester', email: string, displayName: string|null, ip: string, pendingToken?: string): Promise<void> {
  if (!mailReady(runtime)) throw new NativeError('mail_unavailable',503)
  const db=runtime.database.binding, now=new Date().toISOString()
  await takeRateLimit(db,'identity_ip',ip,10,60000)
  await takeRateLimit(db,`identity_${purpose}`,email,5,3600000)
  let pendingHash: string|null=null
  if(purpose==='requester' && pendingToken){
    const bound=await bindPendingRequesterActions(runtime.database,pendingToken,await digest(`${pendingToken}:${email}`),now)
    if(bound==='identity_mismatch')throw new NativeError('pending_identity_mismatch',409)
    pendingHash=await digest(pendingToken)
  }
  const token=opaqueToken(), id=createUlid(), expires=new Date(Date.now()+30*60000).toISOString()
  await db.batch([
    db.prepare('INSERT INTO native_magic_links(id,purpose,email,display_name,token_hash,expires_at,created_at,updated_at,pending_token_hash,pending_email_hash) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,purpose,email,displayName,await digest(token),expires,now,now,pendingHash,pendingToken?await digest(`${pendingToken}:${email}`):null),

  ])
  try {
    const url = new URL('/portal/verify', runtime.configuration.appOrigin)
    url.hash = new URLSearchParams({token}).toString()
    const sent = await authMail(runtime)!.send({ deliveryId: id, from: runtime.configuration.mailFrom!, to: [email], subject: 'Verify your Penny email', text: `Verify your email to continue. This single-use link expires in 30 minutes.\n\n${url.href}`, headers: { 'Auto-Submitted': 'auto-generated' } })
    if (sent.status !== 'accepted' && !(sent.status === 'development' && runtime.configuration.environment === 'local')) throw new Error('mail_not_accepted')
  } catch {
    await db.prepare('UPDATE native_magic_links SET consumed_at=?,updated_at=? WHERE id=?').bind(now,now,id).run()
    throw new NativeError('mail_unavailable',503)
  }
}

export async function consumeNativeLink(runtime: PennyRuntime, purpose: 'requester', token: string): Promise<{token:string; displayName:string; rejectedPendingActions:number}> {
  let rejectedPendingActions=0
  const db=runtime.database.binding, now=new Date().toISOString(), hash=await digest(token)
  const link=await db.prepare('SELECT email,display_name AS displayName,pending_token_hash AS pendingHash,pending_email_hash AS pendingEmailHash FROM native_magic_links WHERE purpose=? AND token_hash=? AND consumed_at IS NULL AND expires_at>?').bind(purpose,hash,now).first<{email:string; displayName:string|null;pendingHash:string|null;pendingEmailHash:string|null}>()
  if (!link) throw new NativeError('invalid_magic_link',401)
  if (purpose==='requester') {
    const blocked=await db.prepare('SELECT r.blocked_at AS blocked FROM requesters r JOIN requester_addresses a ON a.requester_id=r.id WHERE a.email=?').bind(link.email).first<{blocked:string|null}>()
    if (blocked?.blocked) throw new NativeError('requester_blocked',403)
  }
  // The consume predicate gates every following insert in the same D1 batch.
  // A unique claim marker fences concurrent consumption; a loser writes nothing.
  const claim=createUlid(), sessionToken=opaqueToken(), sessionHash=await digest(sessionToken), expires=new Date(Date.now()+30*day).toISOString()
  const gate='EXISTS(SELECT 1 FROM native_magic_links WHERE token_hash=? AND claim_id=?)'
  const statements=[db.prepare(`UPDATE native_magic_links SET claim_id=?,consumed_at=?,updated_at=? WHERE token_hash=? AND purpose=? AND consumed_at IS NULL AND expires_at>? AND NOT EXISTS(SELECT 1 FROM requesters r JOIN requester_addresses a ON a.requester_id=r.id WHERE a.email=? AND r.blocked_at IS NOT NULL) RETURNING 1 AS affected`).bind(claim,now,now,hash,purpose,now,link.email)]
  {
    const requesterId=createUlid()
    statements.push(
      db.prepare(`INSERT INTO requesters(id,display_name,created_at,updated_at) SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM requester_addresses WHERE email=?) AND ${gate}`).bind(requesterId,link.displayName,now,now,link.email,hash,claim),
      db.prepare(`INSERT INTO requester_addresses(id,requester_id,email,verified_at,created_at,updated_at) SELECT ?,?,?,?,?,? WHERE ${gate} ON CONFLICT(email) DO UPDATE SET verified_at=excluded.verified_at,suppressed_at=NULL,updated_at=excluded.updated_at`).bind(createUlid(),requesterId,link.email,now,now,now,hash,claim),
      db.prepare(`INSERT INTO native_requester_sessions(id,requester_id,address_id,token_hash,expires_at,last_used_at,created_at,updated_at) SELECT ?,requester_id,id,?,?,?,?,? FROM requester_addresses WHERE email=? AND ${gate}`).bind(createUlid(),sessionHash,expires,now,now,now,link.email,hash,claim),
    )
  }
  const results=await db.batch(statements)
  if(results[0].results.length!==1) throw new NativeError('invalid_magic_link',401)
  if(purpose==='requester' && link.pendingHash){
    const identity=await authenticateNativeRequester(runtime,sessionToken)
    if(link.pendingEmailHash){let result;do{result=await replayPendingRequesterAction(runtime.database,{requesterId:identity.id,displayName:identity.displayName,verifiedEmail:identity.email,addressId:identity.addressId,sessionId:identity.sessionId},link.pendingHash,link.pendingEmailHash,now);if(result.state==='rejected')rejectedPendingActions++}while(result.state!=='not_requested')}
  }
  return {token:sessionToken,displayName:link.displayName??link.email.split('@')[0],rejectedPendingActions}
}

export async function authenticateNativeRequester(runtime: PennyRuntime, token: string|null): Promise<RequesterIdentity> {
  if(!token) throw new NativeError('requester_verification_required',401)
  const db=runtime.database.binding, now=new Date().toISOString()
  const identity=await db.prepare(`SELECT r.id,r.display_name AS displayName,a.id AS addressId,a.email,r.blocked_at AS blocked,s.id AS sessionId
    FROM native_requester_sessions s JOIN requesters r ON r.id=s.requester_id JOIN requester_addresses a ON a.id=s.address_id
    WHERE s.token_hash=? AND s.expires_at>? AND s.revoked_at IS NULL AND a.verified_at IS NOT NULL AND a.requester_id=r.id`).bind(await digest(token),now).first<RequesterIdentity & {blocked:string|null;sessionId:string}>()
  if(!identity) throw new NativeError('requester_verification_required',401)
  if(identity.blocked) throw new NativeError('requester_blocked',403)
  await db.prepare('UPDATE native_requester_sessions SET last_used_at=?,updated_at=?,expires_at=? WHERE id=?').bind(now,now,new Date(Date.now()+30*day).toISOString(),identity.sessionId).run()
  return {id:identity.id,addressId:identity.addressId,displayName:identity.displayName,email:identity.email,sessionId:identity.sessionId}
}
