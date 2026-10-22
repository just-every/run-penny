/** Small, hand-computed fixtures used only by Worker/browser acceptance tests. */
export async function seedOverviewAttention(db) {
  const now = new Date().toISOString()
  const insert = async (table, row) => {
    const values = { ...row, created_at: now, updated_at: now }
    await db.prepare(`INSERT INTO ${table}(${Object.keys(values).join(',')}) VALUES(${Object.keys(values).map(() => '?').join(',')})`).bind(...Object.values(values)).run()
  }
  await insert('operators',{id:'attention-operator',email:'attention@example.test',display_name:'Attention owner'})
  if (!await db.prepare("SELECT id FROM boards WHERE slug='attention-board'").first()) await insert('boards',{id:'attention-board',slug:'attention-board',name:'Attention board',visibility:'public',position:0})
  const board = await db.prepare("SELECT id FROM boards WHERE slug='attention-board'").first()
  await insert('requesters',{id:'attention-blocked',display_name:'Blocked',blocked_at:now})
  for (const [slug, extra] of [['attention-request',{}],['attention-withdrawn',{withdrawn_at:now}],['attention-blocked-request',{author_requester_id:'attention-blocked'}],['attention-merged',{merged_into_request_id:'attention-request'}]])
    await insert('requests',{id:slug,slug,board_id:board.id,title:slug,description:'Customer wording',moderation_state:'awaiting_review',public_state:'unpublished',...extra})
  await insert('evidence_items',{id:'attention-evidence',source_type:'interview',observed_at:now,review_state:'unreviewed'})
  await insert('evidence_versions',{id:'attention-evidence-version',evidence_id:'attention-evidence',version_number:1,wording:'Customers need a clear delivery promise.'})
  await insert('decisions',{id:'attention-decision',slug:'attention-decision',title:'Which promise?',question:'Which promise?',state:'ready',owner_operator_id:'attention-operator'})
  for(const [id,status] of [['attention-planned','planned'],['attention-progress','in_progress'],['attention-shipped','shipped'],['attention-released','shipped']])
    await insert('roadmap_items',{id,slug:id,title:id,summary:'Customer problem',status,decision_id:'attention-decision'})
  await insert('roadmap_publications',{id:'attention-approval',roadmap_item_id:'attention-planned',public_title:'Customer promise',public_summary:'Customer problem',approved_by_operator_id:'attention-operator',approved_at:now,board_id:board.id})
  await insert('roadmap_transitions',{id:'attention-transition',roadmap_item_id:'attention-planned',to_status:'planned',reason:'Delivery decision',actor_operator_id:'attention-operator'})
  const approval = await db.prepare("SELECT public_slug FROM roadmap_publications WHERE id='attention-approval'").first()
  await insert('roadmap_update_versions',{id:'attention-update',transition_id:'attention-transition',roadmap_item_id:'attention-planned',author_operator_id:'attention-operator',version_number:1,public_status:'planned',title:'Customer promise',problem:'Customer problem',body:'Customer promise: Planned',public_slug:approval.public_slug,approval_id:'attention-approval',approval_at:now,approval_updated_at:now})
  for (const [id,state,target] of [['attention-draft-release','draft','attention-shipped'],['attention-published-release','published','attention-released'],['attention-old-release','published','attention-released']]) {
    await insert('releases',{id,slug:id,state,author_operator_id:'attention-operator',current_version_id:id+'-version',published_at:state==='published'?(id==='attention-old-release'?new Date(Date.now()-40*86400000).toISOString():now):null})
    await insert('release_versions',{id:id+'-version',release_id:id,version_number:1,title:id,release_type:'new',body:'Customer-safe release',outcome_prompt:'Tell us how it went',subject_tags_json:'[]',is_portal_current:state==='published'?1:0})
    await insert('release_targets',{release_id:id,roadmap_item_id:target,decision_id:'attention-decision'})
  }
  await insert('requesters',{id:'attention-outcome-person',display_name:'Reporting participant'})
  for(const [revision,outcome] of [[1,'adopted'],[2,'partly_adopted']])await insert('release_outcomes',{id:`attention-outcome-${revision}`,release_version_id:'attention-published-release-version',requester_id:'attention-outcome-person',roadmap_item_id:'attention-released',outcome,revision_number:revision})
}

