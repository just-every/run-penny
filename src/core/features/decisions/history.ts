import { MutationError } from '@/core/app/operator-mutations'
export interface DecisionBetSnapshot {candidateBetId:string;disposition:'selected'|'declined';title:string;summary:string;urgency:string|null;deliveryShape:string|null;successMeasure:string|null;affectedRequesterCount:number;affectedAccountCount:number;supportingCount:number;contradictingCount:number;latestSupportAt:string|null}
export interface DecisionEvidenceSnapshot {evidenceId:string;evidenceVersionId:string;candidateBetId:string;stance:'supporting'|'contradicting';wording:string;versionNumber:number}
export interface DecisionRevision {id:string;revisionNumber:number;selectedCandidateBetId:string;rationale:string;confidence:'low'|'medium'|'high';reviewAt:string;noViableAlternativeReason:string|null;ownerOperatorId:string|null;roadmapItemId:string|null;createdAt:string;bets:DecisionBetSnapshot[];evidence:DecisionEvidenceSnapshot[]}
export interface DecisionReview {id:string;note:string;reviewAt:string;decisionRevisionId:string|null;operatorId:string;createdAt:string}
export interface DecisionHistory {revisions:DecisionRevision[];reviews:DecisionReview[]}
interface ReleaseEvidenceBase {id:string;releaseId:string;releaseSlug:string;releaseTitle:string;createdAt:string}
export interface DecisionOutcomeEvidence extends ReleaseEvidenceBase {kind:'outcome';outcome:'adopted'|'partly_adopted'|'not_yet';revisionNumber:number;requesterId:string;roadmapItemId:string;roadmapSlug:string;requests:{requestId:string;requestSlug:string}[];evidenceId:string|null}
export interface DecisionLinkedEvidence extends ReleaseEvidenceBase {kind:'evidence';evidenceId:string;wording:string;observedAt:string}
export interface DecisionPostRelease {timeline:(DecisionOutcomeEvidence|DecisionLinkedEvidence)[]}
export async function decisionHistory(db:D1Database,id:string):Promise<DecisionHistory>{
 if(!await db.prepare('SELECT id FROM decisions WHERE id=?').bind(id).first())throw new MutationError(404,'Decision not found.')
 const revisions=await db.prepare(`SELECT id,revision_number AS revisionNumber,selected_candidate_bet_id AS selectedCandidateBetId,rationale,confidence,review_at AS reviewAt,no_viable_alternative_reason AS noViableAlternativeReason,owner_operator_id AS ownerOperatorId,roadmap_item_id AS roadmapItemId,created_at AS createdAt FROM decision_revisions WHERE decision_id=? ORDER BY revision_number DESC`).bind(id).all<Omit<DecisionRevision,'bets'|'evidence'>>()
 const enriched=await Promise.all(revisions.results.map(async revision=>{
  const [bets,evidence]=await Promise.all([
   db.prepare(`SELECT candidate_bet_id AS candidateBetId,disposition,title,summary,urgency,delivery_shape AS deliveryShape,success_measure AS successMeasure,affected_requester_count AS affectedRequesterCount,affected_account_count AS affectedAccountCount,supporting_count AS supportingCount,contradicting_count AS contradictingCount,latest_support_at AS latestSupportAt FROM decision_bet_snapshots WHERE decision_revision_id=? ORDER BY disposition DESC,candidate_bet_id`).bind(revision.id).all<DecisionBetSnapshot>(),
   db.prepare(`SELECT s.evidence_id AS evidenceId,s.evidence_version_id AS evidenceVersionId,s.candidate_bet_id AS candidateBetId,s.stance,v.wording,v.version_number AS versionNumber FROM decision_evidence_snapshots s JOIN evidence_versions v ON v.id=s.evidence_version_id WHERE s.decision_revision_id=? ORDER BY s.id`).bind(revision.id).all<DecisionEvidenceSnapshot>(),
  ])
  return {...revision,bets:bets.results,evidence:evidence.results}
 }))
 const reviews=await db.prepare(`SELECT id,note,review_at AS reviewAt,decision_revision_id AS decisionRevisionId,operator_id AS operatorId,created_at AS createdAt FROM decision_reviews WHERE decision_id=? ORDER BY created_at DESC,id DESC`).bind(id).all<DecisionReview>()
 return {revisions:enriched,reviews:reviews.results}
}
export async function decisionPostRelease(db:D1Database,id:string):Promise<DecisionPostRelease>{
 if(!await db.prepare('SELECT id FROM decisions WHERE id=?').bind(id).first())throw new MutationError(404,'Decision not found.')
 // Sealed publication targets retain the decision link independently of personal
 // request snapshots, which erasure may remove even while other recipients remain.
 const outcomes=await db.prepare(`SELECT 'outcome' AS kind,o.id,o.outcome,o.revision_number AS revisionNumber,o.requester_id AS requesterId,o.roadmap_item_id AS roadmapItemId,i.slug AS roadmapSlug,r.id AS releaseId,r.slug AS releaseSlug,v.title AS releaseTitle,o.created_at AS createdAt,
  (SELECT json_group_array(json_object('requestId',c.request_id,'requestSlug',c.slug)) FROM release_recipient_snapshots s JOIN release_recipient_contexts c ON c.snapshot_id=s.id WHERE s.release_version_id=o.release_version_id AND s.requester_id=o.requester_id AND c.roadmap_item_id=o.roadmap_item_id) AS requestsJson,
  (SELECT s.evidence_id FROM release_recipient_snapshots s WHERE s.release_version_id=o.release_version_id AND s.requester_id=o.requester_id) AS evidenceId
  FROM release_outcomes o JOIN release_versions v ON v.id=o.release_version_id JOIN releases r ON r.id=v.release_id
  JOIN release_versions current_version ON current_version.id=r.current_version_id AND COALESCE(current_version.original_publication_version_id,current_version.id)=v.id
  JOIN roadmap_items i ON i.id=o.roadmap_item_id
  WHERE r.state='published' AND current_version.snapshot_sealed_at IS NOT NULL AND v.snapshot_sealed_at IS NOT NULL
  AND EXISTS(SELECT 1 FROM release_targets t WHERE t.release_id=r.id AND t.roadmap_item_id=o.roadmap_item_id AND t.decision_id=?)`).bind(id).all<Omit<DecisionOutcomeEvidence,'requests'>&{requestsJson:string}>()
 const evidence=await db.prepare(`SELECT 'evidence' AS kind,e.id AS id,e.id AS evidenceId,(SELECT wording FROM evidence_versions ev WHERE ev.evidence_id=e.id ORDER BY version_number DESC LIMIT 1) AS wording,e.observed_at AS observedAt,e.created_at AS createdAt,r.id AS releaseId,r.slug AS releaseSlug,current_version.title AS releaseTitle
  FROM evidence_items e JOIN releases r ON r.id=e.release_id JOIN release_versions current_version ON current_version.id=r.current_version_id
  JOIN release_versions v ON v.id=COALESCE(current_version.original_publication_version_id,current_version.id) AND v.release_id=r.id
  WHERE r.state='published' AND current_version.snapshot_sealed_at IS NOT NULL AND v.snapshot_sealed_at IS NOT NULL
  AND EXISTS(SELECT 1 FROM release_targets t WHERE t.release_id=r.id AND t.decision_id=?)`).bind(id).all<DecisionLinkedEvidence>()
 return {timeline:[...outcomes.results.map(({requestsJson,...row})=>({...row,requests:JSON.parse(requestsJson)})),...evidence.results].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))||String(a.id).localeCompare(String(b.id)))}
}
