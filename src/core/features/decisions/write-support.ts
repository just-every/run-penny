import { MutationError } from '@/core/app/operator-mutations'
import { createUlid } from '@/core/shared/ulid'

export function audit(db:D1Database, actor:string, entity:string, id:string, action:string, now:string, details:unknown=null) {
  return db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,details_json,occurred_at,created_at,updated_at) VALUES(?,'operator',?,?,?,?,?,?,?,?)`).bind(createUlid(),actor,action,entity,id,details===null?null:JSON.stringify(details),now,now,now)
}
export async function exists(db:D1Database, table:'operators'|'accounts'|'evidence_items'|'requests'|'candidate_bets'|'decisions', id:string|null|undefined) {
  if(id !== null && id !== undefined && (!id.trim() || !await db.prepare(`SELECT id FROM ${table} WHERE id=?`).bind(id).first())) throw new MutationError(422,`${table.replaceAll('_',' ')} not found.`)
}
// Same ECMAScript WhiteSpace/LineTerminator set as String.trim(), also used by migration 0013 admission.
export const questionWhitespaceSql="char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279)"
export const normalizeQuestion=(question:string)=>question.trim()
export const readinessSql=`UPDATE decisions SET state=CASE WHEN trim(question,${questionWhitespaceSql})!='' AND owner_operator_id IS NOT NULL AND EXISTS(SELECT 1 FROM candidate_bets b JOIN candidate_bet_evidence_links l ON l.candidate_bet_id=b.id WHERE b.decision_id=decisions.id) THEN 'ready' ELSE 'draft' END WHERE state IN ('draft','ready')`
export function refreshReadiness(db:D1Database,id:string,byBet=false){return db.prepare(readinessSql+(byBet?' AND id=(SELECT decision_id FROM candidate_bets WHERE id=?)':' AND id=?')).bind(id)}
export function validDate(value:string|null|undefined):boolean {
  if(!value)return false
  // Calendar dates use the workspace zone; timestamps must identify an instant.
  return /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value.slice(0,10)).toISOString().slice(0,10)===value.slice(0,10)
}
export function validObservedTime(value:string):boolean {
 return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && validDate(value)
}
export async function mutableDecision(db:D1Database,id:string) {
  const decision=await db.prepare('SELECT id,state FROM decisions WHERE id=?').bind(id).first<{id:string;state:string}>()
  if(!decision)throw new MutationError(404,'Decision not found.')
  if(!['draft','ready'].includes(decision.state))throw new MutationError(409,'This commitment is recorded. Revision is a separate operation.')
  return decision
}

/** Generate one ULID per SELECT row without pre-reading a mutable evidence set. */
export function snapshotUlidSql(now:string){
 const time=createUlid(Date.parse(now)).slice(0,10)
 return `'${time}'||`+Array.from({length:16},()=>"substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ',1+(random() & 31),1)").join('||')
}
