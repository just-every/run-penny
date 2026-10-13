import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import test from 'node:test'
import { migrate } from '../../base/modules/deploy-kit/migrations.mjs'
import { sqliteProvider } from './sqlite-provider.mjs'
const directory = new URL('../../migrations/core/', import.meta.url)
const migrations = await Promise.all((await readdir(directory)).filter(name=>name.endsWith('.sql')&&name<='0010_request_notifications.sql').sort().map(async name=>{
 const sql=await readFile(new URL(name,directory),'utf8')
 return {name,sql,sha256:createHash('sha256').update(sql).digest('hex')}
}))
const upgrade=migrations.find(m=>m.name==='0010_request_notifications.sql')
const stamp='2026-10-07T00:00:00.000Z'

test('[NOTIFY-001][BASE-OPS-002] historical migration profile through 0010 upgrades existing rows, preserves intent and captures only eligible published events',async t=>{
 const {api,id,db,writes}=sqliteProvider(t)
 assert.equal(migrations.length,10);assert(upgrade)
 await migrate(api,id,migrations.filter(m=>m.name<upgrade.name))
 db.prepare('INSERT INTO operators(id,email,display_name,created_at,updated_at) VALUES(?,?,?,?,?)').run('operator','fixture-owner@example.invalid','Owner',stamp,stamp)
 db.prepare('INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES(?,?,?,?)').run('requester','Requester',stamp,stamp)
 db.prepare('INSERT INTO requester_addresses(id,requester_id,email,verified_at,created_at,updated_at) VALUES(?,?,?,?,?,?)').run('address','requester','fixture-requester@example.invalid',stamp,stamp,stamp)
 db.prepare('INSERT INTO boards(id,slug,name,visibility,position,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run('board','board','Board','public',0,stamp,stamp)
 db.prepare("INSERT INTO requests(id,slug,board_id,title,description,moderation_state,public_state,published_at,created_at,updated_at) VALUES('request','request','board','Title','Description','approved','open',?,?,?)").run(stamp,stamp,stamp)
 db.prepare("INSERT INTO request_follows(request_id,requester_id,permission_granted_at,created_at,updated_at) VALUES('request','requester',?,?,?)").run(stamp,stamp,stamp)
 db.prepare("INSERT INTO requester_update_permissions(id,requester_id,requester_address_id,request_id,source,granted_at,created_at,updated_at) VALUES('permission','requester','address','request','follow',?,?,?)").run(stamp,stamp,stamp)
 db.prepare("INSERT INTO notification_outbox(id,event_type,subject_id,event_version,requester_id,dedupe_key,payload_json,delivery_state,available_at,created_at,updated_at) VALUES('historical','request.status','request',1,'requester','historical','{}','queued',?,?,?)").run(stamp,stamp,stamp)
 const before=db.prepare('SELECT * FROM requests').all()
 assert.deepEqual((await migrate(api,id,migrations)).applied,[upgrade.name])
 assert.deepEqual(db.prepare('SELECT * FROM requests').all(),before)
 assert.equal(db.prepare('SELECT COUNT(*) n FROM notification_events').get().n,0)
 assert.equal(db.prepare('SELECT COUNT(*) n FROM notification_intents').get().n,0)
 assert.equal(db.prepare('SELECT delivery_state FROM notification_outbox').get().delivery_state,'queued')
 assert.deepEqual(db.prepare('SELECT name,sha256,state FROM _rer_deploy_migrations ORDER BY name').all().map(row=>({...row})),migrations.map(({name,sha256})=>({name,sha256,state:'applied'})))
 const comments=db.prepare('INSERT INTO request_comments(id,request_id,requester_id,operator_id,body,moderation_state,published_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)')
 comments.run('held','request','requester',null,'Held private text','awaiting_review',null,stamp,stamp)
 assert.equal(db.prepare('SELECT COUNT(*) n FROM notification_events').get().n,0)
 db.prepare("UPDATE request_comments SET moderation_state='approved',published_at=? WHERE id='held'").run(stamp)
 comments.run('reply','request',null,'operator','Public reply','approved',stamp,stamp,stamp)
 const status=db.prepare("INSERT INTO request_status_updates(id,request_id,public_status,body,pinned,operator_id,published_at,created_at,updated_at) VALUES(?,'request','under_review','Public status',0,'operator',?,?,?)")
 status.run('status',stamp,stamp,stamp)
 assert.equal(db.prepare('SELECT COUNT(*) n FROM notification_events').get().n,3)
 assert.equal(db.prepare('SELECT COUNT(*) n FROM notification_intents').get().n,3)
 db.prepare("UPDATE request_comments SET moderation_state='approved',published_at=? WHERE id='held'").run(stamp)
 assert.equal(db.prepare('SELECT COUNT(*) n FROM notification_events').get().n,3)
 db.prepare("UPDATE boards SET visibility='internal' WHERE id='board'").run()
 status.run('private-status',stamp,stamp,stamp)
 assert.equal(db.prepare('SELECT COUNT(*) n FROM notification_intents').get().n,3)
 assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[])
 const count=writes.length
 assert.deepEqual((await migrate(api,id,migrations)).applied,[])
 assert.equal(writes.length,count,'complete history repeat must perform no SQL mutation')
})
