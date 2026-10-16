import type { Resources, Json } from '@/core/app/resources.server'

/** One batch for the visible page, rather than four authenticated reads per card. */
export async function evidenceSnapshot(db:D1Database, ids:string[]):Promise<Resources> {
  if(!ids.length)return {}
  const scope='IN (SELECT value FROM json_each(?))', params=JSON.stringify(ids)
  const results=await db.batch<Record<string,Json>>([
    db.prepare(`SELECT evidence_id AS entityId,id,version_number AS versionNumber,wording,edited_by_operator_id AS editedByOperatorId,created_at AS createdAt FROM evidence_versions WHERE evidence_id ${scope} ORDER BY version_number DESC`).bind(params),
    db.prepare(`SELECT evidence_id AS entityId,id,original_filename AS filename,content_type AS contentType,byte_size AS byteSize FROM attachments WHERE evidence_id ${scope} ORDER BY created_at,id`).bind(params),
    db.prepare(`SELECT evidence_id AS entityId,id,original_filename AS filename,writing FROM evidence_attachment_uploads WHERE evidence_id ${scope} ORDER BY created_at,id`).bind(params),
    db.prepare(`SELECT l.evidence_id AS entityId,'request' AS target,l.request_id AS targetId,r.title AS label,l.stance FROM request_evidence_links l JOIN requests r ON r.id=l.request_id WHERE l.evidence_id ${scope}`).bind(params),
    db.prepare(`SELECT l.evidence_id AS entityId,'bet' AS target,l.candidate_bet_id AS targetId,b.title AS label,l.stance FROM candidate_bet_evidence_links l JOIN candidate_bets b ON b.id=l.candidate_bet_id WHERE l.evidence_id ${scope}`).bind(params),
  ])
  const rows=(index:number,id:string)=>results[index].results.filter(row=>row.entityId===id).map(({entityId:_,...row})=>row)
  return Object.fromEntries(ids.flatMap(id=>[
    [`/api/operator/evidence/${id}/versions`,{status:200,data:rows(0,id)}],
    [`/api/operator/evidence/${id}/attachments`,{status:200,data:{files:rows(1,id),uploads:rows(2,id)}}],
    [`/api/operator/evidence/${id}/links`,{status:200,data:[...rows(3,id),...rows(4,id)]}],
  ]))
}
