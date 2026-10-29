// Hand-computed test records only. Browser assertions use real compiled routes.
export const marker = field => `privateproof${field}`
export const proofId = (kind,index=0) => `01J0000000000000${String(kind).padStart(2,'0')}${String(index).padStart(8,'0')}`
export const entities = [
 ['request','requests','/app/moderation',1],['evidence','evidence','/app/feedback',2],
 ['decision','decisions','/app/decisions',3],['roadmapItem','roadmap','/app/roadmap',4],
 ['release','releases','/app/releases',5],['account','accounts','/app/accounts',6],
 ['requester','requesters','/app/requesters',7],
]
export async function seedCompleteness(db) {
 const now='2026-10-12T00:00:00.000Z', pending=[]
 const insert=(table,row,timestamps=true)=>{const values=timestamps?{...row,created_at:now,updated_at:now}:row;pending.push(db.prepare(`INSERT INTO ${table}(${Object.keys(values)}) VALUES(${Object.keys(values).map(()=>'?')})`).bind(...Object.values(values)))}
 const operator=await db.prepare('SELECT id FROM operators ORDER BY created_at LIMIT 1').first()
 insert('boards',{id:proofId(8),slug:'proof-board',name:'Proof board',visibility:'public',position:8})
 insert('tags',{id:proofId(9),name:'proof-tag'})
 for(let i=0;i<56;i++) {
  const id=kind=>proofId(kind,i),slug=kind=>`proof-${kind}-${String(i).padStart(2,'0')}`,title=(kind,field)=>i===0?marker(field):`Proof ${kind} ${String(i).padStart(2,'0')}`
  insert('accounts',{id:id(6),slug:slug('account'),name:title('account','accountname')})
  insert('requesters',{id:id(7),display_name:title('requester','requestername')})
  insert('requester_addresses',{id:id(10),requester_id:id(7),email:i===0?`${marker('requesteremail')}@example.test`:`proof-${i}@example.test`,verified_at:now})
  insert('requester_account_links',{requester_id:id(7),account_id:id(6),created_at:now},false)
  insert('requests',{id:id(1),slug:slug('request'),board_id:proofId(8),author_requester_id:id(7),title:title('request','requesttitle'),description:i===0?marker('requestdescription'):'Private request wording',moderation_state:'awaiting_review',public_state:'unpublished'})
  insert('evidence_items',{id:id(2),source_type:'interview',observed_at:now,review_state:'unreviewed',account_id:id(6),requester_id:id(7),recorded_by_operator_id:operator.id})
  insert('evidence_versions',{id:id(11),evidence_id:id(2),version_number:1,wording:title('evidence','evidencewording')})
  insert('request_evidence_links',{request_id:id(1),evidence_id:id(2),created_at:now},false)
  insert('decisions',{id:id(3),slug:slug('decision'),title:`Proof decision ${i}`,question:title('decision','decisionquestion'),rationale:i===0?marker('decisionrationale'):'Private rationale',state:'draft',owner_operator_id:operator.id})
  insert('roadmap_items',{id:id(4),slug:slug('roadmap'),title:title('roadmap','roadmaptitle'),summary:i===0?marker('roadmapsummary'):'Private roadmap summary',status:'exploring',decision_id:id(3)})
  insert('roadmap_request_mappings',{roadmap_item_id:id(4),request_id:id(1),approved_at:null,withdrawn_at:null})
  insert('releases',{id:id(5),slug:slug('release'),state:'draft',author_operator_id:operator.id,current_version_id:id(12)})
  insert('release_versions',{id:id(12),release_id:id(5),version_number:1,title:title('release','releasetitle'),release_type:'new',body:i===0?marker('releasebody'):'Private release body',outcome_prompt:'What changed?',subject_tags_json:'[]',is_portal_current:0})
  insert('release_targets',{release_id:id(5),roadmap_item_id:id(4),decision_id:id(3)})
  if(i<53){insert('request_tag_assignments',{request_id:id(1),tag_id:proofId(9),created_at:now},false);insert('evidence_tag_assignments',{evidence_id:id(2),tag_id:proofId(9),created_at:now},false)}
  if(i<5)insert('requester_update_permissions',{id:id(13),requester_id:id(7),requester_address_id:id(10),request_id:id(1),source:'submission',granted_at:now})
 }
 insert('request_comments',{id:proofId(14),request_id:proofId(1,1),requester_id:proofId(7,1),body:'Proof held comment',moderation_state:'awaiting_review'})
 // D1 statement batches stay small; there is no synthetic app endpoint.
 for(let i=0;i<pending.length;i+=50)await db.batch(pending.slice(i,i+50))
}
