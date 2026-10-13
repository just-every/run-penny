import type { DatabaseConnection } from '@/core/platform/database'
import { AccountsReadRepository } from '@/core/features/accounts/read-repository'
import { DecisionsReadRepository } from '@/core/features/decisions/read-repository'
import { EvidenceReadRepository } from '@/core/features/evidence/read-repository'
import { ReleasesReadRepository } from '@/core/features/releases/read-repository'
import { RequestsReadRepository } from '@/core/features/requests/read-repository'
import { currentModerationRequest } from '@/core/features/requests/moderation-claim'
import { moderationAvailabilitySql, type ModerationAvailability } from '@/core/features/requests/operator-availability'
import { RoadmapReadRepository } from '@/core/features/roadmap/read-repository'
import { listIds } from './list-repository'
import type { ListEntity, ListQuery } from './list-query'
export interface OperatorRequesterCard {id:string;displayName:string;email:string|null}
export async function pagedList(database:DatabaseConnection,entity:ListEntity,query:ListQuery,extra?:string) {
 const {ids,...page}=await listIds(database,entity,query,extra)
 const rows = entity==='requests' ? await new RequestsReadRepository(database).list(ids)
 : entity==='evidence' ? await new EvidenceReadRepository(database).list(undefined,undefined,ids)
 : entity==='decisions' ? await new DecisionsReadRepository(database).list(ids)
 : entity==='roadmap' ? await new RoadmapReadRepository(database).list(ids)
 : entity==='releases' ? await new ReleasesReadRepository(database).list(ids)
 : entity==='accounts' ? await new AccountsReadRepository(database).list(ids)
 : (await database.binding.prepare(`SELECT id,display_name AS displayName,(SELECT email FROM requester_addresses a WHERE a.requester_id=p.id ORDER BY CASE WHEN verified_at IS NOT NULL AND suppressed_at IS NULL THEN 0 ELSE 1 END,created_at,id LIMIT 1) AS email FROM requesters p WHERE id IN (${ids.length?ids.map(()=>'?').join(','):'NULL'}) LIMIT 25`).bind(...ids).all<OperatorRequesterCard>()).results
 const items=ids.flatMap(id=>{const row=rows.find(row=>row.id===id);return row?[row]:[]})
 return {items,...page}
}
export async function pagedModeration(database:DatabaseConnection,query:ListQuery) {
 // Account continuations, explicit withdrawn status and focused items include history; ordinary
 // moderation uses the same eligibility predicate as overview and verdicts.
 const page=await pagedList(database,'requests',query,query.account||query.status==='withdrawn'||query.item?undefined:currentModerationRequest('x'))
 const details=await database.binding.prepare(`SELECT r.id,${moderationAvailabilitySql('r')} AS moderationAvailability,
 (SELECT reason FROM request_moderation_events e WHERE e.subject_type='request' AND e.subject_id=r.id ORDER BY e.rowid DESC LIMIT 1) AS reason
 FROM requests r WHERE r.id IN (${page.items.length?page.items.map(()=>'?').join(','):'NULL'}) LIMIT 25`).bind(...page.items.map(row=>row.id)).all<{id:string;reason:string|null;moderationAvailability:ModerationAvailability}>()
 return {...page,items:page.items.map(row=>{
 if(!('board' in row)||!('author' in row))throw new Error('Invalid request projection')
 const detail=details.results.find(detail=>detail.id===row.id)
 if(!detail)throw new Error('Missing moderation availability')
 return {...row,boardSlug:row.board.slug,displayName:row.author?.displayName??null,reason:detail.reason,moderationAvailability:detail.moderationAvailability}
 })}
}
