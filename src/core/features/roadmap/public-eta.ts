import { MutationError } from '@/core/app/operator-mutations'
import { createUlid } from '@/core/shared/ulid'
import { publicationGuard } from '../releases/publication-policy'
import { audit } from '../decisions/write-support'
import { prepareRoadmapUpdateDraft } from './update-drafts'

/** Approval, its change event and the follower draft commit together. An
 * unchanged approval creates no event, draft or notification. */
export async function approvePublicEta(db:D1Database,id:string,input:{publicEta:string|null;approvalId:string},actor:string,now:string){
 const guard=createUlid(),transitionId=createUlid()
 try{await db.batch([
  publicationGuard(db,guard,`EXISTS(SELECT 1 FROM roadmap_publications p JOIN roadmap_items i ON i.id=p.roadmap_item_id LEFT JOIN boards b ON b.id=p.board_id WHERE p.roadmap_item_id=? AND p.id=? AND p.approved_at IS NOT NULL AND p.withdrawn_at IS NULL AND i.status<>'dropped' AND (p.board_id IS NULL OR (b.visibility='public' AND b.archived_at IS NULL)))`,[id,input.approvalId]),
  db.prepare('UPDATE roadmap_publications SET public_eta=?,updated_at=? WHERE roadmap_item_id=? AND public_eta IS NOT ?').bind(input.publicEta,now,id,input.publicEta),
  db.prepare(`INSERT INTO roadmap_transitions(id,roadmap_item_id,from_status,to_status,reason,actor_operator_id,kind,created_at,updated_at) SELECT ?,id,status,status,?,?,'eta',?,? FROM roadmap_items WHERE id=? AND changes()=1`).bind(transitionId,input.publicEta?`Public ETA approved: ${input.publicEta}`:'Public ETA removed',actor,now,now,id),
  ...prepareRoadmapUpdateDraft(db,{itemId:id,transitionId,actorId:actor,now,publicStatus:null,etaChanged:true}),
  audit(db,actor,'roadmap',id,'roadmap.eta_approved',now,{publicEta:input.publicEta}),
  db.prepare('DELETE FROM requester_write_guards WHERE id=?').bind(guard),
 ])}catch(error){if(/requester_write_admitted|permitted/.test(String(error)))throw new MutationError(409,'Review the current public approval before approving an ETA.');throw error}
 return {ok:true}
}
