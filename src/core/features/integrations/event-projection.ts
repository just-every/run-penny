import type {PennyRuntime} from '@/core/app/runtime'
export interface ProductEvent {id:string;event:string;request_id:string|null;comment_id:string|null;status_id:string|null;release_id:string|null;version_id:string|null;created_at:number;held:number}
const publicRequest=`SELECT r.id,r.slug,r.public_title AS title FROM requests r JOIN boards b ON b.id=r.board_id WHERE r.id=? AND b.visibility='public' AND r.moderation_state='approved' AND r.published_at IS NOT NULL AND r.withdrawn_at IS NULL AND r.merged_into_request_id IS NULL AND (r.author_requester_id IS NULL OR EXISTS(SELECT 1 FROM requesters u WHERE u.id=r.author_requester_id AND u.blocked_at IS NULL))`
/** Only approved current public fields cross the delivery boundary. The raw
 * event stores references, never private rationale or commercial context. */
export async function projectEvent(runtime:PennyRuntime,event:ProductEvent) {
 if(event.held)return null
 const db=runtime.database.binding
 if(event.event==='release.published'){
  const row=await db.prepare(`SELECT r.slug,v.title,v.body FROM releases r JOIN release_versions v ON v.id=r.current_version_id WHERE r.id=? AND v.id=? AND r.state='published' AND v.snapshot_sealed_at IS NOT NULL`).bind(event.release_id,event.version_id).first<{slug:string;title:string;body:string}>()
  return row?{id:event.id,event:event.event,releaseId:event.release_id,...row}:null
 }
 const request=await db.prepare(publicRequest).bind(event.request_id).first<{id:string;slug:string;title:string}>()
 if(!request)return null
 let body:string|undefined
 if(event.event==='comment.published'){
  body=await db.prepare("SELECT body FROM request_comments WHERE id=? AND request_id=? AND moderation_state='approved' AND published_at IS NOT NULL AND historical_private=0 AND (requester_id IS NULL OR EXISTS(SELECT 1 FROM requesters WHERE id=requester_id AND blocked_at IS NULL))").bind(event.comment_id,event.request_id).first<string>('body')??undefined
  if(!body)return null
 }else if(event.event==='status.published'){
  body=await db.prepare('SELECT body FROM request_status_updates WHERE id=? AND request_id=?').bind(event.status_id,event.request_id).first<string>('body')??undefined
  if(!body)return null
 }
 return {id:event.id,event:event.event,requestId:request.id,slug:request.slug,title:request.title,...(body?{body}:{})}
}
