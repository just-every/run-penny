import { MutationError } from '@/core/app/operator-mutations'
import { createUlid } from '@/core/shared/ulid'
import { audit,exists,mutableDecision,normalizeQuestion,refreshReadiness,validDate } from './write-support'

export interface DecisionInput {question:string;ownerOperatorId?:string|null;confidence?:'low'|'medium'|'high'|null;reviewAt?:string|null;evidenceId?:string;initialBet?:{title:string;summary:string}}
export async function createDecision(db:D1Database,input:DecisionInput,actor:string,now:string) {
 const question=normalizeQuestion(input.question)
 await exists(db,'operators',input.ownerOperatorId)
 if(input.reviewAt&&!validDate(input.reviewAt))throw new MutationError(422,'Review date must be valid.')
 if(input.evidenceId){await exists(db,'evidence_items',input.evidenceId);if(!input.initialBet?.title.trim()||!input.initialBet.summary.trim())throw new MutationError(422,'Initial bet title and approach are required.')}
 const id=createUlid(),slug=`decision-${id.toLowerCase()}`
 const statements=[db.prepare(`INSERT INTO decisions(id,slug,title,question,state,owner_operator_id,confidence,review_at,created_at,updated_at) VALUES(?,?,?,?,'draft',?,?,?,?,?)`).bind(id,slug,question||'Untitled decision',question,input.ownerOperatorId??null,input.confidence??null,input.reviewAt??null,now,now)]
 if(input.evidenceId){
  const betId=createUlid()
  statements.push(db.prepare(`INSERT INTO candidate_bets(id,decision_id,title,summary,created_at,updated_at) VALUES(?,?,?,?,?,?)`).bind(betId,id,input.initialBet!.title,input.initialBet!.summary,now,now),db.prepare(`INSERT INTO candidate_bet_evidence_links(candidate_bet_id,evidence_id,stance,created_at) VALUES(?,?,'supporting',?)`).bind(betId,input.evidenceId,now))
 }
 statements.push(refreshReadiness(db,id),audit(db,actor,'decision',id,'decision.created',now))
 await db.batch(statements);return{id,slug}
}
export async function editDecision(db:D1Database,id:string,input:DecisionInput,actor:string,now:string){
 const question=normalizeQuestion(input.question)
 await mutableDecision(db,id);await exists(db,'operators',input.ownerOperatorId)
 if(input.reviewAt&&!validDate(input.reviewAt))throw new MutationError(422,'Review date must be valid.')
 await db.batch([db.prepare(`UPDATE decisions SET title=?,question=?,owner_operator_id=?,confidence=?,review_at=?,updated_at=? WHERE id=?`).bind(question||'Untitled decision',question,input.ownerOperatorId??null,input.confidence??null,input.reviewAt??null,now,id),refreshReadiness(db,id),audit(db,actor,'decision',id,'decision.edited',now)])
}
export interface BetInput{title:string;summary:string;urgency?:string|null;deliveryShape?:string|null;successMeasure?:string|null}
export async function saveBet(db:D1Database,decisionId:string,id:string|null,input:BetInput,actor:string,now:string){
 await mutableDecision(db,decisionId)
 if(id&&!await db.prepare('SELECT id FROM candidate_bets WHERE id=? AND decision_id=?').bind(id,decisionId).first())throw new MutationError(404,'Bet not found in this decision.')
 const betId=id??createUlid()
 await db.batch([id?db.prepare('UPDATE candidate_bets SET title=?,summary=?,urgency=?,delivery_shape=?,success_measure=?,updated_at=? WHERE id=?').bind(input.title,input.summary,input.urgency??null,input.deliveryShape??null,input.successMeasure??null,now,id):db.prepare('INSERT INTO candidate_bets(id,decision_id,title,summary,urgency,delivery_shape,success_measure,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(betId,decisionId,input.title,input.summary,input.urgency??null,input.deliveryShape??null,input.successMeasure??null,now,now),refreshReadiness(db,decisionId),audit(db,actor,'decision',decisionId,id?'bet.edited':'bet.added',now)])
 return{id:betId}
}
