/** Contexts for the current bounded page, including all disclosure contents. */
export async function roadmapContexts(db:D1Database,ids:string[]) {
  if(!ids.length)return {}
  const scope='IN (SELECT value FROM json_each(?))',params=JSON.stringify(ids)
  const result=await db.batch<Record<string,unknown>>([
    db.prepare(`SELECT * FROM roadmap_items WHERE id ${scope}`).bind(params),
    db.prepare(`SELECT DISTINCT item.id AS entityId,r.id,r.slug,r.public_title AS title FROM roadmap_items item JOIN candidate_bet_evidence_links e ON e.candidate_bet_id=item.candidate_bet_id JOIN request_evidence_links l ON l.evidence_id=e.evidence_id JOIN requests r ON r.id=l.request_id JOIN boards b ON b.id=r.board_id LEFT JOIN requesters a ON a.id=r.author_requester_id WHERE item.id ${scope} AND (a.id IS NULL OR a.blocked_at IS NULL) AND r.moderation_state='approved' AND r.published_at IS NOT NULL AND r.withdrawn_at IS NULL AND r.merged_into_request_id IS NULL AND b.visibility='public' ORDER BY r.slug`).bind(params),
    db.prepare(`SELECT roadmap_item_id AS entityId,* FROM roadmap_request_mappings WHERE roadmap_item_id ${scope}`).bind(params),
    db.prepare(`SELECT roadmap_item_id AS entityId,public_title AS publicTitle,public_summary AS publicSummary,withdrawn_at AS withdrawnAt,(SELECT slug FROM boards WHERE id=board_id) AS boardSlug FROM roadmap_publications WHERE roadmap_item_id ${scope}`).bind(params),
    db.prepare(`SELECT roadmap_item_id AS entityId,* FROM roadmap_mapping_history WHERE roadmap_item_id ${scope} ORDER BY updated_at`).bind(params),
    db.prepare(`SELECT roadmap_item_id AS entityId,* FROM roadmap_transitions WHERE roadmap_item_id ${scope} ORDER BY created_at,id`).bind(params),
    db.prepare(`SELECT roadmap_item_id AS entityId,evidence_id AS id FROM roadmap_evidence_links WHERE roadmap_item_id ${scope}`).bind(params),
  ])
  const rows=(index:number,id:string)=>result[index].results.filter(row=>row.entityId===id).map(({entityId:_,...row})=>row)
  return Object.fromEntries(result[0].results.map(item=>[String(item.id),{item,proposed:rows(1,String(item.id)),mappings:rows(2,String(item.id)),publication:rows(3,String(item.id))[0]??null,history:rows(4,String(item.id)),transitions:rows(5,String(item.id)),evidenceIds:rows(6,String(item.id)).map(row=>row.id)}]))
}
