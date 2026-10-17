import { createDatabaseConnection } from '@/core/platform/database'
import { importAccountsSample } from '@/core/features/accounts/service'
import { importCatalogSample } from '@/core/features/catalog/service'
import { importEvidenceSample } from '@/core/features/evidence/service'
import { importDecisionsSample } from '@/core/features/decisions/service'
import { importRoadmapSample } from '@/core/features/roadmap/service'
import { importReleasesSample } from '@/core/features/releases/service'
import { pennySampleSchema,type PennySample } from '@/core/features/sample-data/schema'

type Cell=string|number|null
/** Only the sample-owned pre-0009 columns are written. Today's request ORM also
 * declares direct statuses/ETA, which must not exist until their migration. */
async function previousRequests(db:D1Database,requests:PennySample['requests'],now:string){
 const write=async(table:string,rows:Record<string,Cell>[])=>{
  if(!rows.length)return
  await db.batch(rows.map(row=>{const columns=Object.keys(row);return db.prepare(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`).bind(...Object.values(row))}))
 }
 await write('requests',requests.map(r=>({id:r.id,slug:r.slug,board_id:r.boardId,author_requester_id:r.authorRequesterId,title:r.title,description:r.description,
  proposed_solution:r.proposedSolution,impact_statement:r.impactStatement,moderation_state:r.moderationState,public_state:r.publicState,
  public_title:r.publicTitle,public_description:r.publicDescription,published_at:r.publishedAt,declined_reason:r.declinedReason,withdrawn_at:r.withdrawnAt,created_at:now,updated_at:now})))
 const evidence=requests.flatMap(r=>r.evidenceIds.map(id=>({request_id:r.id,evidence_id:id,created_at:now})))
 const votes=requests.flatMap(r=>r.voterIds.map(id=>({request_id:r.id,requester_id:id,created_at:now,updated_at:now})))
 const follows=requests.flatMap(r=>r.followerIds.map(id=>({request_id:r.id,requester_id:id,permission_granted_at:now,muted_at:null,created_at:now,updated_at:now})))
 for(const table of ['request_evidence_links','request_evidence_contributions'])await write(table,evidence)
 await write('request_tag_assignments',requests.flatMap(r=>r.tagIds.map(id=>({request_id:r.id,tag_id:id,created_at:now}))))
 for(const table of ['request_votes','request_vote_contributions'])await write(table,votes)
 for(const table of ['request_follows','request_follow_contributions'])await write(table,follows)
 const comments=requests.flatMap(r=>r.comments.map(c=>({id:c.id,request_id:r.id,requester_id:c.requesterId,operator_id:c.operatorId,body:c.body,moderation_state:c.moderationState,published_at:c.publishedAt,created_at:now,updated_at:now})))
 await write('request_comments',comments)
 if(comments.length)await db.batch(comments.filter(c=>c.moderation_state==='approved').map(c=>db.prepare(`UPDATE request_comments SET
  public_author_display_name=CASE WHEN requester_id IS NOT NULL THEN (SELECT display_name FROM requesters WHERE id=requester_id) ELSE (SELECT display_name FROM operators WHERE id=operator_id) END,
  public_author_kind=CASE WHEN requester_id IS NULL THEN 'operator' ELSE 'requester' END WHERE id=?`).bind(c.id)))
}

export async function populatePreviousPennySample(db:D1Database,payload:unknown,now=new Date().toISOString()){
 const sample=pennySampleSchema.parse(payload),database=createDatabaseConnection(db)
 // These writers' sample fields are unchanged at this boundary. The historical
 // request graph above is independent of today's request routes and ORM defaults.
 await importAccountsSample(database,sample,now)
 await importCatalogSample(database,sample,now)
 await importEvidenceSample(database,sample.evidence,now)
 await previousRequests(db,sample.requests,now)
 await importDecisionsSample(database,sample.decisions,now)
 await importRoadmapSample(database,sample.roadmapItems,sample.roadmapPublications,sample.roadmapRequestMappings,now)
 await importReleasesSample(database,sample.releases,sample.roadmapItems,now)
}
