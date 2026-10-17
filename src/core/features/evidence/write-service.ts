import { MutationError } from '@/core/app/operator-mutations'
import { capturedEvidenceOwner, captureOwnerFailure } from '../ownership/capture'
import { createUlid } from '@/core/shared/ulid'
import { audit,exists,refreshReadiness,validObservedTime } from '../decisions/write-support'

export interface RecordEvidence {
 sourceType:'sales_call'|'support_conversation'|'interview'|'email'|'free_text'
 sourceLabel?:string|null;wording:string;observedAt:string;namedSpeaker?:string|null;accountId?:string|null
 boardSlug?:string|null
 requestLinks?:{id:string;stance:'supporting'|'contradicting'}[];betLinks?:{id:string;stance:'supporting'|'contradicting'}[];releaseId?:string|null
}
export async function recordEvidence(db:D1Database,input:RecordEvidence,actor:string,now:string) {
 if(!validObservedTime(input.observedAt))throw new MutationError(422,'Observed time must include a valid date, time and timezone offset.')
 if(input.sourceType==='free_text'&&!input.sourceLabel?.trim())throw new MutationError(422,'Source label is required for free text.')
 await exists(db,'accounts',input.accountId)
 for(const link of input.requestLinks??[])await exists(db,'requests',link.id)
 for(const link of input.betLinks??[])await exists(db,'candidate_bets',link.id)
 if(input.releaseId&&!await db.prepare('SELECT id FROM releases WHERE id=?').bind(input.releaseId).first())throw new MutationError(422,'Release not found.')
 const id=createUlid(),versionId=createUlid()
 try { await db.batch([
  db.prepare(`INSERT INTO evidence_items(id,source_type,source_label,named_speaker,account_id,requester_id,recorded_by_operator_id,observed_at,release_id,review_state,created_at,updated_at) VALUES(?,?,?,?,?,NULL,?,?,?,'unreviewed',?,?)`).bind(id,input.sourceType,input.sourceLabel??null,input.namedSpeaker??null,input.accountId??null,actor,input.observedAt,input.releaseId??null,now,now),
  ...capturedEvidenceOwner(db,id,input.boardSlug,now),
  db.prepare(`INSERT INTO evidence_versions(id,evidence_id,version_number,wording,edited_by_operator_id,created_at,updated_at) VALUES(?,?,1,?,?,?,?)`).bind(versionId,id,input.wording,actor,now,now),
  ...(input.requestLinks??[]).flatMap(link=>[
   db.prepare('INSERT INTO request_evidence_links(request_id,evidence_id,stance,created_at) VALUES(?,?,?,?)').bind(link.id,id,link.stance,now),
   db.prepare('INSERT INTO request_evidence_contributions(request_id,evidence_id,created_at) VALUES(?,?,?)').bind(link.id,id,now),
  ]),
  ...(input.betLinks??[]).flatMap(link=>[
   db.prepare('INSERT INTO candidate_bet_evidence_links(candidate_bet_id,evidence_id,stance,created_at) VALUES(?,?,?,?)').bind(link.id,id,link.stance,now),refreshReadiness(db,link.id,true),
  ]),
  audit(db,actor,'evidence',id,'evidence.recorded',now),
 ]) } catch(error) { captureOwnerFailure(error) }
 return {id,versionId}
}
export async function reviewEvidence(db:D1Database,id:string,reviewed:boolean,reason:string|null,actor:string,now:string) {
 await exists(db,'evidence_items',id)
 if(reviewed&&!reason?.trim())throw new MutationError(422,'Review reason is required.')
 await db.batch([db.prepare('UPDATE evidence_items SET review_state=?,review_reason=?,updated_at=? WHERE id=?').bind(reviewed?'reviewed':'unreviewed',reviewed?reason:null,now,id),audit(db,actor,'evidence',id,reviewed?'evidence.reviewed':'evidence.unreviewed',now)])
}
export async function linkEvidence(db:D1Database,id:string,target:'request'|'bet',targetId:string,stance:'supporting'|'contradicting',unlink:boolean,actor:string,now:string) {
 await Promise.all([exists(db,'evidence_items',id),exists(db,target==='request'?'requests':'candidate_bets',targetId)])
 const table=target==='request'?'request_evidence_links':'candidate_bet_evidence_links',column=target==='request'?'request_id':'candidate_bet_id'
 const statements=[unlink?db.prepare(`DELETE FROM ${table} WHERE ${column}=? AND evidence_id=?`).bind(targetId,id):db.prepare(`INSERT INTO ${table}(${column},evidence_id,stance,created_at) VALUES(?,?,?,?) ON CONFLICT(${column},evidence_id) DO UPDATE SET stance=excluded.stance`).bind(targetId,id,stance,now)]
 if(target==='request')statements.push(unlink?db.prepare('DELETE FROM request_evidence_contributions WHERE request_id=? AND evidence_id=?').bind(targetId,id):db.prepare('INSERT INTO request_evidence_contributions(request_id,evidence_id,created_at) VALUES(?,?,?) ON CONFLICT DO NOTHING').bind(targetId,id,now))
 if(target==='bet')statements.push(refreshReadiness(db,targetId,true))
 if(target==='bet')statements.push(db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,details_json,occurred_at,created_at,updated_at) SELECT ?,'operator',?,'decision.evidence_changed','decision',decision_id,json_object('evidenceId',?,'state',(SELECT state FROM decisions WHERE id=decision_id)),?,?,? FROM candidate_bets WHERE id=?`).bind(createUlid(),actor,id,now,now,now,targetId))
 statements.push(audit(db,actor,'evidence',id,unlink?'evidence.unlinked':'evidence.linked',now,{target,targetId,stance}))
 await db.batch(statements)
}
