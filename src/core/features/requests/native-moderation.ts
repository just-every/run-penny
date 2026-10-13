import { activeModerationAuthor, lastModeration } from './moderation-claim'
import type { PennyRuntime } from '@/core/app/runtime'
import { NativeError } from '@/core/features/auth/native-tokens'
import { createUlid } from '@/core/shared/ulid'
export interface Moderation {verdict:'approved'|'rejected';title?:string;description?:string;boardSlug?:string;displayName?:string;reason?:string}
export async function moderateNativeRequest(runtime:PennyRuntime,operatorId:string,slug:string,input:Moderation):Promise<void>{
  const db=runtime.database.binding,now=new Date().toISOString(),eventId=createUlid()
  const row=await db.prepare(`SELECT id,author_requester_id AS authorId,${lastModeration('request','requests.id')} AS lastVerdict FROM requests WHERE slug=?`).bind(slug).first<{id:string;authorId:string|null;lastVerdict:string|null}>()
  if(!row)throw new NativeError('not_found',404)
  const approved=input.verdict==='approved'
  const board=approved?await db.prepare("SELECT id FROM boards WHERE slug=? AND visibility='public' AND archived_at IS NULL").bind(input.boardSlug!).first<{id:string}>():null
  if(approved&&!board)throw new NativeError('board_unavailable',409)
  const results=await db.batch([
    db.prepare(`INSERT INTO native_moderation_events(id,request_id,actor_id,verdict,reason,created_at,updated_at)
      SELECT ?,r.id,?,?,?,?,? FROM requests r
      WHERE r.id=? AND r.moderation_state='awaiting_review' AND r.withdrawn_at IS NULL AND r.merged_into_request_id IS NULL
      AND r.author_requester_id IS ? AND ${lastModeration('request','r.id')} IS ? AND ${activeModerationAuthor('r.author_requester_id')}
      AND (?=0 OR EXISTS(SELECT 1 FROM boards WHERE id=? AND visibility='public' AND archived_at IS NULL)) RETURNING 1 AS affected`)
      .bind(eventId,operatorId,input.verdict,input.reason??null,now,now,row.id,row.authorId,row.lastVerdict,approved?1:0,board?.id??null),
    db.prepare(`UPDATE requests SET moderation_state=?,public_state=?,public_title=?,public_description=?,approved_author_name=?,public_author_display_name=?,board_id=COALESCE(?,board_id),published_at=?,updated_at=?
      WHERE id=? AND EXISTS(SELECT 1 FROM native_moderation_events WHERE id=?)`)
      .bind(input.verdict,approved?'open':'unpublished',approved?input.title!:null,approved?input.description!:null,approved?input.displayName!:null,approved?input.displayName!:null,board?.id??null,approved?now:null,now,row.id,eventId),
    db.prepare(`UPDATE request_content_submissions SET moderation_state=?,rejection_reason=?,approved_at=?,updated_at=? WHERE request_id=? AND moderation_state='awaiting_review' AND EXISTS(SELECT 1 FROM native_moderation_events WHERE id=?)`).bind(input.verdict,input.reason??null,approved?now:null,now,row.id,eventId),
    db.prepare(`INSERT INTO request_moderation_events(id,subject_type,subject_id,request_id,verdict,reason,actor_operator_id,created_at,updated_at) SELECT id,'request',request_id,request_id,verdict,reason,actor_id,created_at,updated_at FROM native_moderation_events WHERE id=?`).bind(eventId),
    db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at)
      SELECT ?,'operator',?,'request.moderated','request',?,?,?,? WHERE EXISTS(SELECT 1 FROM native_moderation_events WHERE id=?)`).bind(createUlid(),operatorId,row.id,now,now,now,eventId),
  ])
  if(results[0].results.length!==1)throw new NativeError('moderation_conflict',409)
}
export async function listNativeModeration(runtime:PennyRuntime){
  const rows=await runtime.database.binding.prepare(`SELECT r.slug,r.title,r.description,r.proposed_solution AS proposedSolution,r.impact_statement AS impactStatement,r.moderation_state AS moderationState,
    b.slug AS boardSlug,b.name AS boardName,author.display_name AS displayName,r.created_at AS createdAt,
    (SELECT reason FROM native_moderation_events WHERE request_id=r.id ORDER BY created_at DESC,id DESC LIMIT 1) AS reason
    FROM requests r JOIN boards b ON b.id=r.board_id LEFT JOIN requesters author ON author.id=r.author_requester_id
    WHERE r.withdrawn_at IS NULL
    ORDER BY CASE r.moderation_state WHEN 'awaiting_review' THEN 0 ELSE 1 END,r.created_at DESC LIMIT 100`).all()
  return rows.results
}
