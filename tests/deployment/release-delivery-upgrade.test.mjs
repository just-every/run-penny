import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { readFile,readdir } from 'node:fs/promises'
import { migrate } from '../../base/modules/deploy-kit/migrations.mjs'
import { sqliteProvider } from './sqlite-provider.mjs'
const dir=new URL('../../migrations/core/',import.meta.url)
const migrations=await Promise.all((await readdir(dir)).filter(n=>n.endsWith('.sql')).sort().map(async name=>{const sql=await readFile(new URL(name,dir),'utf8');return {name,sql,sha256:createHash('sha256').update(sql).digest('hex')}}))
const stamp='2026-10-08T09:00:00.000Z'
test('[DATA-001 BASE-OPS-002 REL-007] release migration preserves every populated prior row and Base receipt, clean FKs, no historical resend and idempotent hashes',async t=>{
 const {db,api,id,writes}=sqliteProvider(t)
 await migrate(api,id,migrations.filter(m=>m.name<'0014'))
 db.exec(`INSERT INTO operators(id,email,display_name,created_at,updated_at) VALUES('operator','owner@example.invalid','Owner','${stamp}','${stamp}');
 INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES('person','Person','${stamp}','${stamp}');
 INSERT INTO requester_addresses(id,requester_id,email,verified_at,created_at,updated_at) VALUES('address','person','person@example.invalid','${stamp}','${stamp}','${stamp}');
 INSERT INTO boards(id,slug,name,visibility,position,created_at,updated_at) VALUES('board','board','Board','public',0,'${stamp}','${stamp}');
 INSERT INTO requests(id,slug,board_id,title,description,moderation_state,public_state,published_at,created_at,updated_at) VALUES('request','request','board','Title','Description','approved','open','${stamp}','${stamp}','${stamp}');
 INSERT INTO request_follows(request_id,requester_id,permission_granted_at,created_at,updated_at) VALUES('request','person','${stamp}','${stamp}','${stamp}');
 INSERT INTO requester_update_permissions(id,requester_id,requester_address_id,request_id,source,granted_at,created_at,updated_at) VALUES('permission','person','address','request','follow','${stamp}','${stamp}','${stamp}');
 INSERT INTO notification_outbox(id,event_type,subject_id,event_version,requester_id,dedupe_key,payload_json,delivery_state,available_at,created_at,updated_at) VALUES('legacy','release_version','historical',1,'person','legacy','{"recipient":"person@example.invalid"}','queued','${stamp}','${stamp}','${stamp}');
 INSERT INTO request_status_updates(id,request_id,public_status,body,pinned,operator_id,published_at,created_at,updated_at) VALUES('event','request','under_review','Update',0,'operator','${stamp}','${stamp}','${stamp}');
 INSERT INTO notification_batches(id,requester_id,address_id,request_id,first_event_id,window_start,window_end,state,next_attempt_at,created_at,updated_at) VALUES('batch','person','address','request','event','${stamp}','${stamp}','accepted','${stamp}','${stamp}','${stamp}');
 UPDATE notification_intents SET batch_id='batch';
 INSERT INTO notification_attempts(id,batch_id,provider,state,provider_message_id,recipient_email,event_message_id,recipient_verification_epoch,created_at,updated_at) VALUES('attempt','batch','sendgrid','accepted','receipt','person@example.invalid','webhook',0,'${stamp}','${stamp}');
 INSERT INTO mail_event_records(id,value_json,address_id,batch_id,created_at,updated_at) VALUES('old-receipt','{"recipient":"person@example.invalid"}','address','batch','${stamp}','${stamp}');`)
 const names=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_rer_%'").all().map(r=>r.name)
 const before=Object.fromEntries(names.map(name=>[name,db.prepare(`SELECT * FROM "${name}"`).all()]))
 assert.deepEqual((await migrate(api,id,migrations)).applied,migrations.filter(migration=>migration.name>='0014').map(migration=>migration.name))
 for(const [name,rows] of Object.entries(before)){if(!rows.length)continue;const actual=db.prepare(`SELECT ${Object.keys(rows[0]).map(c=>`"${c}"`).join(',')} FROM "${name}"`).all();assert.deepEqual(actual,rows,name)}
 assert.deepEqual({...db.prepare('SELECT release_snapshot_id,address_id,claim_id,provider,first_attempt_at FROM notification_outbox').get()},{release_snapshot_id:null,address_id:null,claim_id:null,provider:null,first_attempt_at:null})
 assert.equal(db.prepare("SELECT COUNT(*) n FROM notification_outbox WHERE event_type='release_version' AND release_snapshot_id IS NOT NULL AND delivery_state='queued'").get().n,0)
 assert.equal(db.prepare('SELECT outbox_id FROM mail_event_records').get().outbox_id,null)
 for(const name of ['data_wait_for_release_writers','release_identity_merge_guard','release_wording_immutable','roadmap_wording_immutable','release_recipient_contexts_immutable_update','data_guard_mail_event_records_insert']){
  const definition=db.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name=?").get(name)
  assert.ok(definition?.sql.includes('RAISE(ABORT'),name)
 }
 assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[])
 assert.deepEqual(db.prepare('SELECT name,sha256 FROM _rer_deploy_migrations ORDER BY name').all().map(row=>({...row})),migrations.map(({name,sha256})=>({name,sha256})))
 const count=writes.length;assert.deepEqual((await migrate(api,id,migrations)).applied,[]);assert.equal(writes.length,count)
})
