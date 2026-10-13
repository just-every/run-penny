import { MutationError } from '@/core/app/operator-mutations'
import { createUlid } from '@/core/shared/ulid'
import { audit,exists } from '../decisions/write-support'
import { prepareRoadmapUpdateDraft } from './update-drafts'
import type { OperatorRoadmapStatus } from '@/core/shared/api/operator'
export async function itemRecord(db:D1Database,id:string){
 const row=await db.prepare('SELECT * FROM roadmap_items WHERE id=?').bind(id).first<{id:string;decision_id:string|null;candidate_bet_id:string|null;status:OperatorRoadmapStatus}>()
 if(!row)throw new MutationError(404,'Roadmap item not found.')
 return row
}
export interface RoadmapEdit{title:string;summary:string;ownerOperatorId:string|null;targetWindow:string|null;deliveryNotes:string|null;confidence:'low'|'medium'|'high'|null;accountImpact:string|null;decisionId:string|null;candidateBetId:string|null;publicTitle:string|null;publicSummary:string|null;evidenceIds?:string[]}
export async function editRoadmap(db:D1Database,id:string,input:RoadmapEdit,actor:string,now:string){
 await itemRecord(db,id);await Promise.all([exists(db,'operators',input.ownerOperatorId),exists(db,'decisions',input.decisionId),exists(db,'candidate_bets',input.candidateBetId)])
 if(new Set(input.evidenceIds??[]).size!==(input.evidenceIds??[]).length)throw new MutationError(422,'Choose each evidence item once.')
 for(const evidenceId of input.evidenceIds??[])await exists(db,'evidence_items',evidenceId)
 if(input.candidateBetId&&!await db.prepare('SELECT id FROM candidate_bets WHERE id=? AND decision_id=?').bind(input.candidateBetId,input.decisionId).first())throw new MutationError(422,'Bet must belong to the linked decision.')
 try{await db.batch([db.prepare(`UPDATE roadmap_items SET title=?,summary=?,owner_operator_id=?,target_window=?,delivery_notes=?,confidence=?,account_impact=?,decision_id=?,candidate_bet_id=?,public_title_draft=?,public_summary_draft=?,updated_at=? WHERE id=?`).bind(input.title,input.summary,input.ownerOperatorId,input.targetWindow,input.deliveryNotes,input.confidence,input.accountImpact,input.decisionId,input.candidateBetId,input.publicTitle,input.publicSummary,now,id),db.prepare('DELETE FROM roadmap_evidence_links WHERE roadmap_item_id=?').bind(id),...(input.evidenceIds??[]).map(evidenceId=>db.prepare('INSERT INTO roadmap_evidence_links(roadmap_item_id,evidence_id,created_at,updated_at) VALUES(?,?,?,?)').bind(id,evidenceId,now,now)),audit(db,actor,'roadmap',id,'roadmap.edited',now)])}catch(error){if(/UNIQUE constraint|Bet already has a roadmap item/.test(String(error)))throw new MutationError(409,'This bet already has a roadmap item.');throw error}
}
export async function approveRoadmap(db:D1Database,id:string,input:{publicTitle:string;publicSummary:string;boardSlug:string;requestIds:string[]},actor:string,now:string){
 await itemRecord(db,id)
 if(new Set(input.requestIds).size!==input.requestIds.length)throw new MutationError(422,'Choose each mapping once.')
 const board=await db.prepare("SELECT id FROM boards WHERE slug=? AND visibility='public' AND archived_at IS NULL").bind(input.boardSlug).first<{id:string}>()
 if(!board)throw new MutationError(422,'Choose a public board.')
 const statements=[db.prepare(`INSERT INTO roadmap_publications(id,roadmap_item_id,public_title,public_summary,board_id,public_slug,approved_by_operator_id,approved_at,withdrawn_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,NULL,?,?) ON CONFLICT(roadmap_item_id) DO UPDATE SET id=excluded.id,public_title=excluded.public_title,public_summary=excluded.public_summary,board_id=excluded.board_id,approved_by_operator_id=excluded.approved_by_operator_id,approved_at=excluded.approved_at,withdrawn_at=NULL,updated_at=excluded.updated_at`).bind(createUlid(),id,input.publicTitle,input.publicSummary,board.id,`roadmap-${createUlid().toLowerCase()}`,actor,now,now,now),db.prepare('UPDATE roadmap_request_mappings SET withdrawn_at=?,updated_at=? WHERE roadmap_item_id=? AND withdrawn_at IS NULL').bind(now,now,id)]
 for(const requestId of input.requestIds){
  statements.push(db.prepare(`INSERT INTO roadmap_mapping_history(id,roadmap_item_id,request_id,approved_at,withdrawn_at,created_at,updated_at) SELECT ?,roadmap_item_id,request_id,approved_at,withdrawn_at,created_at,updated_at FROM roadmap_request_mappings WHERE request_id=? AND (withdrawn_at IS NOT NULL OR approved_at IS NULL)`).bind(createUlid(),requestId),db.prepare('DELETE FROM roadmap_request_mappings WHERE request_id=? AND (withdrawn_at IS NOT NULL OR approved_at IS NULL)').bind(requestId),db.prepare('INSERT INTO roadmap_request_mappings(roadmap_item_id,request_id,approved_at,created_at,updated_at) VALUES(?,?,?,?,?)').bind(id,requestId,now,now,now))
 }
 statements.push(audit(db,actor,'roadmap',id,'roadmap.approved',now))
 try{await db.batch(statements)}catch(error){const message=String(error);if(message.includes('UNIQUE constraint'))throw new MutationError(409,'Request already has an approved roadmap mapping.');if(/published request|public board|Dropped/.test(message))throw new MutationError(422,'Approval requires a public board, published requests and an item outside Dropped.');throw error}
}
export async function withdrawRoadmap(db:D1Database,id:string,actor:string,now:string){
 await itemRecord(db,id)
 await db.batch([db.prepare('UPDATE roadmap_publications SET withdrawn_at=?,updated_at=? WHERE roadmap_item_id=? AND withdrawn_at IS NULL').bind(now,now,id),db.prepare('UPDATE roadmap_request_mappings SET withdrawn_at=?,updated_at=? WHERE roadmap_item_id=? AND withdrawn_at IS NULL').bind(now,now,id),audit(db,actor,'roadmap',id,'roadmap.withdrawn',now)])
}
export async function moveRoadmap(db:D1Database,id:string,status:OperatorRoadmapStatus,reason:string,key:string,actor:string,now:string):Promise<{transitionId:string}>{
 const replay=await replayedMove(db,id,status,reason,key,actor)
 if(replay)return replay
 await itemRecord(db,id)
 const transitionId=createUlid()
 const statements=[db.prepare(`INSERT INTO roadmap_transitions(id,roadmap_item_id,from_status,to_status,reason,actor_operator_id,action_key,created_at,updated_at) SELECT ?,id,status,?,?,?,?,?,? FROM roadmap_items WHERE id=?`).bind(transitionId,status,reason,actor,key,now,now,id),
 ...prepareRoadmapUpdateDraft(db,{itemId:id,transitionId,actorId:actor,now,publicStatus:status==='exploring'?'under_review':status==='dropped'?'withdrawn':status}),
 db.prepare('UPDATE roadmap_items SET status=?,updated_at=? WHERE id=?').bind(status,now,id),
 db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,details_json,occurred_at,created_at,updated_at) SELECT ?,'operator',?,'roadmap.moved','decision',i.decision_id,json_object('transitionId',t.id,'from',t.from_status,'to',t.to_status,'reason',t.reason),?,?,? FROM roadmap_items i JOIN roadmap_transitions t ON t.roadmap_item_id=i.id WHERE t.id=? AND i.decision_id IS NOT NULL`).bind(createUlid(),actor,now,now,now,transitionId),
 audit(db,actor,'roadmap',id,'roadmap.moved',now,{transitionId})]
 try{await db.batch(statements)}catch(error){const message=String(error);if(message.includes('UNIQUE constraint failed: roadmap_transitions.action_key')||message.includes('Choose a different status')){const replay=await replayedMove(db,id,status,reason,key,actor);if(replay)return replay}if(message.includes('Choose a different status'))throw new MutationError(422,'Choose a different status.');throw error}
 return {transitionId}
}

async function replayedMove(db:D1Database,id:string,status:OperatorRoadmapStatus,reason:string,key:string,actor:string){
 const replay=await db.prepare('SELECT id,roadmap_item_id,to_status,reason,actor_operator_id FROM roadmap_transitions WHERE action_key=?').bind(key).first<{id:string;roadmap_item_id:string;to_status:string;reason:string;actor_operator_id:string}>()
 if(!replay)return null
 if(replay.roadmap_item_id!==id||replay.to_status!==status||replay.reason!==reason||replay.actor_operator_id!==actor)throw new MutationError(409,'This action key was used for a different move.')
 return {transitionId:replay.id}
}
