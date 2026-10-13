import { requesterWrite } from './write-admission'
import type { DatabaseConnection } from '@/core/platform/database'
import type { RequesterIdentity } from '@/core/features/auth/native-service'
import { digest, NativeError, takeRateLimit } from '@/core/features/auth/native-tokens'
import { createUlid } from '@/core/shared/ulid'
export interface Submission {title:string;description:string;boardSlug:string;proposedSolution?:string;impactStatement?:string;idempotencyKey:string;emailUpdates?:boolean}
export async function submitNativeRequest(database:DatabaseConnection,identity:RequesterIdentity,input:Submission):Promise<{slug:string;moderationState:string}> {
  const db=database.binding,now=new Date().toISOString()
  const canonicalInput={...input,emailUpdates:input.emailUpdates??false}
  const keyHash=await digest(`${identity.id}:${input.idempotencyKey}`),bodyHash=await digest(JSON.stringify({...canonicalInput,idempotencyKey:undefined}))
  const previous=async()=>db.prepare(`SELECT k.body_hash AS bodyHash,r.slug,r.moderation_state AS moderationState FROM request_submission_keys k JOIN requests r ON r.id=k.request_id WHERE k.key_hash=? AND k.expires_at>?`).bind(keyHash,now).first<{bodyHash:string;slug:string;moderationState:string}>()
  const legacyBodyHash=await digest(JSON.stringify({...input,idempotencyKey:undefined}))
  const replay=(row:NonNullable<Awaited<ReturnType<typeof previous>>>)=>{if(row.bodyHash!==bodyHash && row.bodyHash!==legacyBodyHash)throw new NativeError('idempotency_conflict',409);return {slug:row.slug,moderationState:row.moderationState}}
  const saved=await previous();if(saved)return replay(saved)
  await takeRateLimit(db,'submissions',identity.id,10,3600000)
  const board=await db.prepare("SELECT id FROM boards WHERE slug=? AND visibility='public' AND archived_at IS NULL").bind(input.boardSlug).first<{id:string}>()
  if(!board)throw new NativeError('board_unavailable',409)
  const requestId=createUlid(),evidenceId=createUlid(),slug=`feedback-${requestId.toLowerCase()}`
  // Each statement and the key reservation are one atomic D1 batch. A concurrent
  // duplicate's unique key violation rolls back its complete graph.
  try {
    await requesterWrite(database,{requesterId:identity.id,verifiedEmail:identity.email,addressId:identity.addressId,sessionId:identity.sessionId,verifiedAt:identity.verifiedAt,verificationSessions:identity.verificationSessions,hostEmailHash:identity.hostEmailHash,hostClaimHash:identity.hostClaimHash,displayName:identity.displayName},[
      db.prepare('DELETE FROM request_submission_keys WHERE key_hash=? AND expires_at<=?').bind(keyHash,now),
      db.prepare(`INSERT INTO requests(id,slug,board_id,author_requester_id,title,description,proposed_solution,impact_statement,moderation_state,public_state,created_at,updated_at)
        SELECT ?,?,?,?,?,?,?,?,'awaiting_review','unpublished',?,? WHERE EXISTS(SELECT 1 FROM requesters WHERE id=? AND blocked_at IS NULL) AND EXISTS(SELECT 1 FROM boards WHERE id=? AND visibility='public' AND archived_at IS NULL)`)
        .bind(requestId,slug,board.id,identity.id,input.title,input.description,input.proposedSolution??null,input.impactStatement??null,now,now,identity.id,board.id),
      db.prepare(`INSERT INTO evidence_items(id,source_type,requester_id,observed_at,review_state,created_at,updated_at) VALUES(?,'portal_request',?,?,'unreviewed',?,?)`).bind(evidenceId,identity.id,now,now,now),
      db.prepare('INSERT INTO evidence_versions(id,evidence_id,version_number,wording,created_at,updated_at) VALUES(?,?,1,?,?,?)').bind(createUlid(),evidenceId,[input.title,input.description,input.proposedSolution,input.impactStatement].filter(Boolean).join('\n\n'),now,now),
      db.prepare('INSERT INTO request_evidence_links(request_id,evidence_id,created_at) VALUES(?,?,?)').bind(requestId,evidenceId,now),
      db.prepare('INSERT INTO request_evidence_contributions(request_id,evidence_id,created_at) VALUES(?,?,?)').bind(requestId,evidenceId,now),
      db.prepare('INSERT INTO request_submission_keys(key_hash,body_hash,request_id,evidence_id,expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(keyHash,bodyHash,requestId,evidenceId,new Date(Date.now()+30*86400000).toISOString(),now,now),
      db.prepare(`INSERT INTO request_content_submissions(id,request_id,requester_id,title,description,proposed_solution,impact_statement,moderation_state,is_initial,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'awaiting_review',1,?,?)`).bind(createUlid(),requestId,identity.id,input.title,input.description,input.proposedSolution??null,input.impactStatement??null,now,now),
      ...(input.emailUpdates ? [
        db.prepare('INSERT INTO request_follows(request_id,requester_id,permission_granted_at,created_at,updated_at) VALUES(?,?,?,?,?)').bind(requestId,identity.id,now,now,now),
        db.prepare('INSERT INTO request_follow_contributions(request_id,requester_id,permission_granted_at,created_at,updated_at) VALUES(?,?,?,?,?)').bind(requestId,identity.id,now,now,now),
        db.prepare("INSERT INTO requester_update_permissions(id,requester_id,requester_address_id,request_id,source,granted_at,created_at,updated_at) VALUES(?,?,?,?,'submission',?,?,?)").bind(createUlid(),identity.id,identity.addressId,requestId,now,now,now)
      ] : []),
      db.prepare("INSERT INTO audit_entries(id,actor_type,action,entity_type,entity_id,occurred_at,created_at,updated_at) VALUES(?,'system','request.submitted','request',?,?,?,?)").bind(createUlid(),requestId,now,now,now),
    ])
  }catch(error){const winner=await previous();if(winner)return replay(winner);throw error}
  return {slug,moderationState:'awaiting_review'}
}