export async function duplicateOverviewAttention(db) {
  const clone = async (table, id, changes) => {
    const row = {...await db.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(id).first(),...changes}
    await db.prepare(`INSERT INTO ${table}(${Object.keys(row).join(',')}) VALUES(${Object.keys(row).map(()=>'?').join(',')})`).bind(...Object.values(row)).run()
  }
  await clone('requests','attention-request',{id:'second-request',slug:'second-request'})
  await clone('evidence_items','attention-evidence',{id:'second-evidence'})
  await clone('evidence_versions','attention-evidence-version',{id:'second-evidence-version',evidence_id:'second-evidence'})
  await clone('decisions','attention-decision',{id:'second-decision',slug:'second-decision'})
  await clone('roadmap_items','attention-shipped',{id:'second-shipped',slug:'second-shipped'})
  await clone('roadmap_transitions','attention-transition',{id:'second-transition'})
  await clone('roadmap_update_versions','attention-update',{id:'second-update',transition_id:'second-transition',version_number:2})
}

/** MEAS-006: counts below are hand computed, independent of the production SQL. */
export const loopHealthProof = {
  summary:{ownership:{owned:3,total:5,share:0.6},firstResponse:{medianSeconds:10800,responded:2,total:5},notified:{notified:1,total:3,share:1/3},promises:{atRisk:2}},
  records:{
    ownership:['loop-health-comment','loop-health-status','loop-health-delivered','loop-health-accepted','loop-health-no-snapshot'],
    response:['loop-health-comment','loop-health-status'],
    notified:['loop-health-delivered','loop-health-accepted','loop-health-no-snapshot'],
    promises:['loop-health-overdue','loop-health-dependent'],
  },
}

