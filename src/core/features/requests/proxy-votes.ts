import { importanceValue,checkImportance,importanceAdmission,importanceStatements } from './vote-importance'
import { z } from 'zod'
import { MutationError } from '@/core/app/operator-mutations'
import { createUlid } from '@/core/shared/ulid'
import { projectContributions } from './contributions'

const id=z.string().regex(/^[0-9A-HJKMNPQRSTVWXYZ]{26}$/u)
export const proxyVoteSchema=z.object({
 importance:importanceValue.optional(),requesterId:id.optional(),
 contact:z.object({displayName:z.string().trim().min(1).max(160),email:z.email().max(254).optional()}).strict().optional(),
 source:z.string().trim().min(1).max(2000),
 sourceUrl:z.url().refine(value=>{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password}).optional(),
 evidenceId:id.optional(),
}).strict().refine(value=>Boolean(value.requesterId)!==Boolean(value.contact),'Choose an existing customer or create one contact.')
export type ProxyVoteInput=z.infer<typeof proxyVoteSchema>

/** The caller supplies a database guarded by current native operator authority. */
export async function recordProxyVote(db:D1Database,slug:string,input:ProxyVoteInput,actorId:string){
 const request=await db.prepare('SELECT id,board_id AS boardId FROM requests WHERE (slug=? OR id=?) AND withdrawn_at IS NULL AND merged_into_request_id IS NULL').bind(slug,slug).first<{id:string;boardId:string}>()
 if(!request)throw new MutationError(404,'Current request not found.')
 await checkImportance(db,request.boardId,input.importance)
 const priority=input.importance===undefined?{sql:'1',values:[]}:importanceAdmission(request.boardId,input.importance)
 const personId=input.requesterId??createUlid(),now=new Date().toISOString()
 if(input.requesterId&&!await db.prepare('SELECT id FROM requesters WHERE id=? AND blocked_at IS NULL AND NOT EXISTS(SELECT 1 FROM requester_identity_merges WHERE source_requester_id=?)').bind(personId,personId).first())throw new MutationError(409,'Choose an active customer.')
 if(input.contact?.email&&await db.prepare('SELECT id FROM requester_addresses WHERE lower(email)=lower(?)').bind(input.contact.email).first())throw new MutationError(409,'That address already belongs to a customer. Search for and select that customer.')
 if(input.evidenceId&&await db.prepare("SELECT 1 FROM evidence_items WHERE id=? AND source_type='review'").bind(input.evidenceId).first())throw new MutationError(409,'Reviewers cannot become a proxy-vote contact from review capture.')
 if(input.evidenceId&&!await db.prepare('SELECT id FROM evidence_items WHERE id=?').bind(input.evidenceId).first())throw new MutationError(404,'Source evidence not found.')
 const guard=createUlid(),existing=await db.prepare('SELECT 1 FROM request_votes WHERE request_id=? AND requester_id=?').bind(request.id,personId).first()
 // An existing vote is already this customer's demand. Recording it again adds no origin.
 if(existing)return {requesterId:personId,created:false}
 try{await db.batch([
  db.prepare(`INSERT INTO requester_write_guards(id,permitted) VALUES(?,CASE WHEN
   EXISTS(SELECT 1 FROM requests WHERE id=? AND withdrawn_at IS NULL AND merged_into_request_id IS NULL)
   AND NOT EXISTS(SELECT 1 FROM request_votes WHERE request_id=? AND requester_id=?)
   AND (?=1 OR EXISTS(SELECT 1 FROM requesters WHERE id=? AND blocked_at IS NULL AND NOT EXISTS(SELECT 1 FROM requester_identity_merges WHERE source_requester_id=?)))
   AND (? IS NULL OR EXISTS(SELECT 1 FROM evidence_items WHERE id=? AND source_type<>'review')) AND ${priority.sql} THEN 1 ELSE 0 END)`)
   .bind(guard,request.id,request.id,personId,Number(Boolean(input.contact)),personId,personId,input.evidenceId??null,input.evidenceId??null,...priority.values),
  ...(input.contact?[
   db.prepare('INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES(?,?,?,?)').bind(personId,input.contact.displayName,now,now),
   ...(input.contact.email?[db.prepare('INSERT INTO requester_addresses(id,requester_id,email,created_at,updated_at) VALUES(?,?,?,?,?)').bind(createUlid(),personId,input.contact.email.toLowerCase(),now,now)]:[]),
  ]:[]),
  db.prepare('INSERT INTO request_vote_contributions(request_id,requester_id,created_at,updated_at) VALUES(?,?,?,?)').bind(request.id,personId,now,now),
  db.prepare('INSERT INTO penny_proxy_votes(request_id,requester_id,recorder_operator_id,source,source_url,evidence_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(request.id,personId,actorId,input.source,input.sourceUrl??null,input.evidenceId??null,now,now),
  ...importanceStatements({binding:db},request.id,personId,input.importance,now),
  ...projectContributions({binding:db},[request.id]),
  db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) VALUES(?,'operator',?,'request.proxy_vote_recorded','request',?,?,?,?)`).bind(createUlid(),actorId,request.id,now,now,now),
  db.prepare('DELETE FROM requester_write_guards WHERE id=?').bind(guard),
 ])}catch(error){if(/requester_write_admitted|UNIQUE constraint/.test(String(error)))throw new MutationError(409,'Customer or request changed. Reload before recording the vote.');throw error}
 return {requesterId:personId,created:true}
}

/** Explicit active native origins; a later direct vote takes over the attribution. */
export const nativeProxyPredicate=(voteAlias='v')=>`EXISTS(SELECT 1 FROM penny_proxy_votes proxy JOIN request_canonical_roots root ON root.origin_id=proxy.request_id WHERE root.canonical_id=${voteAlias}.request_id AND proxy.requester_id=${voteAlias}.requester_id AND proxy.direct_vote_at IS NULL)`

export async function proxyContacts(db:D1Database,q:string){
 const rows=await db.prepare(`SELECT p.id,p.display_name AS displayName,(SELECT email FROM requester_addresses WHERE requester_id=p.id ORDER BY verified_at DESC,id LIMIT 1) AS email
  FROM requesters p WHERE p.blocked_at IS NULL AND NOT EXISTS(SELECT 1 FROM requester_identity_merges WHERE source_requester_id=p.id)
  AND (?='' OR instr(lower(p.display_name),lower(?))>0 OR EXISTS(SELECT 1 FROM requester_addresses a WHERE a.requester_id=p.id AND instr(lower(a.email),lower(?))>0)) ORDER BY p.display_name,p.id LIMIT 25`).bind(q,q,q).all()
 return rows.results
}
