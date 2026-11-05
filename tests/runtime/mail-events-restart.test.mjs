import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {mkdtemp,rm,readdir,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {freshLocalPort} from '../browser/fresh-local-port.mjs'
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
async function managedRelay(mf,configuration,restart,identity){
 const relay='https://mail.rer.example/api/managed-mail/send',key='synthetic-managed-mail-key',owner='owner@penny.invalid',setup='synthetic-managed-owner-setup-token-long-enough'
 const requests=[],destinations=[],statuses=[202,401,302,429,202,302]
 const port=await freshLocalPort(),origin=`https://127.0.0.1:${port}`
 const offset=new Date().getUTCHours()-12,timezone=`Etc/GMT${offset<0?offset:`+${offset}`}`
 const relayConfiguration={...configuration,https:true,host:'127.0.0.1',port,
  bindings:{...configuration.bindings,APP_ORIGIN:origin,PENNY_ENVIRONMENT:'production',OPERATOR_EMAIL:owner,SETUP_TOKEN:setup,MAIL_PROVIDER:'rer',MAIL_API_KEY:key,MAIL_RELAY_URL:relay,WORKSPACE_TIMEZONE:timezone},
  outboundService:async request=>{
   // Miniflare reconstructs this edge Request without its redirect property.
   // notifications.test.ts observes manual mode; here any follow is a failure.
   destinations.push(request.url)
   assert.equal(request.url,relay);assert.equal(request.method,'POST')
   assert.equal(request.headers.get('Authorization'),`Bearer ${key}`);assert.equal(request.headers.get('Content-Type'),'application/json')
   const body=await request.json();requests.push(body)
   assert.deepEqual(body,{to:body.to,subject:body.subject,text:body.text,...(body.html?{html:body.html}:{}),...(body.listUnsubscribe?{listUnsubscribe:body.listUnsubscribe,listUnsubscribePost:true}:{})})
   assert.equal(typeof body.to,'string');assert.ok(body.subject.trim());assert.ok(body.text.trim())
   const status=statuses.shift();assert.ok(status,'unexpected relay submission')
   return new Response(JSON.stringify(status===202?{accepted:true}:{error:'private relay provider detail'}),{status,headers:status===429?{'Retry-After':'60'}:status===302?{Location:'https://must-not-follow.example/'}:{}})
  },
 }
 const options=convertV4MiniflareOptions(relayConfiguration)
 await mf.setOptions(options);await mf.ready
 let db=await mf.getD1Database('DB')
 const call=(path,body,cookie)=>mf.dispatchFetch(`${origin}${path}`,{method:body===undefined?'GET':'POST',redirect:'manual',
  headers:{Origin:origin,'CF-Connecting-IP':'192.0.2.74',...(body===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})})
 const boot=await call('/auth/bootstrap',{token:setup,displayName:'Owner',returnTo:'/setup'})
 assert.equal(boot.status,303,await boot.text())
 const cookie=boot.headers.get('set-cookie').split(';')[0]
 assert.equal((await mf.dispatchFetch(origin+'/setup',{method:'POST',redirect:'manual',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({confirm:'yes',companyName:'Relay fixture business',postalAddress:'1 Test Street',timezone,quietEnabled:'yes',quietStart:'20',quietEnd:'8'}).toString()})).status,303)
 const signIn=()=>call('/api/auth/magic-link',{email:owner})
 assert.equal((await signIn()).status,202);assert.equal(requests.length,1)
 assert.equal(requests[0].to,owner);assert.ok(requests[0].text.includes(origin+'/auth/confirm?token='))
 for(const status of [401,302]){
  const failed=await signIn();assert.equal(failed.status,503);assert.deepEqual(await failed.json(),{error:'mail_unavailable'})
  assert.equal(requests.length,status===401?2:3)
 }
 assert.deepEqual((await db.prepare("SELECT outcome,phase FROM penny_auth_mail_attempts WHERE transport='rer' ORDER BY rowid").all()).results,[{outcome:'accepted',phase:'finished'},{outcome:'failed',phase:'finished'},{outcome:'failed',phase:'finished'}])
 assert.equal((await db.prepare('SELECT count(*) n FROM oa_tokens WHERE revoked_at IS NOT NULL').first()).n,2)
 const stamp=new Date().toISOString()
 await db.batch([
  db.prepare("INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES('relay-person','Follower',?,?)").bind(stamp,stamp),
  db.prepare("INSERT INTO requester_addresses(id,requester_id,email,verified_at,created_at,updated_at) VALUES('relay-address','relay-person','follower@example.test',?,?,?)").bind(stamp,stamp,stamp),
  db.prepare("UPDATE requests SET public_title='Relay fixture title',public_description='Public fixture description',published_at=?,updated_at=? WHERE id='r'").bind(stamp,stamp),
  db.prepare("INSERT INTO request_follows(request_id,requester_id,permission_granted_at,created_at,updated_at) VALUES('r','relay-person',?,?,?)").bind(stamp,stamp,stamp),
  db.prepare("INSERT INTO requester_update_permissions(id,requester_id,requester_address_id,request_id,source,granted_at,created_at,updated_at) VALUES('relay-permission','relay-person','relay-address','r','follow',?,?,?)").bind(stamp,stamp,stamp),
 ])
 const publish=async(body,age)=>{
  assert.equal((await call('/api/operator/requests/r/status-updates',{status:'under_review',body},cookie)).status,200)
  // Mature the fixture's coalescing window without replacing the Worker's clock.
  const occurred=new Date(Date.now()-age).toISOString()
  await db.batch([
   db.prepare('UPDATE notification_events SET created_at=? WHERE id IN(SELECT event_id FROM notification_intents WHERE batch_id IS NULL)').bind(occurred),
   db.prepare('UPDATE notification_intents SET created_at=? WHERE batch_id IS NULL').bind(occurred),
  ])
 }
 const wake=async()=>{
  const result=await (await mf.getWorker()).queue('jobs',[{id:crypto.randomUUID(),timestamp:new Date(),attempts:1,body:{kind:'notifications.drain'}}])
  assert.equal(result.outcome,'ok');assert.equal(result.ackAll,true)
 }
 const batches=async()=>(await db.prepare("SELECT * FROM notification_batches WHERE requester_id='relay-person' ORDER BY window_start").all()).results
 await publish('Managed request update',300000);await wake();assert.equal(requests.length,4)
 const queued=await batches();assert.equal(queued.length,1)
 assert.equal(queued[0].state,'queued');assert.equal(queued[0].provider,'rer');assert.equal(queued[0].failure_reason,'provider_rate_limited')
 assert.equal(queued[0].attempt_count,1);assert.ok(Date.parse(queued[0].next_attempt_at)>Date.now())
 const attempts=(await db.prepare('SELECT * FROM notification_attempts WHERE batch_id=?').bind(queued[0].id).all()).results
 assert.equal(attempts[0].state,'rate_limited');assert.equal(attempts[0].failure_reason,'provider_rate_limited')
 const notification=requests[3];assert.equal(notification.to,'follower@example.test');assert.ok(notification.text.includes('Managed request update'))
 assert.equal(notification.listUnsubscribePost,true)
 const link=new URL(notification.listUnsubscribe.slice(1,-1))
 assert.equal(link.origin,origin);assert.equal(link.pathname,'/api/public/notifications/unsubscribe');assert.ok(link.searchParams.get('token'))
 assert.ok(notification.text.includes(link.href))
 mf=await restart(options);db=await mf.getD1Database('DB')
 assert.deepEqual(await batches(),queued)
 assert.deepEqual((await db.prepare('SELECT * FROM notification_attempts WHERE batch_id=?').bind(queued[0].id).all()).results,attempts)
 await wake();assert.equal(requests.length,4)
 // The retry is now due; the durable claim and payload survive a real restart.
 await db.prepare('UPDATE notification_batches SET next_attempt_at=? WHERE id=?').bind(new Date().toISOString(),queued[0].id).run()
 await wake();assert.equal(requests.length,5);assert.deepEqual(requests[4],notification)
 assert.equal((await batches())[0].state,'accepted');assert.equal((await batches())[0].attempt_count,2)
 assert.deepEqual((await db.prepare('SELECT state FROM notification_attempts WHERE batch_id=? ORDER BY rowid').bind(queued[0].id).all()).results,[{state:'rate_limited'},{state:'accepted'}])
 await wake();assert.equal(requests.length,5)
 await publish('Redirected request update',120000);await wake();assert.equal(requests.length,6)
 const rejected=(await batches())[1]
 assert.equal(rejected.state,'queued');assert.equal(rejected.failure_reason,'provider_redirected')
 assert.deepEqual(await db.prepare('SELECT state,failure_reason FROM notification_attempts WHERE batch_id=?').bind(rejected.id).first(),{state:'rejected',failure_reason:'provider_redirected'})
 const deliveryResponse=await call('/api/operator/notifications',undefined,cookie);assert.equal(deliveryResponse.status,200)
 const delivery=(await deliveryResponse.json()).deliveries.find(row=>row.id===rejected.id)
 assert.equal(delivery.state,'queued');assert.equal(delivery.failureReason,'provider_redirected')
 await wake();assert.equal(requests.length,6)
 assert.deepEqual(destinations,Array(6).fill(relay));assert.equal(statuses.length,0)
 assert.equal((await mf.dispatchFetch(link.href,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'List-Unsubscribe=One-Click'})).status,200)
 assert.equal(typeof (await db.prepare("SELECT muted_at FROM requester_notification_preferences WHERE requester_id='relay-person'").first()).muted_at,'string')
 await suppressionPolicy(mf,relayConfiguration,cookie,identity,restart)
 console.log('Managed relay in emitted Worker/workerd: sign-in POST accepted; 401 and 302 revoke links; no redirect followed; 429 queues and retries across restart; native one-click unsubscribe: PASS')
}
async function suppressionPolicy(mf,options,cookie,identity,restart){
 const origin=options.bindings.APP_ORIGIN,messages=[]
 const sendgrid=convertV4MiniflareOptions({...options,bindings:{...options.bindings,MAIL_PROVIDER:'sendgrid'},outboundService:async request=>{
  assert.equal(request.url,'https://api.sendgrid.com/v3/mail/send');assert.equal(request.method,'POST')
  const body=await request.json();messages.push(body)
  return new Response(null,{status:202,headers:{'x-message-id':`synthetic-penny-${messages.length}`}})
 }})
 await mf.setOptions(sendgrid);await mf.ready
 let db=await mf.getD1Database('DB'),ip=0
 const call=(path,body,headers={},method=body===undefined?'GET':'POST')=>mf.dispatchFetch(origin+path,{method,redirect:'manual',
  headers:{Origin:origin,'CF-Connecting-IP':`198.18.1.${++ip}`,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})})
 const json=async(response,status=200)=>{assert.equal(response.status,status,await response.clone().text());return response.json()}
 const rows=async(table,where='',values=[]) => (await db.prepare(`SELECT * FROM ${table} ${where} ORDER BY rowid`).bind(...values).all()).results
 const text=message=>message.content.find(part=>part.type==='text/plain').value
 const recipient=message=>message.personalizations[0].to[0].email
 const operator={Cookie:cookie}
 const verify=async(email,displayName)=>{
  await json(await call('/api/public/identity/email',{email,displayName}),202)
  const link=new URL(text(messages.at(-1)).match(/https:\/\/[^\s]+/)[0])
  const session=await json(await call('/api/public/identity/email/verify',{token:new URLSearchParams(link.hash.slice(1)).get('token')}))
  return {Authorization:`Bearer ${session.token}`}
 }
 const email=['synthetic-penny-1','example.test'].join('@'),unaffectedEmail=['synthetic-penny-2','example.test'].join('@')
 const person=await verify(email,'Complaint requester'),unaffected=await verify(unaffectedEmail,'Unaffected requester')
 const boards=await json(await call('/api/public/boards')),board=boards.find(row=>row.slug==='b')
 await json(await call('/api/operator/boards/b/vote-subscriptions',{enabled:false,version:board.subscriptionDisclosure.version},operator,'PUT'))
 const request=await json(await call('/api/public/requests',{title:'Preserved request',description:'Preserved customer problem',boardSlug:'b',emailUpdates:true,idempotencyKey:crypto.randomUUID()},person),201)
 await json(await call(`/api/operator/moderation/${request.slug}`,{verdict:'approved',title:'Preserved request',description:'Preserved customer problem',boardSlug:'b',displayName:'Complaint requester'},operator))
 assert.equal((await call(`/api/public/requests/${request.slug}/vote`,{emailUpdates:true},person)).status,204)
 assert.equal((await call(`/api/public/requests/${request.slug}/follow`,{},unaffected)).status,204)
 await json(await call('/api/public/updates/subscription',{subscribed:true},person,'PATCH'))
 const comment=await json(await call(`/api/public/requests/${request.slug}/comments`,{body:'Preserved approved comment'},person),201)
 await json(await call(`/api/operator/comments/${comment.id}/moderate`,{verdict:'approved',publicAuthorDisplayName:'Complaint requester'},operator))
 request.id=(await db.prepare('SELECT id FROM requests WHERE slug=?').bind(request.slug).first()).id
 const address=await db.prepare('SELECT * FROM requester_addresses WHERE email=?').bind(email).first()
 const snapshot=async()=>({
  requests:await rows('requests','WHERE id=?',[request.id]),
  votes:await rows('request_votes','WHERE request_id=?',[request.id]),
  contributions:await rows('request_vote_contributions','WHERE request_id=?',[request.id]),
  comments:await rows('request_comments','WHERE request_id=?',[request.id]),
  follows:await rows('request_follows','WHERE request_id=?',[request.id]),
 })
 const permissions=async()=>rows('requester_update_permissions','WHERE requester_address_id=?',[address.id])
 const publicRead=()=>call(`/api/public/requests/${request.slug}`).then(json)
 const activity=()=>call('/api/public/requester/activity',undefined,person).then(json)
 const wake=async()=>{
  const result=await (await mf.getWorker()).queue('jobs',[{id:crypto.randomUUID(),timestamp:new Date(),attempts:1,body:{kind:'notifications.drain'}}])
  assert.equal(result.outcome,'ok');assert.equal(result.ackAll,true)
 }
 const publish=async(body,age)=>{
  await json(await call(`/api/operator/requests/${request.slug}/status-updates`,{status:'under_review',body},operator))
  const occurred=new Date(Date.now()-age).toISOString()
  await db.batch([
   db.prepare('UPDATE notification_events SET created_at=? WHERE request_id=? AND id IN(SELECT event_id FROM notification_intents WHERE batch_id IS NULL)').bind(occurred,request.id),
   db.prepare('UPDATE notification_intents SET created_at=? WHERE batch_id IS NULL AND event_id IN(SELECT id FROM notification_events WHERE request_id=?)').bind(occurred,request.id),
  ])
  const start=messages.length;await wake()
  return messages.slice(start)
 }
 const attempt=()=>db.prepare("SELECT a.*,b.address_id FROM notification_attempts a JOIN notification_batches b ON b.id=a.batch_id WHERE b.address_id=? ORDER BY a.rowid DESC LIMIT 1").bind(address.id).first()
 const eventFor=(attempt,event,type)=>({event,...(type?{type}:{}),sg_event_id:crypto.randomUUID(),sg_message_id:attempt.provider_message_id,
  email,timestamp:Math.floor(Date.now()/1000),rer_delivery_id:attempt.batch_id,rer_product:'penny',rer_penny_attempt:attempt.id})
 const callback=async event=>assert.equal((await mf.dispatchFetch(origin+'/api/public/mail/events',await identity.sign(event))).status,200)
 const fact=batch=>db.prepare('SELECT * FROM notification_delivery_facts WHERE batch_id=?').bind(batch).first()
 const kept=await snapshot(),permissionBefore=await permissions()
 assert.equal(kept.requests.length,1);assert.equal(kept.votes.length,1);assert.equal(kept.comments.length,1)
 assert.equal(kept.comments[0].moderation_state,'approved');assert.ok(permissionBefore.length>=2)
 const visible=await publicRead(),initialActivity=await activity()
 assert.equal(visible.title,'Preserved request');assert.equal(visible.voteCount,1);assert.equal(visible.comments[0].body,'Preserved approved comment')
 assert.equal(initialActivity.requests[0].id,request.id);assert.equal(initialActivity.votes[0].slug,request.slug);assert.equal(initialActivity.comments[0].id,comment.id)
 const first=await publish('Before soft bounce',600000)
 assert.deepEqual(first.map(recipient).sort(),[email,unaffectedEmail].sort())
 const softBefore=await snapshot(),softAttempt=await attempt(),soft=eventFor(softAttempt,'bounce','blocked')
 const otherBatches=await rows('notification_batches','WHERE address_id!=?',[address.id])
 const otherFacts=await rows('notification_delivery_facts')
 await callback(soft)
 assert.equal((await fact(softAttempt.batch_id)).state,'failed')
 assert.deepEqual(await rows('notification_delivery_facts','WHERE batch_id!=?',[softAttempt.batch_id]),otherFacts)
 assert.deepEqual(await rows('notification_batches','WHERE address_id!=?',[address.id]),otherBatches)
 assert.deepEqual(await db.prepare('SELECT * FROM requester_addresses WHERE id=?').bind(address.id).first(),address)
 assert.deepEqual(await permissions(),permissionBefore);assert.deepEqual(await snapshot(),softBefore)
 const softReceipts=await rows('mail_event_records')
 mf=await restart(sendgrid);db=await mf.getD1Database('DB')
 await callback(soft);assert.deepEqual(await rows('mail_event_records'),softReceipts)
 const second=await publish('After soft bounce',360000)
 assert.deepEqual(second.map(recipient).sort(),[email,unaffectedEmail].sort())
 const complaintAttempt=await attempt(),complaint=eventFor(complaintAttempt,'spamreport')
 const beforeComplaint=await snapshot(),portal=await publicRead(),ownActivity=await activity(),mailCount=messages.length
 const beforeForgery=await rows('mail_event_records'),forged=await identity.sign(complaint)
 forged.body=JSON.stringify([{...complaint,sg_event_id:'synthetic-penny-forged-event'}])
 assert.equal((await mf.dispatchFetch(origin+'/api/public/mail/events',forged)).status,400)
 assert.deepEqual(await rows('mail_event_records'),beforeForgery);assert.deepEqual(await permissions(),permissionBefore)
 assert.deepEqual(await snapshot(),beforeComplaint)
 assert.deepEqual(await db.prepare('SELECT * FROM requester_addresses WHERE id=?').bind(address.id).first(),address)
 await callback(complaint)
 const suppressed=await db.prepare('SELECT * FROM requester_addresses WHERE id=?').bind(address.id).first()
 assert.equal(typeof suppressed.suppressed_at,'string');assert.equal((await fact(complaintAttempt.batch_id)).state,'suppressed')
 const marked=await permissions()
 assert.equal(marked.length,permissionBefore.length)
 for(const permission of marked){
  assert.equal(permission.suppressed_at,suppressed.suppressed_at)
  const original=permissionBefore.find(row=>row.id===permission.id);assert.ok(original)
  assert.deepEqual({...permission,suppressed_at:original.suppressed_at,updated_at:original.updated_at},original)
 }
 const afterComplaint=await snapshot();assert.deepEqual(afterComplaint,beforeComplaint)
 assert.deepEqual(await publicRead(),portal);assert.deepEqual(await activity(),ownActivity)
 assert.deepEqual(await json(await call('/api/public/identity/session',undefined,person)),{displayName:'Complaint requester'})
 const complaintReceipts=await rows('mail_event_records')
 mf=await restart(sendgrid);db=await mf.getD1Database('DB')
 await callback(complaint)
 assert.deepEqual(await rows('mail_event_records'),complaintReceipts);assert.deepEqual(await permissions(),marked)
 assert.deepEqual(await db.prepare('SELECT * FROM requester_addresses WHERE id=?').bind(address.id).first(),suppressed)
 assert.equal(messages.length,mailCount)
 const third=await publish('After complaint',240000)
 assert.deepEqual(third.map(recipient),[unaffectedEmail]);assert.ok(text(third[0]).includes('After complaint'))
 await wake();assert.equal(messages.length,mailCount+1)
 assert.deepEqual((await activity()).votes,ownActivity.votes);assert.deepEqual((await activity()).comments,ownActivity.comments)
 assert.equal((await publicRead()).voteCount,1)
 // Reverification releases suppression; replay of the old complaint cannot undo it.
 await verify(email,'Complaint requester')
 assert.equal((await db.prepare('SELECT suppressed_at FROM requester_addresses WHERE id=?').bind(address.id).first()).suppressed_at,null)
 for(const permission of await permissions())assert.equal(permission.suppressed_at,null)
 await callback(complaint)
 const last=await publish('After reverification',120000)
 assert.deepEqual(last.map(recipient).sort(),[email,unaffectedEmail].sort())
 console.log('PROBE REL-011 point 1: signed soft bounce -> one failed delivery; address and permissions unchanged; both recipients receive next update')
 console.log('PROBE REL-011 requirement: signed hard bounce and complaint -> durable suppression; complaint permissions retained; suppressed recipient skipped; unaffected recipient mailed; reverification resumes mail')
 console.log('PROBE REL-011 point 2: native public request, activity and session reads -> request, vote, approved comment and portal access preserved across complaint and restart')
}
test('[REL-011 BASE-OPS-003 NOTIFY-002] emitted Worker retains mail custody across restart and enforces Managed relay delivery policy',async()=>{
 const state=await mkdtemp(join(tmpdir(),'penny-mail-restart-')),identity=await signer(),modules=[]
 for(const path of await readdir('dist/server',{recursive:true}))if(/\.(mjs|js)$/.test(path))modules.push({type:'ESModule',path:resolve('dist/server',path),contents:await readFile(join('dist/server',path),'utf8')})
 modules.sort((a,b)=>a.path.endsWith('/index.js')?-1:b.path.endsWith('/index.js')?1:0)
 const configuration={modules,modulesRoot:resolve('dist/server'),cf:false,compatibilityDate:'2026-08-31',compatibilityFlags:['nodejs_compat'],
  resourcePersistencePath:state,d1Databases:{DB:'mail-restart'},r2Buckets:{FILES:'files'},queueProducers:{JOBS:'jobs'},
  bindings:{PENNY_ENVIRONMENT:'test',APP_ORIGIN:'https://penny.test',AUTH_SECRET:'synthetic-restart-auth-secret-long-enough',MAIL_PROVIDER:'sendgrid',MAIL_API_KEY:'synthetic-send-key',MAIL_FROM:'penny@example.test',SENDGRID_EVENT_PUBLIC_KEY:identity.publicKey}}
 const options=convertV4MiniflareOptions(configuration)
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
  await managedRelay(mf,configuration,async next=>{await mf.dispose();mf=new Miniflare(next);await mf.ready;return mf},identity)
 }finally{await mf?.dispose();await rm(state,{recursive:true,force:true})}
})
