import type { ListEntity } from './list-query'
// Tags are direct for requests/evidence. Other records inherit tags only through these durable links.
export const evidenceTags = (id: string) => `SELECT tag_id FROM evidence_tag_assignments WHERE evidence_id=${id}`
export const requestTags = (id: string) => `SELECT tag_id FROM request_tag_assignments WHERE request_id=${id}`
export const decisionTags = (id: string) => `SELECT et.tag_id FROM candidate_bets cb JOIN candidate_bet_evidence_links l ON l.candidate_bet_id=cb.id JOIN evidence_tag_assignments et ON et.evidence_id=l.evidence_id WHERE cb.decision_id=${id} UNION SELECT ta.tag_id FROM roadmap_items ri JOIN roadmap_request_mappings rm ON rm.roadmap_item_id=ri.id JOIN request_tag_assignments ta ON ta.request_id=rm.request_id WHERE ri.decision_id=${id} AND rm.withdrawn_at IS NULL`
export const roadmapTags = (id: string) => `SELECT ta.tag_id FROM roadmap_request_mappings rm JOIN request_tag_assignments ta ON ta.request_id=rm.request_id WHERE rm.roadmap_item_id=${id} AND rm.withdrawn_at IS NULL UNION SELECT et.tag_id FROM roadmap_evidence_links l JOIN evidence_tag_assignments et ON et.evidence_id=l.evidence_id WHERE l.roadmap_item_id=${id} UNION SELECT et.tag_id FROM roadmap_items ri JOIN candidate_bet_evidence_links l ON l.candidate_bet_id=ri.candidate_bet_id JOIN evidence_tag_assignments et ON et.evidence_id=l.evidence_id WHERE ri.id=${id}`
export function tagRelation(entity: ListEntity): string {
 switch(entity) {
 case 'requests': return requestTags('x.id')
 case 'evidence': return evidenceTags('x.id')
 case 'decisions': return decisionTags('x.id')
 case 'roadmap': return roadmapTags('x.id')
 case 'releases': return `SELECT value AS tag_id FROM release_versions rv,json_each(rv.subject_tags_json) WHERE rv.id=x.current_version_id UNION SELECT et.tag_id FROM release_targets rt JOIN roadmap_evidence_links l ON l.roadmap_item_id=rt.roadmap_item_id JOIN evidence_tag_assignments et ON et.evidence_id=l.evidence_id WHERE rt.release_id=x.id UNION SELECT ta.tag_id FROM release_targets rt JOIN roadmap_request_mappings rm ON rm.roadmap_item_id=rt.roadmap_item_id JOIN request_tag_assignments ta ON ta.request_id=rm.request_id WHERE rt.release_id=x.id AND rm.withdrawn_at IS NULL UNION SELECT et.tag_id FROM release_targets rt JOIN roadmap_items ri ON ri.id=rt.roadmap_item_id JOIN candidate_bet_evidence_links l ON l.candidate_bet_id=ri.candidate_bet_id JOIN evidence_tag_assignments et ON et.evidence_id=l.evidence_id WHERE rt.release_id=x.id`
 case 'accounts': return `SELECT et.tag_id FROM evidence_items e JOIN evidence_tag_assignments et ON et.evidence_id=e.id WHERE e.account_id=x.id UNION SELECT ta.tag_id FROM requests r JOIN requesters p ON p.id=r.author_requester_id JOIN requester_account_links al ON al.requester_id=p.id JOIN request_tag_assignments ta ON ta.request_id=r.id WHERE al.account_id=x.id UNION SELECT ta.tag_id FROM request_evidence_links rel JOIN evidence_items e ON e.id=rel.evidence_id JOIN request_tag_assignments ta ON ta.request_id=rel.request_id WHERE e.account_id=x.id`
 case 'requesters': return `SELECT et.tag_id FROM evidence_items e JOIN evidence_tag_assignments et ON et.evidence_id=e.id WHERE e.requester_id=x.id UNION SELECT ta.tag_id FROM requests r JOIN request_tag_assignments ta ON ta.request_id=r.id WHERE r.author_requester_id=x.id`
 }
}
