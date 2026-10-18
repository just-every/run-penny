import { releaseMediaGuard } from './media-approval'
import { z } from 'zod'
import { MutationError } from '@/core/app/operator-mutations'
import type { PennyRuntime } from '@/core/app/runtime'
import { operatorAuth,authenticateOperator } from '../auth/operator'
import {sessionGuard} from '../integrations/keys'
import { NativeError } from '../auth/native-tokens'
import { publicationGuard } from './publication-policy'
import { createUlid } from '@/core/shared/ulid'
import { releaseDeliveryCounts,type DeliveryCounts } from './counts'
export const correctionSchema=z.object({expectedVersionId:z.string().min(1),title:z.string().trim().min(1).max(300),body:z.string().trim().min(1).max(30000),setupUrl:z.union([z.url().refine(v=>/^https?:\/\//.test(v)),z.literal('')]).optional(),outcomePrompt:z.string().trim().min(1).max(500).default('Have you adopted this update?')}).strict()
export type ReleaseCorrection=z.infer<typeof correctionSchema>
export interface ReleaseVersion {id:string;versionNumber:number;title:string;body:string;setupUrl:string|null;outcomePrompt:string;isCurrent:boolean;deliveryRequestedAt:string|null;createdAt:string;deliveryCounts:DeliveryCounts}
export async function releaseOperatorGuard(runtime:PennyRuntime,request:Request){
 if(request.method!=='GET'&&request.headers.get('Origin')!==runtime.configuration.appOrigin)throw new NativeError('forbidden_origin',403)
 const session=await operatorAuth(runtime).getSession(request),actor=await authenticateOperator(runtime,request)
 if(!session||!actor)throw new NativeError('operator_session_required',401)
 const guard=sessionGuard(session)
 return {sql:guard.sql,values:guard.params,actorId:actor.id}

}
type Authority=Awaited<ReturnType<typeof releaseOperatorGuard>>
export async function correctRelease(db:D1Database,slug:string,input:ReleaseCorrection,authority:Authority){
 const old=await db.prepare(`SELECT v.*,r.current_version_id FROM releases r JOIN release_versions v ON v.id=r.current_version_id WHERE r.slug=? AND r.state='published'`).bind(slug).first<{id:string;release_id:string;version_number:number;original_publication_version_id:string|null}>()
 if(!old)throw new MutationError(404,'Published release not found.')
 if(old.id!==input.expectedVersionId)throw new MutationError(409,'The current release changed. Refresh before correcting it.')
 const media=releaseMediaGuard(slug,input.body)
 const id=createUlid(),guard=createUlid(),now=new Date().toISOString()
 try{await db.batch([
  publicationGuard(db,guard,`${authority.sql} AND EXISTS(SELECT 1 FROM releases WHERE id=? AND current_version_id=? AND state='published') AND ${media.sql}`,[...authority.values,old.release_id,input.expectedVersionId,...media.values]),
  db.prepare(`INSERT INTO release_versions(id,release_id,version_number,title,release_type,body,publication_date,setup_url,outcome_prompt,subject_tags_json,is_portal_current,author_name,tag_names_json,public_labels_json,public_products_json,snapshot_sealed_at,original_publication_version_id,created_at,updated_at)
   SELECT ?,release_id,version_number+1,?,release_type,?,publication_date,?,?,subject_tags_json,0,author_name,tag_names_json,public_labels_json,public_products_json,?,COALESCE(original_publication_version_id,id),?,? FROM release_versions WHERE id=?`).bind(id,input.title,input.body,input.setupUrl||null,input.outcomePrompt,now,now,now,old.id),
  db.prepare('UPDATE release_versions SET is_portal_current=0 WHERE release_id=?').bind(old.release_id),
  db.prepare('UPDATE release_versions SET is_portal_current=1 WHERE id=?').bind(id),
  db.prepare('UPDATE releases SET current_version_id=?,updated_at=? WHERE id=?').bind(id,now,old.release_id),
  db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) VALUES(?,'operator',?,'release.corrected','release',?,?,?,?)`).bind(createUlid(),authority.actorId,old.release_id,now,now,now),
  db.prepare('DELETE FROM requester_write_guards WHERE id=?').bind(guard),
 ])}catch(error){if(String(error).includes('requester_write_admitted'))throw new MutationError(409,'Authority or the current release changed. Refresh before correcting it.');throw error}
 return {id:old.release_id,versionId:id,versionNumber:old.version_number+1}
}
export async function requestReleaseDelivery(db:D1Database,slug:string,versionId:string,authority:Authority){
 const version=await db.prepare(`SELECT v.id FROM release_versions v JOIN releases r ON r.id=v.release_id WHERE r.slug=? AND r.state='published' AND v.id=? AND v.snapshot_sealed_at IS NOT NULL`).bind(slug,versionId).first()
 if(!version)throw new MutationError(404,'Published version not found.')
 const guard=createUlid(),now=new Date().toISOString()
 try{await db.batch([
  publicationGuard(db,guard,authority.sql,authority.values),
  db.prepare(`INSERT INTO notification_outbox(id,event_type,subject_id,event_version,requester_id,dedupe_key,payload_json,delivery_state,available_at,address_id,release_snapshot_id,created_at,updated_at)
   SELECT 'release:'||v.id||':'||s.requester_id,'release_version',v.id,v.version_number,s.requester_id,'release:'||v.id||':'||s.requester_id,'{}','queued',?,s.requester_address_id,s.id,?,?
   FROM release_versions v JOIN release_recipient_snapshots s ON s.release_version_id=COALESCE(v.original_publication_version_id,v.id) WHERE v.id=? AND v.delivery_requested_at IS NULL`).bind(now,now,now,versionId),
  db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) SELECT ?,'operator',?,'release.delivery_requested','release_version',id,?,?,? FROM release_versions WHERE id=? AND delivery_requested_at IS NULL`).bind(createUlid(),authority.actorId,now,now,now,versionId),
  db.prepare('UPDATE release_versions SET delivery_requested_at=? WHERE id=? AND delivery_requested_at IS NULL').bind(now,versionId),
  db.prepare('DELETE FROM requester_write_guards WHERE id=?').bind(guard),
 ])}catch(error){if(String(error).includes('requester_write_admitted'))throw new NativeError('operator_session_required',401);throw error}
 return {versionId,deliveryCounts:await releaseDeliveryCounts(db,versionId)}
}
export async function releaseVersions(db:D1Database,slug:string):Promise<ReleaseVersion[]>{
 if(!await db.prepare('SELECT id FROM releases WHERE slug=?').bind(slug).first())throw new MutationError(404,'Release not found.')
 const rows=await db.prepare(`SELECT v.id,v.version_number AS versionNumber,v.title,v.body,v.setup_url AS setupUrl,v.outcome_prompt AS outcomePrompt,v.is_portal_current AS isCurrent,v.delivery_requested_at AS deliveryRequestedAt,v.created_at AS createdAt FROM releases r JOIN release_versions v ON v.release_id=r.id WHERE r.slug=? ORDER BY v.version_number DESC`).bind(slug).all<Omit<ReleaseVersion,'deliveryCounts'|'isCurrent'>&{isCurrent:number}>()
 return Promise.all(rows.results.map(async row=>({...row,isCurrent:Boolean(row.isCurrent),deliveryCounts:await releaseDeliveryCounts(db,row.id)})))
}
