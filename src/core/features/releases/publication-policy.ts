/** Shared transaction-local publication and current visibility predicates. */
export const publicRequest=`r.moderation_state='approved' AND r.published_at IS NOT NULL
 AND r.withdrawn_at IS NULL AND r.merged_into_request_id IS NULL AND b.visibility='public'
 AND (author.id IS NULL OR author.blocked_at IS NULL)`
export const visibleRequestIds=`SELECT r.id FROM requests r JOIN boards b ON b.id=r.board_id
 LEFT JOIN requesters author ON author.id=r.author_requester_id WHERE ${publicRequest}`
export function publicationGuard(db:D1Database,id:string,condition:string,values:(string|number|null)[]){
 return db.prepare(`INSERT INTO requester_write_guards(id,permitted) VALUES(?,CASE WHEN ${condition} THEN 1 ELSE 0 END)`).bind(id,...values)
}
