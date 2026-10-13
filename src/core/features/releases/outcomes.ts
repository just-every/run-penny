import { z } from 'zod'
import { MutationError } from '@/core/app/operator-mutations'
import type { DatabaseConnection } from '@/core/platform/database'
import type { RequesterIdentity } from '../auth/requester'
import { requesterWrite } from '../requests/write-admission'
import { createUlid } from '@/core/shared/ulid'
export const outcomeSchema=z.object({targetId:z.string().min(1),outcome:z.enum(['adopted','partly_adopted','not_yet'])}).strict()
export type OutcomeInput=z.infer<typeof outcomeSchema>
export interface RequesterReleaseOutcomes {prompt:string;targets:{targetId:string;title:string;outcome:OutcomeInput['outcome']|null;revisionNumber:number|null}[]}
export interface OutcomeCounts {adopted:number;partlyAdopted:number;notYet:number;responses:number;snapshotRecipients:number;coverage:number}
export interface ReleaseOutcomeReport {publicationVersionId:string;whole:OutcomeCounts;targets:(OutcomeCounts&{targetId:string;roadmapSlug:string;roadmapTitle:string;decisionId:string;decisionSlug:string})[];responses:{id:string;requesterId:string;displayName:string;targetId:string;outcome:OutcomeInput['outcome'];revisionNumber:number;updatedAt:string;snapshotId:string;contexts:{requestId:string|null;requestSlug:string|null;evidenceId:string|null;roadmapId:string;roadmapSlug:string;decisionId:string;decisionSlug:string}[]}[]}
async function publication(db:D1Database,slug:string){
 const row=await db.prepare(`SELECT COALESCE(v.original_publication_version_id,v.id) AS id,v.outcome_prompt AS prompt FROM releases r JOIN release_versions v ON v.id=r.current_version_id WHERE r.slug=? AND r.state='published' AND v.snapshot_sealed_at IS NOT NULL`).bind(slug).first<{id:string;prompt:string}>()
 if(!row)throw new MutationError(404,'Published release not found.')
 return row
}
// Publication fixes the release-level targets through the draft/publish boundary.
// Per-request target snapshots are personal context: erasure may remove every
// one without removing the independently approved roadmap/decision target.
const publicationTargets=`SELECT v.id AS version_id,t.roadmap_item_id,t.decision_id,t.public_title
 FROM release_versions v JOIN release_targets t ON t.release_id=v.release_id WHERE v.snapshot_sealed_at IS NOT NULL`
const identities=`WITH RECURSIVE lineage(origin_id,requester_id) AS (
 SELECT id,id FROM requesters UNION SELECT lineage.origin_id,m.target_requester_id
 FROM requester_identity_merges m JOIN lineage ON m.source_requester_id=lineage.requester_id
), requester_roots AS (SELECT origin_id,requester_id FROM lineage WHERE NOT EXISTS(
 SELECT 1 FROM requester_identity_merges m WHERE m.source_requester_id=lineage.requester_id))`
const latest=`NOT EXISTS(SELECT 1 FROM release_outcomes newer JOIN requester_roots root ON root.origin_id=newer.requester_id
 WHERE newer.release_version_id=o.release_version_id AND newer.roadmap_item_id=o.roadmap_item_id
 AND root.requester_id=(SELECT requester_id FROM requester_roots WHERE origin_id=o.requester_id)
 AND (newer.updated_at>o.updated_at OR (newer.updated_at=o.updated_at AND
 (newer.revision_number>o.revision_number OR (newer.revision_number=o.revision_number AND newer.id>o.id)))))`
