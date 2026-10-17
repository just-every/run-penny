import type { DatabaseConnection } from '@/core/platform/database'
import { PAGE_SIZE, ListQueryError, type ListEntity, type ListQuery } from './list-query'
import { observedTimeOrderSql } from '@/core/features/evidence/observed-time'
import { tagRelation } from './tag-relations'
export const entitySource: Record<ListEntity, { table: string; wording: string; title: string }> = {
 requests:{table:'requests',title:'x.title',wording:"x.title || ' ' || x.description"},
 evidence:{table:'evidence_items',title:"COALESCE((SELECT wording FROM evidence_versions WHERE evidence_id=x.id ORDER BY version_number DESC LIMIT 1),'')",wording:"COALESCE((SELECT wording FROM evidence_versions WHERE evidence_id=x.id ORDER BY version_number DESC LIMIT 1),'')"},
 decisions:{table:'decisions',title:'x.title',wording:"x.title || ' ' || x.question || ' ' || COALESCE(x.rationale,'') || ' ' || COALESCE((SELECT group_concat(rationale,' ') FROM decision_revisions WHERE decision_id=x.id),'')"},
 roadmap:{table:'roadmap_items',title:'x.title',wording:"x.title || ' ' || x.summary"},
 releases:{table:'releases',title:"(SELECT title FROM release_versions WHERE id=x.current_version_id)",wording:"(SELECT title || ' ' || body FROM release_versions WHERE id=x.current_version_id)"},
 accounts:{table:'accounts',title:'x.name',wording:'x.name'},
 requesters:{table:'requesters',title:'x.display_name',wording:"x.display_name || ' ' || COALESCE((SELECT group_concat(email,' ') FROM requester_addresses WHERE requester_id=x.id),'')"},
}
export function listPredicate(entity: ListEntity, query: ListQuery): { sql: string; values: (string | number)[] } {
 const states:Partial<Record<ListEntity,readonly string[]>>={requests:['unpublished','open','under_review','planned','in_progress','shipped','declined','withdrawn'],evidence:['unreviewed','reviewed'],decisions:['draft','ready','committed','review_due'],roadmap:['exploring','planned','in_progress','shipped','dropped'],releases:['draft','published']}
 if(query.status && !states[entity]?.includes(query.status))throw new ListQueryError('Invalid status for this list')
 if(query.account && !['requests','evidence','decisions','requesters'].includes(entity))throw new ListQueryError('Unsupported account filter')
 if(query.unreviewed && entity!=='evidence' || query.attention && entity!=='decisions' || query.active && entity!=='roadmap')throw new ListQueryError('Unsupported attention filter')
 const clauses:string[]=[], values:(string|number)[]=[]
 const add=(sql:string,value?:string)=>{clauses.push(sql);if(value!==undefined)values.push(value)}
 if(query.q) add(`instr(lower(${entitySource[entity].wording}),lower(?)) > 0`,query.q)
 if(query.item) add('x.id=?',query.item)
 if(query.tag) add(`EXISTS(SELECT 1 FROM tags t WHERE t.id IN (${tagRelation(entity)}) AND (t.id=? OR t.name=?))`,query.tag),values.push(query.tag)
 if(entity==='requests') {
  if(query.moderation)add('x.moderation_state=?',query.moderation)
  if(query.board)add('EXISTS(SELECT 1 FROM boards b WHERE b.id=x.board_id AND (b.id=? OR b.slug=?))',query.board),values.push(query.board)
  if(query.status)add('(SELECT status FROM penny_request_status WHERE request_id=x.id)=?',query.status)
  if(query.decision)add(`(EXISTS(SELECT 1 FROM roadmap_request_mappings m JOIN roadmap_items ri ON ri.id=m.roadmap_item_id JOIN decisions d ON d.id=ri.decision_id WHERE m.request_id=x.id AND m.withdrawn_at IS NULL AND (d.id=? OR d.slug=?)) OR EXISTS(SELECT 1 FROM request_evidence_links rel JOIN candidate_bet_evidence_links el ON el.evidence_id=rel.evidence_id JOIN candidate_bets cb ON cb.id=el.candidate_bet_id JOIN decisions d ON d.id=cb.decision_id WHERE rel.request_id=x.id AND (d.id=? OR d.slug=?)))`,query.decision),values.push(query.decision,query.decision,query.decision)
  if(query.account)add(`(EXISTS(SELECT 1 FROM request_evidence_links l JOIN evidence_items e ON e.id=l.evidence_id JOIN accounts a ON a.id=e.account_id WHERE l.request_id=x.id AND (a.id=? OR a.slug=?)) OR EXISTS(SELECT 1 FROM requester_account_links l JOIN accounts a ON a.id=l.account_id WHERE l.requester_id=x.author_requester_id AND (a.id=? OR a.slug=?)))`,query.account),values.push(query.account,query.account,query.account)
 } else if(query.moderation||query.board||query.decision) throw new ListQueryError('Request filters require the request queue')
 if(entity==='evidence') {if(query.status)add('x.review_state=?',query.status);if(query.unreviewed)add("x.review_state='unreviewed'");if(query.account)add('EXISTS(SELECT 1 FROM accounts a WHERE a.id=x.account_id AND (a.id=? OR a.slug=?))',query.account),values.push(query.account)}
 else if(entity==='decisions'){
  if(query.status)add('x.state=?',query.status);if(query.attention)add("x.state IN ('ready','review_due')")
  if(query.account)add(`EXISTS(SELECT 1 FROM candidate_bets cb JOIN accounts a ON (a.id=? OR a.slug=?) WHERE cb.decision_id=x.id AND (EXISTS(SELECT 1 FROM candidate_bet_account_links l WHERE l.candidate_bet_id=cb.id AND l.account_id=a.id) OR EXISTS(SELECT 1 FROM candidate_bet_evidence_links l JOIN evidence_items e ON e.id=l.evidence_id WHERE l.candidate_bet_id=cb.id AND e.account_id=a.id)))`,query.account),values.push(query.account)
 }
 else if(entity==='roadmap'){if(query.status)add('x.status=?',query.status);if(query.active)add("x.status IN ('planned','in_progress')")}
 else if(entity==='releases'){if(query.status)add('x.state=?',query.status)}
 else if(entity==='requesters') {if(query.account)add('EXISTS(SELECT 1 FROM requester_account_links l JOIN accounts a ON a.id=l.account_id WHERE l.requester_id=x.id AND (a.id=? OR a.slug=?))',query.account),values.push(query.account)}
 else if(entity!=='requests' && (query.status || query.account)) throw new ListQueryError('Unsupported filter for this list')
 return {sql:clauses.length?` WHERE ${clauses.join(' AND ')}`:'',values}
}
export async function listIds(database: DatabaseConnection, entity: ListEntity, query: ListQuery, extra?: string) {
 const source=entitySource[entity], predicate=listPredicate(entity,query), page=query.page??1
 if(extra)predicate.sql += `${predicate.sql ? ' AND ' : ' WHERE '}(${extra})`
 if(query.sort==='observed' && entity!=='evidence')throw new ListQueryError('Observed time sort requires evidence')
 if(query.sort==='votes' && entity!=='requests')throw new ListQueryError('Votes sort requires requests')
 let order=`${source.title} COLLATE NOCASE ASC`
 if(query.sort==='age')order='x.created_at ASC'
 if(query.sort==='observed')order=observedTimeOrderSql('x.observed_at')
 if(query.sort==='recent'||(!query.sort && entity!=='accounts'&&entity!=='requesters'))order='x.updated_at DESC'
 if((query.sort==='recent'||!query.sort) && entity==='requests')order=`MAX(x.updated_at,COALESCE((SELECT MAX(v.updated_at) FROM request_votes v JOIN requesters p ON p.id=v.requester_id WHERE v.request_id=x.id AND p.blocked_at IS NULL),x.updated_at),COALESCE((SELECT MAX(c.updated_at) FROM request_comments c WHERE c.request_id=x.id),x.updated_at),COALESCE((SELECT MAX(n.updated_at) FROM request_notes n WHERE n.request_id=x.id),x.updated_at),COALESCE((SELECT MAX(u.updated_at) FROM request_status_updates u WHERE u.request_id=x.id),x.updated_at)) DESC`
 if(query.sort==='votes')order='(SELECT COUNT(*) FROM request_votes v JOIN requesters p ON p.id=v.requester_id WHERE v.request_id=x.id AND p.blocked_at IS NULL AND x.withdrawn_at IS NULL) DESC'
 const [count,rows]=await Promise.all([
  database.binding.prepare(`SELECT COUNT(*) AS total FROM ${source.table} x${predicate.sql}`).bind(...predicate.values).first<{total:number}>(),
  database.binding.prepare(`SELECT x.id FROM ${source.table} x${predicate.sql} ORDER BY ${order},x.id ASC LIMIT ? OFFSET ?`).bind(...predicate.values,PAGE_SIZE,(page-1)*PAGE_SIZE).all<{id:string}>(),
 ])
 return {ids:rows.results.map(row=>row.id),total:Number(count?.total??0),page,pageSize:PAGE_SIZE}
}
