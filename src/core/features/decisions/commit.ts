import { observedTimeOrderSql } from '../evidence/observed-time'
import { MutationError } from '@/core/app/operator-mutations'
import { createUlid } from '@/core/shared/ulid'
import { prepareRoadmapUpdateDraft } from '../roadmap/update-drafts'
import { revisionRoadmapStatements } from './revision-roadmap'
import { audit,exists,snapshotUlidSql,validDate } from './write-support'

export interface CommitInput{selectedCandidateBetId?:string|null;rationale?:string|null;ownerOperatorId?:string|null;confidence?:'low'|'medium'|'high'|null;reviewAt?:string|null;noViableAlternativeReason?:string|null}
export interface RevisionCommand {expectedRevision:number;note?:string}
export async function commitDecision(db:D1Database,id:string,input:CommitInput,actor:string,now:string,revision?:RevisionCommand){
 const decision=await db.prepare('SELECT state,question FROM decisions WHERE id=?').bind(id).first<{state:string;question:string}>()
 if(!decision)throw new MutationError(404,'Decision not found.')
 if(revision&&!['committed','review_due'].includes(decision.state))throw new MutationError(409,'Only committed decisions can be revised.')
 if(!revision&&!['draft','ready'].includes(decision.state))return existingCommit(db,id,input)
 const bets=await db.prepare('SELECT id FROM candidate_bets WHERE decision_id=?').bind(id).all<{id:string}>()
 const missing=[]
 if(!input.selectedCandidateBetId?.trim())missing.push('Selected bet')
 if(!input.rationale?.trim())missing.push('Rationale')
 if(!input.ownerOperatorId?.trim())missing.push('Owner')
 if(!input.confidence)missing.push('Confidence')
 if(!input.reviewAt?.trim())missing.push('Review date')
 if(bets.results.length<2&&!input.noViableAlternativeReason?.trim())missing.push('No viable alternative reason')
 if(!decision.question.trim())missing.push('Question')
 if(!await db.prepare('SELECT 1 FROM candidate_bets b JOIN candidate_bet_evidence_links l ON l.candidate_bet_id=b.id WHERE b.decision_id=?').bind(id).first())missing.push('Linked evidence')
 if(missing.length)throw new MutationError(422,`Required: ${missing.join(', ')}.`)
 if(!validDate(input.reviewAt))throw new MutationError(422,'Review date must be a valid calendar date or a timestamp with a timezone offset.')
 await exists(db,'operators',input.ownerOperatorId)
 if(!bets.results.some(b=>b.id===input.selectedCandidateBetId))throw new MutationError(422,'Selected bet must belong to this decision.')
 const revisionId=createUlid(),proposedItemId=createUlid(),transitionId=createUlid()
 const selected=input.selectedCandidateBetId!,revisionNumber=revision?revision.expectedRevision+1:1
 const prior=revision?await db.prepare('SELECT selected_candidate_bet_id AS selected FROM decisions WHERE id=?').bind(id).first<{selected:string}>():null
 const changesBet=!revision||prior?.selected!==selected
 // Resolve the item inside the transaction: a concurrent item editor cannot
 // cause a second item, stale title copy, or transition with a false prior state.
 const itemLookup='SELECT id FROM roadmap_items WHERE candidate_bet_id=?'
 const statements=[
  db.prepare(`INSERT INTO decision_revisions(id,decision_id,revision_number,selected_candidate_bet_id,rationale,confidence,review_at,no_viable_alternative_reason,committed_by_operator_id,owner_operator_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).bind(revisionId,id,revisionNumber,selected,input.rationale!,input.confidence!,input.reviewAt!,input.noViableAlternativeReason??null,actor,input.ownerOperatorId!,now,now),
  db.prepare(`INSERT INTO decision_evidence_snapshots(id,decision_revision_id,evidence_id,evidence_version_id,candidate_bet_id,stance,created_at,updated_at)
   SELECT ${snapshotUlidSql(now)},?,e.id,(SELECT v.id FROM evidence_versions v WHERE v.evidence_id=e.id ORDER BY version_number DESC LIMIT 1),b.id,l.stance,?,?
   FROM candidate_bets b JOIN candidate_bet_evidence_links l ON l.candidate_bet_id=b.id JOIN evidence_items e ON e.id=l.evidence_id WHERE b.decision_id=?`).bind(revisionId,now,now,id),
  db.prepare(`INSERT INTO decision_bet_snapshots(id,decision_revision_id,candidate_bet_id,disposition,title,summary,urgency,delivery_shape,success_measure,affected_requester_count,affected_account_count,supporting_count,latest_support_at,contradicting_count,created_at,updated_at)
   SELECT ${snapshotUlidSql(now)},?,b.id,CASE WHEN b.id=? THEN 'selected' ELSE 'declined' END,b.title,b.summary,b.urgency,b.delivery_shape,b.success_measure,
   COUNT(DISTINCT e.requester_id),(SELECT COUNT(*) FROM (SELECT ae.account_id FROM evidence_items ae JOIN candidate_bet_evidence_links al ON al.evidence_id=ae.id WHERE al.candidate_bet_id=b.id AND ae.account_id IS NOT NULL UNION SELECT account_id FROM candidate_bet_account_links WHERE candidate_bet_id=b.id)),COALESCE(SUM(l.stance='supporting'),0),
   (SELECT latest.observed_at FROM evidence_items latest JOIN candidate_bet_evidence_links ll ON ll.evidence_id=latest.id WHERE ll.candidate_bet_id=b.id AND ll.stance='supporting' ORDER BY ${observedTimeOrderSql('latest.observed_at')},latest.id LIMIT 1),
   COALESCE(SUM(l.stance='contradicting'),0),?,?
   FROM candidate_bets b LEFT JOIN candidate_bet_evidence_links l ON l.candidate_bet_id=b.id LEFT JOIN evidence_items e ON e.id=l.evidence_id WHERE b.decision_id=? GROUP BY b.id`).bind(revisionId,selected,now,now,id),
  ...(revision&&changesBet?revisionRoadmapStatements(db,id,selected,prior!.selected,revisionId,actor,now):[]),
  ...(changesBet?[db.prepare(`INSERT INTO roadmap_items(id,slug,decision_id,candidate_bet_id,title,summary,owner_operator_id,status,confidence,created_at,updated_at)
   SELECT ?,?,b.decision_id,b.id,b.title,b.summary,?,'planned',?,?,? FROM candidate_bets b WHERE b.id=? AND NOT EXISTS(SELECT 1 FROM roadmap_items WHERE candidate_bet_id=b.id)`).bind(proposedItemId,`roadmap-${proposedItemId.toLowerCase()}`,input.ownerOperatorId!,input.confidence!,now,now,selected),
  db.prepare(`INSERT INTO roadmap_transitions(id,roadmap_item_id,from_status,to_status,reason,actor_operator_id,action_key,created_at,updated_at)
   SELECT ?,id,status,'planned',?,?,?, ?,? FROM roadmap_items WHERE candidate_bet_id=? AND status!='planned'`).bind(transitionId,input.rationale!,actor,`commit:${revisionId}`,now,now,selected),
  // The seam needs the actual item identity, selected by this statement's SQL.
  ...prepareCommitDraft(db,selected,transitionId,actor,now),
  db.prepare(`UPDATE roadmap_items SET decision_id=?,status='planned',owner_operator_id=?,confidence=?,updated_at=? WHERE id=(${itemLookup})`).bind(id,input.ownerOperatorId!,input.confidence!,now,selected)]:[]),
  db.prepare(`UPDATE decisions SET state=CASE WHEN ?=1 AND review_at=? THEN state ELSE 'committed' END,selected_candidate_bet_id=?,rationale=?,owner_operator_id=?,confidence=?,review_at=?,review_generation=review_generation+CASE WHEN review_at IS NOT ? THEN 1 ELSE 0 END,
   review_completed_at=CASE WHEN review_at IS NOT ? THEN NULL WHEN ?=1 THEN ? ELSE review_completed_at END,updated_at=? WHERE id=?`).bind(revision&&!revision.note?1:0,input.reviewAt!,selected,input.rationale!,input.ownerOperatorId!,input.confidence!,input.reviewAt!,input.reviewAt!,input.reviewAt!,revision?.note?1:0,now,now,id),
  db.prepare('UPDATE decision_revisions SET roadmap_item_id=(SELECT id FROM roadmap_items WHERE candidate_bet_id=?) WHERE id=?').bind(selected,revisionId),
  ...(revision?.note?[db.prepare('INSERT INTO decision_reviews(id,decision_id,operator_id,note,review_at,decision_revision_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(createUlid(),id,actor,revision.note,input.reviewAt!,revisionId,now,now)]:[]),
  audit(db,actor,'decision',id,revision?'decision.revised':'decision.committed',now,{revisionId}),
 ]
 try{await db.batch(statements)}catch(error){
  const message=String(error)
  if(revision&&/decision revision|UNIQUE constraint failed: decision_revisions/.test(message))throw new MutationError(409,'Decision changed. Refresh its revision history before revising.')
  if(message.includes('UNIQUE constraint failed: decision_revisions'))return existingCommit(db,id,input)
  if(message.includes('Multiple historical roadmap items'))throw new MutationError(409,'This bet has multiple historical roadmap items. Keep one association on the roadmap before committing.')
  if(/required|mismatch|already committed/.test(message))throw new MutationError(409,'Decision changed during commitment. Refresh the brief and check its required fields.')
  throw error
 }
 return existingCommit(db,id,input,revisionNumber)
}
function prepareCommitDraft(db:D1Database,betId:string,transitionId:string,actorId:string,now:string){
 // Identical draft SQL to ordinary moves; the generated transition is the only
 // source of item identity. No pre-transaction publication read is authoritative.
 return prepareRoadmapUpdateDraft(db,{itemId:betId,transitionId,actorId,now,publicStatus:'planned',itemByBet:true})
}
async function existingCommit(db:D1Database,id:string,input:CommitInput,number=1){
 const revision=await db.prepare('SELECT id,selected_candidate_bet_id AS selected,rationale,confidence,review_at AS reviewAt,no_viable_alternative_reason AS alternative,owner_operator_id AS owner,roadmap_item_id AS itemId FROM decision_revisions WHERE decision_id=? AND revision_number=?').bind(id,number).first<{id:string;selected:string;rationale:string;confidence:string;reviewAt:string;alternative:string|null;owner:string|null;itemId:string|null}>()
 if(!revision||revision.selected!==input.selectedCandidateBetId||revision.rationale!==input.rationale||revision.confidence!==input.confidence||revision.reviewAt!==input.reviewAt||revision.owner!==input.ownerOperatorId||revision.alternative!==(input.noViableAlternativeReason??null))throw new MutationError(409,'Decision already committed with different fields.')
 const item=await db.prepare('SELECT id AS itemId,slug FROM roadmap_items WHERE id=?').bind(revision.itemId).first<{itemId:string;slug:string}>()
 return {revisionId:revision.id,...item}
}
