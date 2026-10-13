import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { readFile,readdir } from 'node:fs/promises'
import { migrate } from '../../base/modules/deploy-kit/migrations.mjs'
import { sqliteProvider } from './sqlite-provider.mjs'
const dir=new URL('../../migrations/core/',import.meta.url)
const migrations=await Promise.all((await readdir(dir)).filter(n=>n.endsWith('.sql')).sort().map(async name=>{const sql=await readFile(new URL(name,dir),'utf8');return {name,sql,sha256:createHash('sha256').update(sql).digest('hex')}}))
const stamp='2026-10-07T09:00:00.000Z'
test('[REL-011 NOTIFY-002 BASE-OPS-002] complete current history upgrades prior notification data without replay, repeats without writes, retains all hashes',async t=>{
 const {db,api,id,writes}=sqliteProvider(t)
 await migrate(api,id,migrations.filter(m=>m.name<'0011'))
 db.exec(`INSERT INTO operators(id,email,display_name,created_at,updated_at) VALUES('operator','owner@example.invalid','Owner','${stamp}','${stamp}');
 INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES('person','Person','${stamp}','${stamp}');
 INSERT INTO requester_addresses(id,requester_id,email,verified_at,created_at,updated_at) VALUES('address','person','person@example.invalid','${stamp}','${stamp}','${stamp}');
 INSERT INTO boards(id,slug,name,visibility,position,created_at,updated_at) VALUES('board','board','Board','public',0,'${stamp}','${stamp}');
 INSERT INTO requests(id,slug,board_id,title,description,moderation_state,public_state,published_at,created_at,updated_at) VALUES('request','request','board','Title','Description','approved','open','${stamp}','${stamp}','${stamp}');
 INSERT INTO request_follows(request_id,requester_id,permission_granted_at,created_at,updated_at) VALUES('request','person','${stamp}','${stamp}','${stamp}');
 INSERT INTO requester_update_permissions(id,requester_id,requester_address_id,request_id,source,granted_at,created_at,updated_at) VALUES('permission','person','address','request','follow','${stamp}','${stamp}','${stamp}');
 INSERT INTO notification_outbox(id,event_type,subject_id,event_version,requester_id,dedupe_key,payload_json,delivery_state,available_at,created_at,updated_at) VALUES('legacy','request.status','request',1,'person','legacy','{}','queued','${stamp}','${stamp}','${stamp}');
 INSERT INTO request_status_updates(id,request_id,public_status,body,pinned,operator_id,published_at,created_at,updated_at) VALUES('event','request','under_review','Update',0,'operator','${stamp}','${stamp}','${stamp}');
 INSERT INTO notification_batches(id,requester_id,address_id,request_id,first_event_id,window_start,window_end,state,next_attempt_at,created_at,updated_at) VALUES('batch','person','address','request','event','${stamp}','${stamp}','accepted','${stamp}','${stamp}','${stamp}');
 UPDATE notification_intents SET batch_id='batch';
 INSERT INTO notification_attempts(id,batch_id,provider,state,provider_message_id,created_at,updated_at) VALUES('attempt','batch','sendgrid','accepted','receipt','${stamp}','${stamp}');`)
 db.prepare('UPDATE requester_addresses SET suppressed_at=? WHERE id=?').run(stamp,'address')
 const tables=['requesters','requester_addresses','requests','request_follows','requester_update_permissions','notification_outbox','notification_events','notification_intents','notification_batches','notification_attempts']
 const before=Object.fromEntries(tables.map(table=>[table,db.prepare(`SELECT * FROM ${table}`).all()]))
 const applied=(await migrate(api,id,migrations)).applied
 assert.deepEqual(applied.slice(0,2),['0011_notification_delivery_events.sql','0012_base_local_auth.sql'])
 assert.deepEqual(applied,migrations.filter(m=>m.name>='0011').map(m=>m.name),'every later additive migration is applied once, in order')
 for(const table of tables){const after=db.prepare(`SELECT ${Object.keys(before[table][0]).join(',')} FROM ${table}`).all();assert.deepEqual(after,before[table],table)}
 assert.deepEqual({...db.prepare('SELECT recipient_email,event_message_id FROM notification_attempts').get()},{recipient_email:null,event_message_id:null})
 assert.equal(db.prepare('SELECT suppressed_at FROM requester_update_permissions').get().suppressed_at,stamp)
 for(const table of ['notification_link_epochs','mail_event_records'])assert.equal(db.prepare(`SELECT count(*) n FROM ${table}`).get().n,0)
 assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[])
 assert.deepEqual(db.prepare('SELECT name,sha256 FROM _rer_deploy_migrations ORDER BY name').all().map(row=>({...row})),migrations.map(({name,sha256})=>({name,sha256})))
 const count=writes.length;assert.deepEqual((await migrate(api,id,migrations)).applied,[]);assert.equal(writes.length,count)
})
