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
  for(const [id,status] of [['attention-planned','planned'],['attention-shipped','shipped'],['attention-released','shipped']])
    await insert('roadmap_items',{id,slug:id,title:id,summary:'Customer problem',status,decision_id:'attention-decision'})
  await insert('roadmap_publications',{id:'attention-approval',roadmap_item_id:'attention-planned',public_title:'Customer promise',public_summary:'Customer problem',approved_by_operator_id:'attention-operator',approved_at:now,board_id:board.id})
  await insert('roadmap_transitions',{id:'attention-transition',roadmap_item_id:'attention-planned',to_status:'planned',reason:'Delivery decision',actor_operator_id:'attention-operator'})
  const approval = await db.prepare("SELECT public_slug FROM roadmap_publications WHERE id='attention-approval'").first()
  await insert('roadmap_update_versions',{id:'attention-update',transition_id:'attention-transition',roadmap_item_id:'attention-planned',author_operator_id:'attention-operator',version_number:1,public_status:'planned',title:'Customer promise',problem:'Customer problem',body:'Customer promise: Planned',public_slug:approval.public_slug,approval_id:'attention-approval',approval_at:now,approval_updated_at:now})
  for (const [id,state,target] of [['attention-draft-release','draft','attention-shipped'],['attention-published-release','published','attention-released']]) {
    await insert('releases',{id,slug:id,state,author_operator_id:'attention-operator',current_version_id:id+'-version',published_at:state==='published'?now:null})
    await insert('release_versions',{id:id+'-version',release_id:id,version_number:1,title:id,release_type:'new',body:'Customer-safe release',outcome_prompt:'Tell us how it went',subject_tags_json:'[]',is_portal_current:state==='published'?1:0})
    await insert('release_targets',{release_id:id,roadmap_item_id:target,decision_id:'attention-decision'})
  }
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
