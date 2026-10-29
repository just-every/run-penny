import {NativeError} from '../auth/native-tokens'
import {settings} from './configuration'
export type DraftKind='request'|'decision'|'account'|'comment'|'inbox'
export interface DraftSource {id:string;text:string;label:string;href:string}
interface RequestRow {id:string;slug:string;title:string;description:string;published_at:string|null;moderation_state:string;visibility:string;withdrawn_at:string|null;merged_into_request_id:string|null}
/** Native operator records only. ROLE-001 will narrow this same read boundary. */
export async function draftContext(db:D1Database,kind:DraftKind,id:string){
 const sources=new Map<string,DraftSource>(),requestIds=new Set<string>(),evidenceIds=new Set<string>(),includePrivate=!!(await settings(db)).include_private
 const add=(source:DraftSource)=>sources.set(source.id,source)
 async function rows<T>(sql:string,...params:string[]){const r=(await db.prepare(sql).bind(...params).all<T>()).results;if(r.length>100)throw new NativeError('ai_context_too_large',413,'This record has too much context for one draft. Manual work remains available.');return r}
 if(kind==='request')requestIds.add(id)
 if(kind==='comment'){
  const c=await db.prepare('SELECT id,request_id,body FROM request_comments WHERE id=?').bind(id).first<{id:string;request_id:string;body:string}>()
  if(!c)throw new NativeError('not_found',404)
  requestIds.add(c.request_id);add({id:`comment:${c.id}`,text:c.body,label:'Selected comment',href:`/api/operator/requests/${(await db.prepare('SELECT slug FROM requests WHERE id=?').bind(c.request_id).first<{slug:string}>())!.slug}/context`})
 }
 if(kind==='inbox')evidenceIds.add(id)
 if(kind==='decision'){
  const d=await db.prepare('SELECT id,slug,title,question,rationale FROM decisions WHERE id=?').bind(id).first<{id:string;slug:string;title:string;question:string;rationale:string|null}>()
  if(!d)throw new NativeError('not_found',404)
  const href=`/app/decisions/${d.slug}`
  add({id:`decision:${d.id}`,text:JSON.stringify({title:d.title,question:d.question,rationale:d.rationale}),label:'Decision brief',href})
  for(const b of await rows<{id:string;title:string;summary:string;assumptions:string|null;counter_evidence:string|null}>('SELECT id,title,summary,assumptions,counter_evidence FROM candidate_bets WHERE decision_id=? LIMIT 101',id)){
   add({id:`bet:${b.id}`,text:JSON.stringify(b),label:'Candidate option',href})
   for(const e of await rows<{evidence_id:string}>('SELECT evidence_id FROM candidate_bet_evidence_links WHERE candidate_bet_id=? LIMIT 101',b.id))evidenceIds.add(e.evidence_id)
  }
 }
 if(kind==='account'){
  const a=await db.prepare('SELECT * FROM accounts WHERE id=?').bind(id).first<{id:string;slug:string;name:string;revenue_cents:number|null;renewal_date:string|null;health:string|null}>()
  if(!a)throw new NativeError('not_found',404)
  if(includePrivate)add({id:`account:${a.id}`,text:JSON.stringify({name:a.name,revenueCents:a.revenue_cents,renewalDate:a.renewal_date,health:a.health}),label:'Account context',href:`/app/accounts/${a.slug}`})
  for(const e of await rows<{id:string}>('SELECT id FROM evidence_items WHERE account_id=? LIMIT 101',id))evidenceIds.add(e.id)
  for(const r of await rows<{id:string}>(`SELECT r.id FROM requests r WHERE r.author_requester_id IN(SELECT requester_id FROM requester_account_links WHERE account_id=?) OR r.id IN(SELECT request_id FROM request_votes WHERE requester_id IN(SELECT requester_id FROM requester_account_links WHERE account_id=?)) OR r.id IN(SELECT request_id FROM request_comments WHERE requester_id IN(SELECT requester_id FROM requester_account_links WHERE account_id=?)) LIMIT 101`,id,id,id))requestIds.add(r.id)
 }
 // Evidence links carry discussion into account, decision and inbox drafts.
 for(const evidenceId of [...evidenceIds])for(const r of await rows<{request_id:string}>('SELECT request_id FROM request_evidence_links WHERE evidence_id=? LIMIT 101',evidenceId))requestIds.add(r.request_id)
 const replyTargets:{slug:string;title:string}[]=[]
 for(const requestId of requestIds){
  const r=await db.prepare('SELECT r.*,b.visibility FROM requests r JOIN boards b ON b.id=r.board_id WHERE r.id=?').bind(requestId).first<RequestRow>()
  if(!r)throw new NativeError('not_found',404)
  const href=`/app/moderation?item=${encodeURIComponent(r.id)}#request-${r.slug}`
  add({id:`request:${r.id}`,text:JSON.stringify({title:r.title,description:r.description}),label:'Request',href})
  if(r.visibility==='public'&&r.moderation_state==='approved'&&r.published_at&&!r.withdrawn_at&&!r.merged_into_request_id)replyTargets.push({slug:r.slug,title:r.title})
  for(const c of await rows<{id:string;body:string}>('SELECT id,body FROM request_comments WHERE request_id=? ORDER BY created_at LIMIT 101',r.id))add({id:`comment:${c.id}`,text:c.body,label:'Discussion comment',href})
  if(includePrivate)for(const n of await rows<{id:string;body:string}>('SELECT id,body FROM request_notes WHERE request_id=? ORDER BY created_at LIMIT 101',r.id))add({id:`note:${n.id}`,text:n.body,label:'Internal note',href})
  for(const e of await rows<{evidence_id:string}>('SELECT evidence_id FROM request_evidence_links WHERE request_id=? LIMIT 101',r.id))evidenceIds.add(e.evidence_id)
 }
 for(const evidenceId of evidenceIds){
  const e=await db.prepare('SELECT v.id,v.wording,e.observed_at FROM evidence_items e JOIN evidence_versions v ON v.evidence_id=e.id WHERE e.id=? ORDER BY v.version_number DESC LIMIT 1').bind(evidenceId).first<{id:string;wording:string;observed_at:string}>()
  if(!e)throw new NativeError('not_found',404)
  add({id:`evidence:${e.id}`,text:JSON.stringify({wording:e.wording,observedAt:e.observed_at}),label:'Stored evidence version',href:`/api/operator/evidence/${evidenceId}/versions`})
 }
 if(sources.size>100||JSON.stringify([...sources.values()]).length>100000)throw new NativeError('ai_context_too_large',413,'This record has too much context for one draft. Manual work remains available.')
 if(!sources.size)throw new NativeError('ai_no_permitted_context',409,'There is no permitted evidence or discussion to summarize. Capture evidence manually first.')
 return {sources:[...sources.values()],replyTargets,includePrivate}
}
