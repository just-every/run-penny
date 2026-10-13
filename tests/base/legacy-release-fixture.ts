// Historical rows for the 0016 upgrade boundary; never run today's publication or mail drain here.
export async function populateLegacyRelease(db:D1Database,requestId:string,now:string){
 const actor=(await db.prepare('SELECT id,display_name FROM operators LIMIT 1').first<{id:string;display_name:string}>())!
 const request=(await db.prepare('SELECT slug,public_title,author_requester_id FROM requests WHERE id=?').bind(requestId).first<{slug:string;public_title:string;author_requester_id:string}>())!
 const address=(await db.prepare('SELECT id,email,verification_epoch FROM requester_addresses WHERE requester_id=? AND verified_at IS NOT NULL AND suppressed_at IS NULL LIMIT 1').bind(request.author_requester_id).first<{id:string;email:string;verification_epoch:number}>())!
 const stamped=(row:Record<string,string|number>)=>({...row,created_at:now,updated_at:now})
 const insert=async(table:string,row:Record<string,string|number>)=>{
  const columns=Object.keys(row)
  await db.prepare(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`).bind(...Object.values(row)).run()
 }
 const id='import-upgrade-release',versionId=id+'-version',itemId=id+'-item',decisionId=id+'-decision',approvalId=id+'-approval',snapshotId=id+'-recipient',outboxId=id+'-delivery',attemptId=id+'-attempt',tagId=id+'-tag'
 const title='Workflow improvement',body='Customer-safe release details.'
 await insert('tags',stamped({id:tagId,name:'Workflow'}))
 await insert('decisions',stamped({id:decisionId,slug:decisionId,title:'Private decision marker',question:'Private question',state:'committed',rationale:'Private commercial rationale'}))
 await insert('roadmap_items',stamped({id:itemId,slug:itemId,decision_id:decisionId,title:'Private item title',summary:'Private item summary',status:'shipped',delivery_notes:'Private delivery notes'}))
 await insert('roadmap_publications',stamped({id:approvalId,roadmap_item_id:itemId,public_title:'Approved improvement',public_summary:'Approved problem',public_slug:'safe-roadmap-token',approved_by_operator_id:actor.id,approved_at:now}))
 await insert('roadmap_request_mappings',stamped({roadmap_item_id:itemId,request_id:requestId,approved_at:now}))
 await insert('releases',stamped({id,slug:id,state:'published',current_version_id:versionId,author_operator_id:actor.id,published_at:now}))
 await insert('release_versions',stamped({id:versionId,release_id:id,version_number:1,title,release_type:'improved',body,publication_date:'2026-10-08',setup_url:'https://example.test/help',outcome_prompt:'Did this help?',subject_tags_json:JSON.stringify([tagId]),is_portal_current:1,author_name:actor.display_name,tag_names_json:'["Workflow"]',publication_claim:id+'-claim'}))
 await insert('release_targets',stamped({release_id:id,roadmap_item_id:itemId,decision_id:decisionId,approval_id:approvalId,approval_at:now,approval_updated_at:now,public_title:'Approved improvement',public_summary:'Approved problem',public_slug:'safe-roadmap-token'}))
 await insert('release_draft_mappings',stamped({release_id:id,roadmap_item_id:itemId,request_id:requestId,approval_at:now,approval_updated_at:now}))
 await insert('release_target_snapshots',stamped({version_id:versionId,roadmap_item_id:itemId,decision_id:decisionId,request_id:requestId}))
 await insert('release_recipient_snapshots',stamped({id:snapshotId,release_version_id:versionId,requester_id:request.author_requester_id,requester_address_id:address.id,request_id:requestId,recipient_email:address.email,verification_epoch:address.verification_epoch}))
 await insert('release_recipient_contexts',stamped({snapshot_id:snapshotId,request_id:requestId,roadmap_item_id:itemId,title:request.public_title,slug:request.slug}))
 await db.prepare('UPDATE release_versions SET snapshot_sealed_at=? WHERE id=?').bind(now,versionId).run()
 // This records a historical accepted fixture attempt, not a new provider request or delivery claim.
 await insert('notification_outbox',stamped({id:outboxId,event_type:'release_version',subject_id:versionId,event_version:1,requester_id:request.author_requester_id,dedupe_key:outboxId,payload_json:'{}',delivery_state:'accepted',available_at:now,address_id:address.id,release_snapshot_id:snapshotId,claim_id:attemptId,provider:'sendgrid',provider_message_id:'fixture-historical-acceptance',first_attempt_at:now,accepted_at:now,attempt_count:1}))
 await insert('notification_outbox_attempts',stamped({id:attemptId,outbox_id:outboxId,provider:'sendgrid',state:'accepted',provider_message_id:'fixture-historical-acceptance',recipient_email:address.email,recipient_verification_epoch:address.verification_epoch}))
 return {slug:id,title,body}
}
