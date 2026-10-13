import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {mkdtemp,rm,readdir,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
const require=createRequire(import.meta.resolve('@cloudflare/vitest-plugin'))
const {Miniflare,convertV4MiniflareOptions}=require('miniflare')
const {readD1Migrations}=await import('@cloudflare/vitest-plugin')
const encoded=bytes=>Buffer.from(bytes).toString('base64')
async function signer(){
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])
 return {publicKey:encoded(await crypto.subtle.exportKey('spki',pair.publicKey)),async sign(event){
  const timestamp=String(Math.floor(Date.now()/1000)),body=JSON.stringify([event])
  const signature=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,new TextEncoder().encode(timestamp+body)))
  const integer=bytes=>{let n=0;while(n<31&&bytes[n]===0)n++;const data=[...bytes.slice(n)];if(data[0]&128)data.unshift(0);return [2,data.length,...data]}
  const der=[...integer(signature.slice(0,32)),...integer(signature.slice(32))]
  return {method:'POST',body,headers:{'content-type':'application/json','x-twilio-email-event-webhook-timestamp':timestamp,'x-twilio-email-event-webhook-signature':encoded([48,der.length,...der])}}
 }}
}
test('[REL-011 BASE-OPS-003] genuine persisted D1 runtime restart retains atomic receipt, suppression and replay identity',async()=>{
 const state=await mkdtemp(join(tmpdir(),'penny-mail-restart-')),identity=await signer(),modules=[]
 for(const path of await readdir('dist/server',{recursive:true}))if(/\.(mjs|js)$/.test(path))modules.push({type:'ESModule',path:resolve('dist/server',path),contents:await readFile(join('dist/server',path),'utf8')})
 modules.sort((a,b)=>a.path.endsWith('/index.js')?-1:b.path.endsWith('/index.js')?1:0)
 const options=convertV4MiniflareOptions({modules,modulesRoot:resolve('dist/server'),cf:false,compatibilityDate:'2026-08-31',compatibilityFlags:['nodejs_compat'],
  resourcePersistencePath:state,d1Databases:{DB:'mail-restart'},r2Buckets:{FILES:'files'},queueProducers:{JOBS:'jobs'},
  bindings:{PENNY_ENVIRONMENT:'test',APP_ORIGIN:'https://penny.test',AUTH_SECRET:'synthetic-restart-auth-secret-long-enough',MAIL_PROVIDER:'sendgrid',SENDGRID_API_KEY:'synthetic-send-key',MAIL_FROM:'penny@example.test',SENDGRID_EVENT_PUBLIC_KEY:identity.publicKey}})
 let mf
 try {
  mf=new Miniflare(options);await mf.ready;let db=await mf.getD1Database('DB')
  for(const migration of await readD1Migrations(resolve('migrations/core')))await db.batch(migration.queries.map(sql=>db.prepare(sql)))
  const stamp=new Date().toISOString()
  await db.batch([
   db.prepare("INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES('p','Person',?,?)").bind(stamp,stamp),
   db.prepare("INSERT INTO requester_addresses(id,requester_id,email,verified_at,created_at,updated_at) VALUES('a','p','person@example.test',?,?,?)").bind(stamp,stamp,stamp),
   db.prepare("INSERT INTO boards(id,slug,name,visibility,position,created_at,updated_at) VALUES('b','b','Board','public',0,?,?)").bind(stamp,stamp),
   db.prepare("INSERT INTO requests(id,slug,board_id,title,description,moderation_state,public_state,created_at,updated_at) VALUES('r','r','b','Title','Description','approved','open',?,?)").bind(stamp,stamp),
   db.prepare("INSERT INTO notification_events(id,request_id,kind,subject_id,body,created_at,updated_at) VALUES('e','r','status','e','Status',?,?)").bind(stamp,stamp),
   db.prepare("INSERT INTO notification_batches(id,requester_id,address_id,request_id,first_event_id,window_start,window_end,state,next_attempt_at,created_at,updated_at) VALUES('batch','p','a','r','e',?,?,'accepted',?,?,?)").bind(stamp,stamp,stamp,stamp,stamp),
   db.prepare("INSERT INTO notification_attempts(id,batch_id,provider,state,provider_message_id,recipient_email,recipient_verification_epoch,created_at,updated_at) VALUES('attempt','batch','sendgrid','accepted','api-receipt','person@example.test',0,?,?)").bind(stamp,stamp),
  ])
  const event={event:'bounce',type:'bounce',sg_event_id:'event',sg_message_id:'webhook-message.received-node',email:'person@example.test',timestamp:Math.floor(Date.now()/1000),rer_delivery_id:'batch',rer_product:'penny',rer_penny_attempt:'attempt'}
  assert.equal((await mf.dispatchFetch('https://penny.test/api/public/mail/events',await identity.sign(event))).status,200)
  const before=(await db.prepare('SELECT * FROM mail_event_records ORDER BY id').all()).results
  assert.equal(before.length,2)
  await mf.dispose();mf=undefined
  mf=new Miniflare(options);await mf.ready;db=await mf.getD1Database('DB')
  assert.equal((await mf.dispatchFetch('https://penny.test/api/public/mail/events',await identity.sign(event))).status,200)
  assert.deepEqual((await db.prepare('SELECT * FROM mail_event_records ORDER BY id').all()).results,before)
  assert.equal(typeof (await db.prepare("SELECT suppressed_at FROM requester_addresses WHERE id='a'").first()).suppressed_at,'string')
  assert.equal((await mf.dispatchFetch('https://penny.test/api/public/mail/events',await identity.sign({...event,type:'blocked'}))).status,400)
  assert.equal((await db.prepare('SELECT count(*) n FROM requester_write_guards').first()).n,0)
 }finally{await mf?.dispose();await rm(state,{recursive:true,force:true})}
})
