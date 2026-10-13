import type { DatabaseConnection } from '@/core/platform/database'
import { validRoadmapUpdateDraft } from '@/core/features/roadmap/update-policy'
import { PAGE_SIZE, ListQueryError, type ListQuery } from './list-query'
import { tagRelation } from './tag-relations'
export interface StatusDraft {id:string;title:string;body:string;publishedAt:string|null;publicationState:'published'|'discarded'|'ready'|'stale'}
export async function pagedUpdates(database:DatabaseConnection,query:ListQuery) {
 const clauses:string[]=[],values:(string|number)[]=[]
 if(query.q){clauses.push("instr(lower(v.title || ' ' || v.body),lower(?)) > 0");values.push(query.q)}
 if(query.tag){clauses.push(`EXISTS(SELECT 1 FROM tags t WHERE t.id IN (${tagRelation('roadmap').replaceAll('x.id','v.roadmap_item_id')}) AND (t.id=? OR t.name=?))`);values.push(query.tag,query.tag)}
 if(query.status==='pending')clauses.push('v.published_at IS NULL AND v.discarded_at IS NULL')
 else if(query.status)throw new ListQueryError('Invalid status update filter')
 if(query.sort==='votes'||query.moderation||query.board||query.decision||query.account)throw new ListQueryError('Unsupported status update filter')
 const where=clauses.length?` WHERE ${clauses.join(' AND ')}`:'',page=query.page??1,order=query.sort==='name'?'v.title COLLATE NOCASE':query.sort==='age'?'v.created_at ASC':'v.updated_at DESC'
 const [count,rows]=await Promise.all([
 database.binding.prepare(`SELECT COUNT(*) AS total FROM roadmap_update_versions v${where}`).bind(...values).first<{total:number}>(),
 database.binding.prepare(`SELECT v.id,v.title,v.body,v.published_at AS publishedAt,CASE WHEN v.published_at IS NOT NULL THEN 'published' WHEN v.discarded_at IS NOT NULL THEN 'discarded' WHEN ${validRoadmapUpdateDraft} THEN 'ready' ELSE 'stale' END AS publicationState FROM roadmap_update_versions v${where} ORDER BY ${order},v.id ASC LIMIT ? OFFSET ?`).bind(...values,PAGE_SIZE,(page-1)*PAGE_SIZE).all<StatusDraft>(),
 ])
 return {items:rows.results,total:Number(count?.total??0),page,pageSize:PAGE_SIZE}
}