export async function seedLoopHealth(db) {
  const clock=new Date(),captured=new Date(clock.getTime()-7*86400000).toISOString()
  const pastMonth=new Date(Date.UTC(clock.getUTCFullYear(),clock.getUTCMonth()-1,1)).toISOString().slice(0,7),futureMonth=new Date(Date.UTC(clock.getUTCFullYear(),clock.getUTCMonth()+2,1)).toISOString().slice(0,7)
  const insert=async(table,row)=>{
    const values={created_at:captured,updated_at:captured,...row}
    await db.prepare(`INSERT INTO ${table}(${Object.keys(values).join(',')}) VALUES(${Object.keys(values).map(()=>'?').join(',')})`).bind(...Object.values(values)).run()
  }
  const board=await db.prepare("SELECT id FROM boards WHERE slug='attention-board'").first()
  await insert('operators',{id:'loop-health-operator',email:'loop-health@example.test',display_name:'Maya Patel'})
  for(const id of ['loop-health-recipient-one','loop-health-recipient-two','loop-health-blocked']) {
    await insert('requesters',{id,display_name:id,blocked_at:id==='loop-health-blocked'?captured:null})
    if(id!=='loop-health-blocked')await insert('requester_addresses',{id:id+'-address',requester_id:id,email:id+'@example.test',verified_at:captured})
  }
  for(const id of loopHealthProof.records.ownership) {
    const state=['loop-health-delivered','loop-health-accepted','loop-health-no-snapshot'].includes(id)?'shipped':'open'
    await insert('requests',{id,slug:id,board_id:board.id,title:({'loop-health-comment':'Schedule monthly finance exports','loop-health-status':'Show onboarding progress','loop-health-delivered':'Export invoices as a CSV','loop-health-accepted':'Filter reports by department','loop-health-no-snapshot':'Restore archived dashboards'})[id],description:'Help our team finish the monthly reporting workflow',moderation_state:'approved',public_state:state,public_title:({'loop-health-comment':'Schedule monthly finance exports','loop-health-status':'Show onboarding progress','loop-health-delivered':'Export invoices as a CSV','loop-health-accepted':'Filter reports by department','loop-health-no-snapshot':'Restore archived dashboards'})[id],public_description:'Help our team finish the monthly reporting workflow',published_at:captured})
  }
  for(const [id,extra] of [['loop-health-withdrawn',{withdrawn_at:captured}],['loop-health-merged',{merged_into_request_id:'loop-health-comment'}],['loop-health-blocked-request',{author_requester_id:'loop-health-blocked'}]])
    await insert('requests',{id,slug:id,board_id:board.id,title:id,description:'Excluded from current requests',moderation_state:'approved',public_state:'shipped',published_at:captured,...extra})
  for(const id of [...loopHealthProof.records.ownership.slice(0,3),'loop-health-withdrawn','loop-health-merged','loop-health-blocked-request'])
    await db.prepare('INSERT INTO penny_request_owners(request_id,operator_id,updated_at) VALUES(?,?,?)').bind(id,'loop-health-operator',captured).run()
  // Held and pre-capture replies do not start the clock; later replies count once.
  for(const [id,state,hour] of [['loop-health-held','awaiting_review',1],['loop-health-first','approved',2],['loop-health-later','approved',8],['loop-health-before','approved',-1]]) {
    const published=new Date(Date.parse(captured)+hour*3600000).toISOString()
    await insert('request_comments',{id,request_id:'loop-health-comment',operator_id:'loop-health-operator',body:'Public response fixture',moderation_state:state,published_at:published,created_at:published})
  }
  for(const hour of [9]) {
    const published=new Date(Date.parse(captured)+hour*3600000).toISOString()
    await insert('request_status_updates',{id:'loop-health-status-'+hour,request_id:'loop-health-status',public_status:'open',body:'Published status response',pinned:0,operator_id:'loop-health-operator',published_at:published,created_at:published})
  }
  await insert('releases',{id:'loop-health-release',slug:'loop-health-release',state:'published',author_operator_id:'loop-health-operator',current_version_id:'loop-health-version',published_at:captured})
  await insert('release_versions',{id:'loop-health-version',release_id:'loop-health-release',version_number:1,title:'Reporting improvements are live',release_type:'improved',body:'Delivered customer changes',outcome_prompt:'Did this help?',subject_tags_json:'[]',is_portal_current:1})
  // Two delivered recipients are needed for the first request. Provider acceptance
  // alone, and a shipped request without a snapshot, cannot claim notification.
  for(const [suffix,request,recipient,state] of [
    ['one','loop-health-delivered','loop-health-recipient-one','delivered'],
    ['two','loop-health-delivered','loop-health-recipient-two','delivered'],
    ['accepted','loop-health-accepted','loop-health-recipient-one','accepted'],
    ['accepted-delivered','loop-health-accepted','loop-health-recipient-two','delivered'],
  ]) {
    const version=suffix.startsWith('accepted')?'loop-health-accepted-version':'loop-health-version'
    if(suffix==='accepted')await insert('release_versions',{id:version,release_id:'loop-health-release',version_number:2,title:'Later release delivery',release_type:'improved',body:'Customer changes',outcome_prompt:'Did this help?',subject_tags_json:'[]',is_portal_current:0})
    await insert('release_recipient_snapshots',{id:'loop-health-snapshot-'+suffix,release_version_id:version,requester_id:recipient,requester_address_id:recipient+'-address',request_id:request})
    await insert('notification_outbox',{id:'loop-health-outbox-'+suffix,event_type:'release_published',subject_id:version,event_version:1,requester_id:recipient,address_id:recipient+'-address',release_snapshot_id:'loop-health-snapshot-'+suffix,dedupe_key:'loop-health-delivery-'+suffix,payload_json:'{}',delivery_state:state,available_at:captured,accepted_at:captured,delivered_at:state==='delivered'?captured:null})
  }
  for(const [id,eta,window] of [['loop-health-overdue',pastMonth,null],['loop-health-dependent',futureMonth,null],['loop-health-future',futureMonth,null],['loop-health-blocker',null,pastMonth]]) {
    await insert('roadmap_items',{id,slug:id,title:({'loop-health-overdue':'Publish the new billing dashboard','loop-health-dependent':'Launch team reporting','loop-health-future':'Add quarterly account summaries','loop-health-blocker':'Finish the reporting data model'})[id],summary:'Make monthly finance reporting simpler for customer teams',status:'planned',target_window:window})
    if(eta)await insert('roadmap_publications',{id:id+'-approval',roadmap_item_id:id,public_title:id,public_summary:'Approved promise',public_eta:eta,approved_by_operator_id:'loop-health-operator',approved_at:captured,board_id:board.id})
  }
  // Match the production many-to-many snapshot contexts and a published
  // ROAD-008 response. The direct status update at +9h must not replace +4h.
  await insert('decisions',{id:'loop-health-decision',slug:'loop-health-decision',title:'Improve delivery',question:'What should ship?',state:'committed'})
  await insert('roadmap_items',{id:'loop-health-release-target',slug:'loop-health-release-target',title:'Delivered improvements',summary:'Shipped customer changes',status:'shipped',decision_id:'loop-health-decision'})
  await insert('roadmap_publications',{id:'loop-health-response-approval',roadmap_item_id:'loop-health-release-target',public_title:'Delivered improvements',public_summary:'Customer-safe changes',approved_by_operator_id:'loop-health-operator',approved_at:captured,board_id:board.id})
  const approval=await db.prepare("SELECT public_slug FROM roadmap_publications WHERE id='loop-health-response-approval'").first()
  const responseAt=new Date(Date.parse(captured)+4*3600000).toISOString()
  await insert('roadmap_transitions',{id:'loop-health-response-transition',roadmap_item_id:'loop-health-release-target',to_status:'shipped',reason:'Ready for customers',actor_operator_id:'loop-health-operator'})
  await insert('roadmap_update_versions',{id:'loop-health-response-version',transition_id:'loop-health-response-transition',roadmap_item_id:'loop-health-release-target',author_operator_id:'loop-health-operator',version_number:1,public_status:'shipped',title:'Delivered improvements',problem:'Customer-safe changes',body:'The improvements are ready',public_slug:approval.public_slug,approval_id:'loop-health-response-approval',approval_at:captured,approval_updated_at:captured,published_at:responseAt})
  await insert('roadmap_update_histories',{id:'loop-health-response-history',version_id:'loop-health-response-version',request_id:'loop-health-status'})
  await db.prepare("INSERT INTO release_recipient_contexts(snapshot_id,request_id,roadmap_item_id,title,slug,created_at,updated_at) SELECT id,request_id,'loop-health-release-target',request_id,request_id,?,? FROM release_recipient_snapshots WHERE id LIKE 'loop-health-%'").bind(captured,captured).run()
  for(const dependent of ['loop-health-overdue','loop-health-dependent'])
    await db.prepare('INSERT INTO penny_roadmap_dependencies(blocker_id,dependent_id,created_at) VALUES(?,?,?)').bind('loop-health-blocker',dependent,captured).run()
}

export async function clearLoopHealth(db) {
  // Real publication triggers create notification and integration events.
  // Remove those fixture-owned children before their source records.
  const tables=[
    ['release_recipient_contexts','snapshot_id'],['notification_outbox','id'],['release_recipient_snapshots','id'],['release_versions','id'],['releases','id'],
    ['penny_integration_events','request_id'],['notification_events','request_id'],['request_comments','id'],['request_status_updates','id'],['roadmap_update_histories','id'],['roadmap_update_versions','id'],['roadmap_transitions','id'],['roadmap_publications','id'],['roadmap_items','id'],['decisions','id'],
    ['requests','id'],['requester_addresses','id'],['requesters','id'],['operators','id'],
  ]
  for(const [table,column] of tables)await db.prepare(`DELETE FROM ${table} WHERE ${column} LIKE 'loop-health-%'`).run()
}