function recipientQuery(versionId:string,identity:RequesterIdentity,targetId:string|null){
 // Merges combine current answers without rewriting either publication history.
 // The most recently changed answer wins, and later revisions retain its original
 // recipient key/context. An unanswered target starts at the first snapshot.
 return {sql:`${identities} SELECT s.id,s.requester_id AS requesterId FROM release_recipient_snapshots s
 JOIN requester_roots root ON root.origin_id=s.requester_id
 LEFT JOIN release_outcomes o ON o.release_version_id=s.release_version_id AND o.requester_id=s.requester_id
  AND o.roadmap_item_id=? AND ${latest}
 WHERE s.release_version_id=? AND root.requester_id=? ORDER BY (o.id IS NOT NULL) DESC,s.created_at,s.id LIMIT 1`,
 values:[targetId,versionId,identity.requesterId]}
}
async function publicationRecipient(db:D1Database,versionId:string,identity:RequesterIdentity,targetId:string|null=null){
 const query=recipientQuery(versionId,identity,targetId)
 const recipient=await db.prepare(query.sql).bind(...query.values).first<{id:string;requesterId:string}>()
 if(!recipient)throw new MutationError(404,'You were not a recipient of this release.')
 return recipient
}
export async function requesterOutcomes(db:D1Database,slug:string,identity:RequesterIdentity):Promise<RequesterReleaseOutcomes>{
 const version=await publication(db,slug)
 await publicationRecipient(db,version.id,identity)
 const targets=await db.prepare(`${identities} SELECT t.roadmap_item_id AS targetId,t.public_title AS title,o.outcome,o.revision_number AS revisionNumber
 FROM (${publicationTargets}) t
 LEFT JOIN release_outcomes o ON o.release_version_id=t.version_id AND o.roadmap_item_id=t.roadmap_item_id
 AND o.requester_id IN(SELECT origin_id FROM requester_roots WHERE requester_id=?) AND ${latest}
 WHERE t.version_id=? ORDER BY t.roadmap_item_id`).bind(identity.requesterId,version.id).all<RequesterReleaseOutcomes['targets'][number]>()
 return {prompt:version.prompt||'Have you adopted this update?',targets:targets.results}
}
export async function recordOutcome(database:DatabaseConnection,slug:string,identity:RequesterIdentity,input:OutcomeInput){
 const db=database.binding,version=await publication(db,slug),now=new Date().toISOString()
 const recipient=await publicationRecipient(db,version.id,identity,input.targetId),query=recipientQuery(version.id,identity,input.targetId)
 const scope={sql:`EXISTS(SELECT 1 FROM (${query.sql}) s JOIN (${publicationTargets}) t ON t.version_id=? WHERE s.id=? AND t.roadmap_item_id=?)`,values:[...query.values,version.id,recipient.id,input.targetId]}
 if(!await db.prepare(`SELECT 1 WHERE ${scope.sql}`).bind(...scope.values).first())throw new MutationError(404,'This release target is not in your publication snapshot.')
 await requesterWrite(database,identity,[db.prepare(`${identities} INSERT INTO release_outcomes(id,release_version_id,requester_id,roadmap_item_id,outcome,revision_number,created_at,updated_at)
 SELECT ?,?,?,?,?,COALESCE((SELECT MAX(revision_number) FROM release_outcomes WHERE release_version_id=? AND requester_id IN(SELECT origin_id FROM requester_roots WHERE requester_id=?) AND roadmap_item_id=?),0)+1,?,
 MAX(?,COALESCE((SELECT MAX(updated_at) FROM release_outcomes WHERE release_version_id=? AND requester_id IN(SELECT origin_id FROM requester_roots WHERE requester_id=?) AND roadmap_item_id=?),?))
 WHERE COALESCE((SELECT outcome FROM release_outcomes WHERE release_version_id=? AND requester_id=? AND roadmap_item_id=? ORDER BY revision_number DESC LIMIT 1),'')!=?`).bind(createUlid(),version.id,recipient.requesterId,input.targetId,input.outcome,version.id,identity.requesterId,input.targetId,now,now,version.id,identity.requesterId,input.targetId,now,version.id,recipient.requesterId,input.targetId,input.outcome)],scope)
 return requesterOutcomes(db,slug,identity)
}
export async function releaseOutcomeReport(db:D1Database,slug:string):Promise<ReleaseOutcomeReport>{
 const version=await publication(db,slug)
 const recipientCount=Number((await db.prepare('SELECT COUNT(*) AS n FROM release_recipient_snapshots WHERE release_version_id=?').bind(version.id).first<{n:number}>())!.n)
 const targets=(await db.prepare(`SELECT t.roadmap_item_id AS targetId,i.slug AS roadmapSlug,i.title AS roadmapTitle,t.decision_id AS decisionId,d.slug AS decisionSlug FROM (${publicationTargets}) t JOIN roadmap_items i ON i.id=t.roadmap_item_id JOIN decisions d ON d.id=t.decision_id WHERE t.version_id=? ORDER BY t.roadmap_item_id`).bind(version.id).all<Pick<ReleaseOutcomeReport['targets'][number],'targetId'|'roadmapSlug'|'roadmapTitle'|'decisionId'|'decisionSlug'>>()).results
 const raw=(await db.prepare(`${identities} SELECT o.id,o.requester_id AS requesterId,p.display_name AS displayName,o.roadmap_item_id AS targetId,o.outcome,o.revision_number AS revisionNumber,o.updated_at AS updatedAt,s.id AS snapshotId,s.evidence_id AS evidenceId
 FROM release_outcomes o JOIN release_recipient_snapshots s ON s.release_version_id=o.release_version_id AND s.requester_id=o.requester_id JOIN requesters p ON p.id=o.requester_id WHERE o.release_version_id=? AND ${latest} ORDER BY o.updated_at,o.id`).bind(version.id).all<Omit<ReleaseOutcomeReport['responses'][number],'contexts'>&{evidenceId:string|null}>()).results
 const responses=await Promise.all(raw.map(async({evidenceId,...row})=>{
  const target=targets.find(t=>t.targetId===row.targetId)!
  const contexts=(await db.prepare(`SELECT c.request_id AS requestId,c.slug AS requestSlug FROM release_recipient_contexts c WHERE c.snapshot_id=? AND c.roadmap_item_id=? ORDER BY c.request_id`).bind(row.snapshotId,row.targetId).all<{requestId:string;requestSlug:string}>()).results
  return {...row,contexts:(contexts.length?contexts:[{requestId:null,requestSlug:null}]).map(c=>({...c,evidenceId,roadmapId:target.targetId,roadmapSlug:target.roadmapSlug,decisionId:target.decisionId,decisionSlug:target.decisionSlug}))}
 }))
 const counts=(list:typeof raw):OutcomeCounts=>({adopted:list.filter(r=>r.outcome==='adopted').length,partlyAdopted:list.filter(r=>r.outcome==='partly_adopted').length,notYet:list.filter(r=>r.outcome==='not_yet').length,responses:list.length,snapshotRecipients:recipientCount,coverage:recipientCount?list.length/recipientCount:0})
 return {publicationVersionId:version.id,whole:counts(raw),targets:targets.map(t=>({...t,...counts(raw.filter(r=>r.targetId===t.targetId))})),responses}
}
