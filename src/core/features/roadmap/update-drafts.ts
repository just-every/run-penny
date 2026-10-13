/** The transition owner appends these statements to its single atomic move batch.
 * Call after the transition INSERT; retain approval records for Dropped. No reads,
 * batches, or external effects run here. Approved wording is selected in SQL. */
export interface RoadmapUpdateTransition {
 itemId:string; itemByBet?:boolean; transitionId:string; actorId:string; now:string
 publicStatus:'under_review'|'planned'|'in_progress'|'shipped'|'withdrawn'
}
export function prepareRoadmapUpdateDraft(db:D1Database,input:RoadmapUpdateTransition):D1PreparedStatement[]{
 const label={under_review:'Under review',planned:'Planned',in_progress:'In progress',shipped:'Shipped',withdrawn:'Withdrawn'}[input.publicStatus]
 return [
  db.prepare(`INSERT INTO roadmap_update_versions
   (id,transition_id,roadmap_item_id,author_operator_id,version_number,public_status,title,problem,body,public_slug,approval_id,approval_at,approval_updated_at,created_at,updated_at)
   SELECT t.id,t.id,t.roadmap_item_id,?,(SELECT COALESCE(MAX(version_number),0)+1 FROM roadmap_update_versions WHERE roadmap_item_id=t.roadmap_item_id),
    ?,p.public_title,p.public_summary,p.public_title||': '||?||char(10)||char(10)||p.public_summary,p.public_slug,p.id,p.approved_at,p.updated_at,?,?
   FROM roadmap_transitions t JOIN roadmap_publications p ON p.roadmap_item_id=t.roadmap_item_id
   WHERE t.id=? AND t.roadmap_item_id=${input.itemByBet?'(SELECT id FROM roadmap_items WHERE candidate_bet_id=?)':'?'} AND p.approved_at IS NOT NULL AND p.withdrawn_at IS NULL
    AND NOT EXISTS(SELECT 1 FROM roadmap_update_versions WHERE transition_id=t.id)`)
   .bind(input.actorId,input.publicStatus,label,input.now,input.now,input.transitionId,input.itemId),
  db.prepare(`INSERT INTO roadmap_update_targets(version_id,request_id,approval_at,approval_updated_at,created_at,updated_at)
   SELECT v.id,m.request_id,m.approved_at,m.updated_at,?,?
   FROM roadmap_update_versions v JOIN roadmap_request_mappings m ON m.roadmap_item_id=v.roadmap_item_id
   WHERE v.transition_id=? AND changes()=1 AND m.approved_at IS NOT NULL AND m.withdrawn_at IS NULL
    AND NOT EXISTS(SELECT 1 FROM roadmap_update_targets existing WHERE existing.version_id=v.id AND existing.request_id=m.request_id)`)
   .bind(input.now,input.now,input.transitionId),
 ]
}
