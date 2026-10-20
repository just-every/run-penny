import { loopHealthRead } from './loop-health-read'
import type { DatabaseConnection } from '@/core/platform/database'
import { DecisionsReadRepository } from '@/core/features/decisions/read-repository'
import { EvidenceReadRepository } from '@/core/features/evidence/read-repository'
import { ReleasesReadRepository } from '@/core/features/releases/read-repository'
import { RoadmapReadRepository } from '@/core/features/roadmap/read-repository'
import { currentModerationRequest } from '@/core/features/requests/moderation-claim'
import { validRoadmapUpdateDraft } from '@/core/features/roadmap/update-policy'
import { listIds } from './list-repository'
import { listPredicate } from './list-repository'
import { PAGE_SIZE, type ListQuery } from './list-query'
import type { WorkspaceOverviewDto } from './overview-dto'
export async function overviewRead(database:DatabaseConnection, query:ListQuery,today:string):Promise<WorkspaceOverviewDto> {
 const decisionPredicate=listPredicate('decisions',query)
 const [decisions,evidence,roadmap,releases,shipped,moderation,boards,heldComments,decisionStates,loopHealth]=await Promise.all([
 listIds(database,'decisions',query,"x.state IN ('ready','review_due')"),
 listIds(database,'evidence',query,"x.review_state='unreviewed'"),
 listIds(database,'roadmap',query,"x.status IN ('planned','in_progress')"),
 listIds(database,'releases',query,`x.state='published' AND x.published_at IS NOT NULL AND x.published_at >= '${new Date(Date.now()-30*86400000).toISOString()}'`),
 listIds(database,'roadmap',query,"x.status='shipped' AND NOT EXISTS(SELECT 1 FROM release_targets t JOIN releases r ON r.id=t.release_id WHERE t.roadmap_item_id=x.id AND r.state='published' AND r.published_at IS NOT NULL)"),
 listIds(database,'requests',query,`x.moderation_state='awaiting_review' AND ${currentModerationRequest('x')}`),
 database.binding.prepare('SELECT COUNT(*) AS count FROM boards WHERE archived_at IS NULL').first<{count:number}>(),
 // Requester comments wait in Moderation's request controls; count them here so they are not missed.
 database.binding.prepare(`SELECT COUNT(*) AS count FROM request_comments c JOIN requests x ON x.id=c.request_id WHERE c.moderation_state='awaiting_review' AND ${currentModerationRequest('x')}`).first<{count:number}>(),
 database.binding.prepare(`SELECT SUM(CASE WHEN x.state='ready' THEN 1 ELSE 0 END) AS ready, SUM(CASE WHEN x.state='review_due' THEN 1 ELSE 0 END) AS reviewDue FROM decisions x${decisionPredicate.sql}`).bind(...decisionPredicate.values).first<{ready:number|null;reviewDue:number|null}>(),
 loopHealthRead(database.binding,today),
 ])
 const updatePredicate=listPredicate('roadmap',{tag:query.tag,item:query.item}),updateWhere=updatePredicate.sql.replaceAll('x.id','i.id'),updateValues=[...updatePredicate.values]
 const updateQ=query.q?" AND instr(lower(v.title || ' ' || v.body),lower(?)) > 0":'';if(query.q)updateValues.push(query.q)
 const updateFrom=`FROM roadmap_update_versions v JOIN roadmap_items i ON i.id=v.roadmap_item_id JOIN roadmap_publications p ON p.roadmap_item_id=i.id WHERE v.published_at IS NULL AND v.discarded_at IS NULL AND ${validRoadmapUpdateDraft}${updateWhere.replace(/^ WHERE /,' AND ')}${updateQ}`
 const [decisionRows,evidenceRows,roadmapRows,releaseRows,shippedRows,moderationRows,updates,updateCount]=await Promise.all([
 new DecisionsReadRepository(database).list(decisions.ids),new EvidenceReadRepository(database).list(undefined,undefined,evidence.ids),new RoadmapReadRepository(database).list(roadmap.ids),new ReleasesReadRepository(database).list(releases.ids),new RoadmapReadRepository(database).list(shipped.ids),
 database.binding.prepare(`SELECT id,slug,title FROM requests WHERE id IN (${moderation.ids.length?moderation.ids.map(()=>'?').join(','):'NULL'}) ORDER BY id LIMIT ?`).bind(...moderation.ids,PAGE_SIZE).all<WorkspaceOverviewDto['awaitingModeration'][number]>(),
 database.binding.prepare(`SELECT v.id,v.title,i.slug AS roadmapSlug,v.version_number AS versionNumber ${updateFrom} ORDER BY ${query.sort==='name'?'v.title COLLATE NOCASE':query.sort==='recent'?'v.updated_at DESC':'v.created_at ASC'},v.id LIMIT ? OFFSET ?`).bind(...updateValues,PAGE_SIZE,((query.page??1)-1)*PAGE_SIZE).all<WorkspaceOverviewDto['unpublishedStatusUpdates'][number]>(),
 database.binding.prepare(`SELECT COUNT(*) AS total ${updateFrom}`).bind(...updateValues).first<{total:number}>(),
 ])
 const order=<T extends {id:string}>(rows:readonly T[],ids:readonly string[])=>ids.flatMap(id=>{const row=rows.find(row=>row.id===id);return row?[row]:[]})
 return {loopHealth,boardCount:Number(boards?.count??0),decisions:order(decisionRows,decisions.ids),unreviewedEvidence:order(evidenceRows,evidence.ids),roadmap:order(roadmapRows,roadmap.ids),recentReleases:order(releaseRows,releases.ids),shippedWithoutRelease:order(shippedRows,shipped.ids),awaitingModeration:order(moderationRows.results,moderation.ids),unpublishedStatusUpdates:updates.results,pagination:{page:query.page??1,pageSize:PAGE_SIZE,total:Math.max(decisions.total,evidence.total,roadmap.total,releases.total,shipped.total,moderation.total,Number(updateCount?.total??0))},counts:{decisions:decisions.total,readyDecisions:Number(decisionStates?.ready??0),reviewDueDecisions:Number(decisionStates?.reviewDue??0),evidence:evidence.total,roadmap:roadmap.total,releases:releases.total,shipped:shipped.total,moderation:moderation.total,comments:Number(heldComments?.count??0),updates:Number(updateCount?.total??0)}}
}
