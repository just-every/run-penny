import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readdir,readFile} from 'node:fs/promises'
import test from 'node:test'
import {migrate} from '../../base/modules/deploy-kit/migrations.mjs'
import {sqliteProvider} from './sqlite-provider.mjs'
const directory=new URL('../../migrations/core/',import.meta.url)
const migrations=await Promise.all((await readdir(directory)).filter(n=>n.endsWith('.sql')&&n<='0013_decision_loop.sql').sort().map(async name=>{const sql=await readFile(new URL(name,directory),'utf8');return{name,sql,sha256:createHash('sha256').update(sql).digest('hex')}}))
const stamp='2026-10-08T00:00:00Z'
test('[EVID-002][DEC-004][ROAD-004][BASE-OPS-002] populated prior schema upgrades additively with old rows, snapshot, declined item, account links and withdrawn mapping intact',async t=>{
 const {api,id,db,writes}=sqliteProvider(t)
 await migrate(api,id,migrations.filter(m=>m.name<'0013'))
 const insert=(table,row)=>{const keys=Object.keys(row);db.prepare(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).run(...Object.values(row))}
 const timestamps={created_at:stamp,updated_at:stamp}
 insert('operators',{id:'op',email:'upgrade-owner@example.invalid',display_name:'Upgrade owner',...timestamps})
 insert('accounts',{id:'account',slug:'private-account',name:'Account exact',revenue_cents:123456,...timestamps})
 insert('requesters',{id:'requester',display_name:'Requester exact',...timestamps})
 insert('requester_account_links',{requester_id:'requester',account_id:'account',created_at:stamp})
 insert('boards',{id:'board',slug:'board',name:'Board',visibility:'public',position:0,...timestamps})
 for(const id of ['active','withdrawn'])insert('requests',{id,slug:id,board_id:'board',title:'Exact title '+id,description:'Exact problem',moderation_state:'approved',public_state:'open',public_title:'Safe '+id,public_description:'Safe problem',published_at:stamp,...timestamps})
 insert('evidence_items',{id:'evidence',source_type:'interview',source_label:'Exact source',account_id:'account',requester_id:'requester',recorded_by_operator_id:'op',observed_at:stamp,review_state:'reviewed',review_reason:'Exact review',...timestamps})
 insert('evidence_versions',{id:'version',evidence_id:'evidence',version_number:1,wording:'  Exact original\nwords. ',edited_by_operator_id:'op',...timestamps})
 insert('decisions',{id:'decision',slug:'decision',title:'Exact question',question:'Exact question?',state:'committed',owner_operator_id:'op',confidence:'medium',rationale:'Exact rationale',review_at:'2026-12-01',...timestamps})
 for(const id of ['selected','declined'])insert('candidate_bets',{id,decision_id:'decision',title:'Exact '+id,summary:'Exact summary',urgency:'Exact urgency',delivery_shape:'Exact shape',success_measure:'Exact measure',...timestamps})
 db.prepare("UPDATE decisions SET selected_candidate_bet_id='selected' WHERE id='decision'").run()
 insert('candidate_bet_account_links',{candidate_bet_id:'selected',account_id:'account',created_at:stamp})
 insert('candidate_bet_evidence_links',{candidate_bet_id:'selected',evidence_id:'evidence',stance:'supporting',created_at:stamp})
 insert('request_evidence_links',{request_id:'active',evidence_id:'evidence',created_at:stamp})
 insert('decision_revisions',{id:'revision',decision_id:'decision',revision_number:1,selected_candidate_bet_id:'selected',rationale:'Exact rationale',confidence:'medium',review_at:'2026-12-01',committed_by_operator_id:'op',...timestamps})
 insert('decision_evidence_snapshots',{id:'snapshot',decision_revision_id:'revision',evidence_id:'evidence',evidence_version_id:'version',candidate_bet_id:'selected',stance:'supporting',...timestamps})
 for(const id of ['selected','declined'])insert('roadmap_items',{id:'item-'+id,slug:'PRIVATE-'+id,decision_id:'decision',candidate_bet_id:id,title:'Exact item '+id,summary:'Exact private summary',status:id==='selected'?'planned':'shipped',owner_operator_id:'op',target_window:'Exact target',delivery_notes:'Exact notes',confidence:'low',...timestamps})
 insert('roadmap_items',{id:'historical-duplicate',slug:'historical-duplicate',decision_id:'decision',candidate_bet_id:'selected',title:'Historical duplicate',summary:'Preserve exact row',status:'exploring',...timestamps})
 insert('roadmap_publications',{id:'publication',roadmap_item_id:'item-selected',public_title:'Safe title',public_summary:'Safe summary',approved_by_operator_id:'op',approved_at:stamp,...timestamps})
 for(const id of ['active','withdrawn'])insert('roadmap_request_mappings',{roadmap_item_id:'item-selected',request_id:id,approved_at:stamp,withdrawn_at:id==='withdrawn'?stamp:null,...timestamps})
 const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name!='_rer_deploy_migrations'").all().map(r=>r.name)
 const before=Object.fromEntries(tables.map(name=>[name,{columns:db.prepare(`PRAGMA table_info(${name})`).all().map(c=>c.name),rows:db.prepare(`SELECT * FROM ${name}`).all()}]))
 assert.deepEqual((await migrate(api,id,migrations)).applied,['0013_decision_loop.sql'])
 for(const [table,{columns,rows}] of Object.entries(before))assert.deepEqual(db.prepare(`SELECT ${columns.join(',')} FROM ${table}`).all(),rows,`${table} old values unchanged`)
 assert.throws(()=>insert('roadmap_items',{id:'new-duplicate',slug:'new-duplicate',candidate_bet_id:'selected',title:'New duplicate',summary:'Refused',status:'exploring',...timestamps}),/Bet already has a roadmap item/)
 assert.throws(()=>db.prepare("UPDATE roadmap_items SET candidate_bet_id='selected' WHERE id='item-declined'").run(),/Bet already has a roadmap item/)
 assert.match(db.prepare('SELECT public_slug FROM roadmap_publications').get().public_slug,/^roadmap-[a-f0-9]{32}$/)
 assert.equal(db.prepare('SELECT board_id FROM roadmap_publications').get().board_id,null,'upgrade does not infer a newly approved board')
 assert.equal(db.prepare('SELECT named_speaker FROM evidence_items').get().named_speaker,null)
 assert.equal(db.prepare('SELECT stance FROM request_evidence_links').get().stance,'supporting')
 assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[])
 const count=writes.length;assert.deepEqual((await migrate(api,id,migrations)).applied,[]);assert.equal(writes.length,count)
 const guarded=['decision_bet_snapshots','roadmap_mapping_history','roadmap_update_versions','roadmap_update_targets','roadmap_evidence_links']
 for(const table of guarded)assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='trigger' AND tbl_name=? AND name LIKE 'data_guard_%'").get(table).n,3)
})
