import { createUlid } from '@/core/shared/ulid'
import { prepareRoadmapUpdateDraft } from '../roadmap/update-drafts'

/** Appended to the revision transaction before selecting the replacement bet. */
export function revisionRoadmapStatements(db:D1Database,decisionId:string,selected:string,previousBet:string,revisionId:string,actor:string,now:string):D1PreparedStatement[]{
 const transition=createUlid()
 const previous=`SELECT selected_candidate_bet_id FROM decisions WHERE id=? AND selected_candidate_bet_id!=?`
 return [
  db.prepare(`INSERT INTO roadmap_transitions(id,roadmap_item_id,from_status,to_status,reason,actor_operator_id,action_key,created_at,updated_at)
   SELECT ?,id,status,'exploring','Superseded decision commitment',?,CASE WHEN status='exploring' THEN NULL ELSE ? END,?,? FROM roadmap_items WHERE candidate_bet_id=(${previous})`)
   .bind(transition,actor,`revision:${revisionId}`,now,now,decisionId,selected),
  // Capture the previously approved wording before withdrawing it.
  ...prepareRoadmapUpdateDraft(db,{itemId:previousBet,itemByBet:true,transitionId:transition,actorId:actor,now,publicStatus:'under_review'}),
  db.prepare(`UPDATE roadmap_publications SET withdrawn_at=?,updated_at=? WHERE roadmap_item_id IN(SELECT id FROM roadmap_items WHERE candidate_bet_id=(${previous})) AND approved_at IS NOT NULL AND withdrawn_at IS NULL`).bind(now,now,decisionId,selected),
  db.prepare(`UPDATE roadmap_request_mappings SET withdrawn_at=?,updated_at=? WHERE roadmap_item_id IN(SELECT id FROM roadmap_items WHERE candidate_bet_id=(${previous})) AND approved_at IS NOT NULL AND withdrawn_at IS NULL`).bind(now,now,decisionId,selected),
  db.prepare(`UPDATE roadmap_items SET status='exploring',updated_at=? WHERE candidate_bet_id=(${previous})`).bind(now,decisionId,selected),
 ]
}
