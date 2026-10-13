import assert from 'node:assert/strict'
import test from 'node:test'
import {createHash} from 'node:crypto'
import {readFile,readdir} from 'node:fs/promises'
import {migrate} from '../../base/modules/deploy-kit/migrations.mjs'
import {sqliteProvider} from './sqlite-provider.mjs'
const dir=new URL('../../migrations/core/',import.meta.url)
const migrations=await Promise.all((await readdir(dir)).filter(n=>n.endsWith('.sql')).sort().map(async name=>{const sql=await readFile(new URL(name,dir),'utf8');return {name,sql,sha256:createHash('sha256').update(sql).digest('hex')}}))
test('[BASE-OPS-002 BASE-ACCESS-002 NOTIFY-002] 0011 to local auth upgrade preserves prior event custody and repeats without writes',async t=>{
 const {db,api,id,writes}=sqliteProvider(t)
 await migrate(api,id,migrations.filter(m=>m.name<'0012'))
 db.exec(`INSERT INTO oa_operators VALUES('owner','owner@example.test','Owner','owner','active',1,100);
 INSERT INTO oa_operators VALUES('invite','invite@example.test','Invite','member','invited',1,100);
 INSERT INTO oa_bootstrap VALUES(1,'claim',100);
 INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES('session','hash','owner',1,'native',100,9999999999999);
 INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES('person','Person','stamp','stamp');
 INSERT INTO requester_addresses(id,requester_id,email,verified_at,created_at,updated_at) VALUES('address','person','person@example.test','stamp','stamp','stamp');
 INSERT INTO boards(id,slug,name,visibility,position,created_at,updated_at) VALUES('board','board','Board','public',0,'stamp','stamp');
 INSERT INTO requests(id,slug,board_id,title,description,moderation_state,public_state,published_at,created_at,updated_at) VALUES('request','request','board','Title','Description','approved','open','stamp','stamp','stamp');
 INSERT INTO notification_events(id,request_id,kind,subject_id,body,created_at,updated_at) VALUES('event','request','status','update','Published update','stamp','stamp');
 INSERT INTO notification_batches(id,requester_id,address_id,request_id,first_event_id,window_start,window_end,state,next_attempt_at,created_at,updated_at) VALUES('batch','person','address','request','event','stamp','stamp','accepted','stamp','stamp','stamp');
 INSERT INTO notification_attempts(id,batch_id,provider,state,provider_message_id,recipient_email,event_message_id,created_at,updated_at) VALUES('attempt','batch','sendgrid','accepted','receipt','person@example.test','message','stamp','stamp');
 INSERT INTO mail_event_records VALUES('receipt','{"recipient":"person@example.test"}','address','batch','stamp','stamp');
 INSERT INTO notification_link_epochs VALUES('address','all',3,'stamp','stamp');`)
 const tables=['oa_operators','oa_bootstrap','oa_sessions','requesters','requester_addresses','boards','requests','notification_events','notification_batches','notification_attempts','mail_event_records','notification_link_epochs']
 const before=Object.fromEntries(tables.map(table=>[table,db.prepare(`SELECT * FROM ${table}`).all()]))
 const applied=(await migrate(api,id,migrations)).applied
 assert.equal(applied[0],'0012_base_local_auth.sql')
 assert.deepEqual(applied,migrations.filter(m=>m.name>='0012').map(m=>m.name),'every later additive migration is applied once, in order')
 // Later additive migrations may add columns; every column present before must be unchanged.
 for(const table of tables)assert.deepEqual(db.prepare(`SELECT ${before[table].length?Object.keys(before[table][0]).join(','):'*'} FROM ${table}`).all(),before[table],table)
 for(const table of ['oa_invitation_cancellations','rer_mail_development_outbox'])assert.equal(db.prepare(`SELECT count(*) n FROM ${table}`).get().n,0)
 db.exec("UPDATE oa_operators SET status='inactive' WHERE id='invite'")
 assert.equal(db.prepare("SELECT operator_id FROM oa_invitation_cancellations").get().operator_id,'invite')
 assert.throws(()=>db.exec("UPDATE oa_operators SET status='active' WHERE id='invite'"),/invitation_required/)
 assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[])
 assert.deepEqual(db.prepare('SELECT name,sha256 FROM _rer_deploy_migrations ORDER BY name').all().map(row=>({...row})),migrations.map(({name,sha256})=>({name,sha256})))
 const count=writes.length;assert.deepEqual((await migrate(api,id,migrations)).applied,[]);assert.equal(writes.length,count)
})
