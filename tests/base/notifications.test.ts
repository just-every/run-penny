import { applyD1Migrations,reset,createScheduledController,createMessageBatch } from 'cloudflare:test'
import { beforeEach,afterEach,vi,expect,inject,it } from 'vitest'
import { exports } from 'cloudflare:workers'
import { runNotificationQueue } from '@/core/features/notifications/queue'
import { runNotificationSchedule } from '@/core/features/notifications/scheduled'
import { call,env,owner,requester,mockMail } from './support'
import { createPennyRuntime } from '@/core/app/runtime'
import { createPennyApi } from '@/core/app/api'
import { drainNotifications } from '@/core/features/notifications/delivery'
import { prepareBatches } from '@/core/features/notifications/batches'
import { unsubscribeUrl } from '@/core/features/notifications/unsubscribe'
import { RequestOperatorRepository } from '@/core/features/requests/operator-repository'
import { loadRuntimeConfiguration } from '@/core/platform/configuration'
import { authMail } from '@/core/features/auth/mail'
import type { AppBindings } from '@/core/shared/bindings'
import {explicitConsentBoard} from './explicit-consent-board'
const start=Date.parse('2026-10-07T09:00:00.000Z'),time=(offset=0)=>new Date(start+offset).toISOString()
const source={operatorAllowlist:['owner@penny.invalid'],workspaceTimezone:'UTC',publicOriginAllowlist:['https://penny.test']}
const runtime=(provider='sendgrid')=>createPennyRuntime({...env,WORKSPACE_TIMEZONE:source.workspaceTimezone,MAIL_PROVIDER:provider,...(provider==='resend'?{MAIL_API_KEY:'synthetic-resend-key'}:{})},source)
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'));mockMail()})
afterEach(()=>vi.restoreAllMocks())
async function setup(){
 const operator=await owner({timezone:'UTC'}),person=await requester()
 expect((await call('/api/operator/boards',{name:'Feedback',slug:'product',visibility:'public'},operator)).status).toBe(201)
 await explicitConsentBoard('product',(path,method,body)=>call(path,body,operator,method))
 const response=await call('/api/public/requests',{title:'Private original title',description:'Private commercial evidence',boardSlug:'product',idempotencyKey:crypto.randomUUID()},person)
 expect(response.status).toBe(201);const {slug}=await response.json() as {slug:string}
 expect((await call(`/api/operator/moderation/${slug}`,{verdict:'approved',title:'Approved title',description:'Public description',boardSlug:'product',displayName:'Public name'},operator)).status).toBe(200)
 const row=(await env.DB.prepare('SELECT r.id AS requestId,r.author_requester_id AS requesterId,a.id AS addressId,a.email FROM requests r JOIN requester_addresses a ON a.requester_id=r.author_requester_id WHERE r.slug=?').bind(slug).first<{requestId:string;requesterId:string;addressId:string;email:string}>())!
 const actor=(await env.DB.prepare('SELECT id FROM operators WHERE email=?').bind('owner@penny.invalid').first<{id:string}>())!
 async function follow(){expect((await call(`/api/public/requests/${slug}/follow`,{},person)).status).toBe(204)}
 async function status(body:string,offset=0){await new RequestOperatorRepository(runtime().database).publishStatusUpdate({slug,operatorId:actor.id,status:'under_review',body,pinned:false,now:time(offset),appOrigin:'https://penny.test'})}
 return {operator,operatorId:actor.id,person,slug,...row,follow,status}
}
function capture(status=202,receipt:string|null=null){
 const sent:{url:string;body:Record<string,unknown>}[]=[]
 vi.mocked(fetch).mockImplementation(async (input,init)=>{sent.push({url:String(input),body:JSON.parse(String(init?.body))});return new Response(status===200?JSON.stringify({id:'resend-real-fixture-id'}):null,{status,headers:receipt?{'x-message-id':receipt}:{}})})
 return sent
}
async function batches(){return (await env.DB.prepare('SELECT * FROM notification_batches ORDER BY window_start').all()).results}
it('[NOTIFY-001/002 REQ-007] public event intent is atomic; fixed windows include all approved events, exclude held/internal/voter-only',async()=>{
 const g=await setup()
 expect((await call(`/api/public/requests/${g.slug}/vote`,{},g.person)).status).toBe(204)
 await g.status('No consent');expect((await env.DB.prepare('SELECT count(*) n FROM notification_intents').first<{n:number}>())!.n).toBe(0)
 await g.follow();await g.status('First public status')
 await prepareBatches(env.DB,time(1000))
 await g.status('Second public status',59999)
 await g.status('Exact boundary separate',60000)
 const commenter=await requester('Another requester')
 const held=await call(`/api/public/requests/${g.slug}/comments`,{body:'Held private comment'},commenter);expect(held.status).toBe(201)
 const id=(await held.json() as {id:string}).id
 await env.DB.prepare('UPDATE request_comments SET created_at=?,updated_at=? WHERE id=?').bind(time(100),time(100),id).run()
 expect((await env.DB.prepare("SELECT count(*) n FROM notification_events WHERE kind='comment'").first<{n:number}>())!.n).toBe(0)
 // SQL approval runs the same atomic publication trigger as the real moderated route.
 await env.DB.prepare("UPDATE request_comments SET body='Approved comment',moderation_state='approved',published_at=?,updated_at=? WHERE id=?").bind(time(200),time(200),id).run()
 const sent=capture();await drainNotifications(runtime(),()=>start+59999);expect(sent).toHaveLength(0)
 await drainNotifications(runtime(),()=>start+60000)
 expect(sent).toHaveLength(1)
 const body=JSON.stringify(sent[0].body)
 for(const text of ['First public status','Second public status','Approved comment'])expect(body).toContain(text)
 for(const text of ['Exact boundary separate','Held private comment','Private commercial evidence','Private original title'])expect(body).not.toContain(text)
 expect(await batches()).toMatchObject([{state:'accepted',provider_message_id:null},{state:'queued'}])
 await drainNotifications(runtime(),()=>start+120000);expect(sent).toHaveLength(2)
 await drainNotifications(runtime(),()=>start+180000);expect(sent).toHaveLength(2)
 await env.DB.exec("CREATE TRIGGER fail_intent BEFORE INSERT ON notification_intents BEGIN SELECT RAISE(ABORT,'injected atomic intent failure'); END;")
 await expect(g.status('Must roll back',10800000)).rejects.toThrow('injected atomic intent failure')
 expect(await env.DB.prepare("SELECT id FROM request_status_updates WHERE body='Must roll back'").first()).toBeNull()
})
it('[NOTIFY-001 REQ-007] public reply routes retain intents while excluding the recipient’s own approved comment from mail',async()=>{
 const g=await setup();await g.follow()
 expect((await call(`/api/operator/requests/${g.slug}/comments`,{body:'Public operator reply'},g.operator)).status).toBe(201)
 const held=await call(`/api/public/requests/${g.slug}/comments`,{body:'Needs review'},g.person);const {id}=await held.json() as {id:string}
 expect((await env.DB.prepare('SELECT count(*) n FROM notification_intents').first<{n:number}>())!.n).toBe(1)
 expect((await call(`/api/operator/comments/${id}/moderate`,{verdict:'approved',publicAuthorDisplayName:'Approved name',body:'Approved requester reply'},g.operator)).status).toBe(200)
 expect((await env.DB.prepare('SELECT count(*) n FROM notification_intents').first<{n:number}>())!.n).toBe(2)
 expect((await call(`/api/operator/comments/${id}/moderate`,{verdict:'approved',publicAuthorDisplayName:'Approved name'},g.operator)).status).toBe(409)
 expect((await call(`/api/operator/requests/${g.slug}/notes`,{body:'Internal secret'},g.operator)).status).toBe(201)
 expect((await env.DB.prepare('SELECT count(*) n FROM notification_intents').first<{n:number}>())!.n).toBe(2)
 await env.DB.batch([
  env.DB.prepare('UPDATE notification_events SET created_at=?').bind(time()),
  env.DB.prepare('UPDATE notification_intents SET created_at=?,coalescing_at=NULL').bind(time()),
 ])
 const sent=capture();await drainNotifications(runtime(),()=>start+3600000)
 expect(sent).toHaveLength(1)
 expect(JSON.stringify(sent[0].body)).toContain('Public operator reply')
 expect(JSON.stringify(sent[0].body)).not.toContain('Approved requester reply')
})
it('[NOTIFY-002/005] overlapping drains claim once, persist ownership before HTTP, and nullable acceptance never replays',async()=>{
 const g=await setup();await g.follow();await g.status('Concurrency')
 let sends=0
 vi.mocked(fetch).mockImplementation(async()=>{
  sends++
  expect(await env.DB.prepare("SELECT state,attempt_count FROM notification_batches").first()).toMatchObject({state:'sending',attempt_count:1})
  expect(await env.DB.prepare('SELECT state FROM notification_attempts').first()).toMatchObject({state:'sending'})
  return new Response(null,{status:202})
 })
 await Promise.all([drainNotifications(runtime(),()=>start+3600000),drainNotifications(runtime(),()=>start+3600000)])
 expect(sends).toBe(1);expect(await batches()).toMatchObject([{state:'accepted',provider_message_id:null}])
 await drainNotifications(runtime(),()=>start+7200000);expect(sends).toBe(1)
})
it.each(['mute','global','suppression','block','permission','unpublish','internal','author-block'] as const)('[NOTIFY-002 REQ-019/022] rechecks %s after enqueue',async change=>{
 const g=await setup();await g.follow();await g.status('Pending')
 if(change==='mute')await call(`/api/public/requests/${g.slug}/follow`,{muted:true},g.person,'PATCH')
 if(change==='global')await call('/api/public/requester/notifications',{muted:true},g.person,'PATCH')
 if(change==='suppression')await env.DB.prepare('UPDATE requester_addresses SET suppressed_at=? WHERE id=?').bind(time(),g.addressId).run()
 if(change==='block'||change==='author-block')await env.DB.prepare('UPDATE requesters SET blocked_at=? WHERE id=?').bind(time(),g.requesterId).run()
 if(change==='permission')await env.DB.prepare('UPDATE requester_update_permissions SET revoked_at=? WHERE requester_id=?').bind(time(),g.requesterId).run()
 if(change==='unpublish')await env.DB.prepare("UPDATE requests SET moderation_state='rejected' WHERE id=?").bind(g.requestId).run()
 if(change==='internal')await env.DB.exec("UPDATE boards SET visibility='internal'")
 const sent=capture();await drainNotifications(runtime(),()=>start+3600000)
 expect(sent).toHaveLength(0);expect(await batches()).toMatchObject([{state:'suppressed'}])
})
it('[NOTIFY-002 EVID-006] mixed batch drops a newly held comment and still sends its public status',async()=>{
 const g=await setup();await g.follow();await g.status('Still public')
 const r=await call(`/api/operator/requests/${g.slug}/comments`,{body:'No longer public'},g.operator);const {id}=await r.json() as {id:string}
 // Place this independently published event in the same test clock window.
 await env.DB.prepare('UPDATE notification_events SET created_at=? WHERE id=?').bind(time(500),id).run()
 await env.DB.prepare('UPDATE notification_intents SET created_at=? WHERE event_id=?').bind(time(500),id).run()
 await env.DB.prepare("UPDATE request_comments SET moderation_state='rejected' WHERE id=?").bind(id).run()
 const sent=capture();await drainNotifications(runtime(),()=>start+3600000)
 expect(sent).toHaveLength(1);expect(JSON.stringify(sent[0])).toContain('Still public');expect(JSON.stringify(sent[0])).not.toContain('No longer public')
})
it('[NOTIFY-005 REL-006] bounded exponential known failures, ambiguous outcomes and interrupted attempts require review',async()=>{
 const g=await setup();await g.follow();await g.status('Retry')
 const sent=capture(429);let offset=3600000
 for(let attempt=0;attempt<6;attempt++){
  await drainNotifications(runtime(),()=>start+offset);expect(sent).toHaveLength(attempt+1)
  if(attempt<5){const row=(await batches())[0];expect(row.state).toBe('queued');expect(row.next_attempt_at).toBe(time(offset+60000*2**attempt));offset+=60000*2**attempt}
 }
 expect(await batches()).toMatchObject([{state:'failed',attempt_count:6}]);await drainNotifications(runtime(),()=>start+offset+3600000);expect(sent).toHaveLength(6)
 await g.status('Uncertain',offset+1);capture(503);await drainNotifications(runtime(),()=>start+offset+3600001)
 expect(await batches()).toMatchObject([{state:'failed'},{state:'unknown'}])
 const later=capture();await drainNotifications(runtime(),()=>start+offset+7200001);expect(later).toHaveLength(0)
 await g.status('Crash',offset+7200002);await prepareBatches(env.DB,time(offset+7200002))
 const crash=(await batches())[2].id
 await env.DB.batch([env.DB.prepare("UPDATE notification_batches SET state='sending',claim_id='crash-owner' WHERE id=?").bind(crash),env.DB.prepare("INSERT INTO notification_attempts(id,batch_id,provider,state,created_at,updated_at) VALUES('crash-owner',?,'sendgrid','sending',?,?)").bind(crash,time(),time())])
 await drainNotifications(runtime(),()=>start+offset+10800002)
 expect((await batches())[2]).toMatchObject({state:'unknown',failure_reason:'attempt_interrupted_review_required'});expect(later).toHaveLength(0)
 expect((await call('/api/operator/notifications',undefined,g.operator)).status).toBe(200)
 expect((await call('/api/operator/notifications')).status).toBe(401)
})
it('[NOTIFY-002 REQ-025] signed no-login request/global unsubscribe resists tampering and retains votes, follows and access',async()=>{
 const g=await setup();await g.follow();await call(`/api/public/requests/${g.slug}/vote`,{},g.person)
 const link=await unsubscribeUrl(runtime(),g,g.requestId),all=await unsubscribeUrl(runtime(),g,'all')
 expect((await call(new URL(link).pathname+new URL(link).search)).status).toBe(200)
 expect(await env.DB.prepare('SELECT * FROM request_notification_mutes').first()).toBeNull()
 const post=async(url:string)=>exports.default.fetch(new Request(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'List-Unsubscribe=One-Click'}))
 expect((await post(link)).status).toBe(200);expect((await post(link)).status).toBe(200)
 expect(await env.DB.prepare('SELECT * FROM request_notification_mutes').first()).toMatchObject({request_id:g.requestId})
 const token=new URL(all).searchParams.get('token')!,[payload,sig]=token.split('.')
 const changed=JSON.parse(atob(payload.replaceAll('-','+').replaceAll('_','/')));changed.scope=g.requestId
 const tampered=btoa(JSON.stringify(changed)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')+'.'+sig
 expect((await post(`https://penny.test/api/public/notifications/unsubscribe?token=${tampered}`)).status).toBe(400)
 expect((await post(all)).status).toBe(200)
 expect(await (await call('/api/public/requester/notifications',undefined,g.person)).json()).toEqual({muted:true})
 expect((await call('/api/public/requester/activity',undefined,g.person)).status).toBe(200)
 expect((await env.DB.prepare('SELECT count(*) n FROM request_votes').first<{n:number}>())!.n).toBe(1)
 expect((await env.DB.prepare('SELECT count(*) n FROM request_follows').first<{n:number}>())!.n).toBe(1)
 await env.DB.prepare("UPDATE requester_addresses SET email='changed@example.test' WHERE id=?").bind(g.addressId).run()
 expect((await post(all)).status).toBe(400)
})
it('[NOTIFY-002] Base providers send through public identity and Queue paths with durable relay failures',async()=>{
 const config=(provider:string,values:Partial<AppBindings>)=>loadRuntimeConfiguration(source,{...env,PENNY_ENVIRONMENT:'production',MAIL_PROVIDER:provider,MAIL_API_KEY:undefined,...values})
 expect(config('resend',{MAIL_API_KEY:'selected'}).mailApiKey).toBe('selected')
 expect(()=>config('sendgrid',{})).toThrow('MAIL_API_KEY')
 const g=await setup();await g.follow();await g.status('Resend notification')
 const sent=capture(200);await drainNotifications(runtime('resend'),()=>start+3600000)
 expect(sent).toHaveLength(1);expect(sent[0].url).toBe('https://api.resend.com/emails')
 expect(sent[0].body).toMatchObject({to:[g.email],headers:{'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}})
 expect(await batches()).toMatchObject([{state:'accepted',provider:'resend',provider_message_id:'resend-real-fixture-id'}])
 expect(authMail(runtime('missing'))).toBeUndefined()
 const relay='https://mail.rer.example/api/managed-mail/send',key='synthetic-managed-mail-credential'
 const bindings={...env,PENNY_ENVIRONMENT:'production',WORKSPACE_TIMEZONE:'UTC',MAIL_PROVIDER:'rer',MAIL_RELAY_URL:relay,MAIL_API_KEY:key}
 expect(()=>config('rer',{MAIL_RELAY_URL:relay})).toThrow('MAIL_API_KEY')
 const requests:{to:string;subject:string;text:string;html?:string;listUnsubscribe?:string;listUnsubscribePost?:boolean}[]=[],statuses=[202,401,429,202,302]
 vi.mocked(fetch).mockImplementation(async(input,init)=>{
  expect(String(input)).toBe(relay);expect(init?.method).toBe('POST');expect(init?.redirect).toBe('manual')
  expect(init?.headers).toEqual({Authorization:`Bearer ${key}`,'Content-Type':'application/json'})
  const body=JSON.parse(String(init?.body));requests.push(body)
  expect(body).toEqual({to:expect.any(String),subject:expect.any(String),text:expect.any(String),...(body.html?{html:expect.any(String)}:{}),...(body.listUnsubscribe?{listUnsubscribe:expect.any(String),listUnsubscribePost:true}:{})})
  expect(body.subject.trim()).toBeTruthy();expect(body.text.trim()).toBeTruthy()
  const status=statuses.shift()!;return new Response(JSON.stringify(status===202?{accepted:true}:{error:'private relay detail'}),{status,headers:status===429?{'Retry-After':'60'}:status===302?{Location:'https://must-not-follow.example/'}:{}})
 })
 const app=createPennyApi(),requestLink=()=>app.fetch(new Request('https://penny.test/api/auth/magic-link',{method:'POST',headers:{Origin:'https://penny.test','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.64'},body:JSON.stringify({email:'owner@penny.invalid'})}),bindings)
 expect((await requestLink()).status).toBe(202)
 expect(requests[0].to).toBe('owner@penny.invalid');expect(requests[0].text).toContain('/auth/confirm?token=')
 const denied=await requestLink();expect(denied.status).toBe(503);expect(await denied.json()).toEqual({error:'mail_unavailable'})
 expect((await env.DB.prepare("SELECT outcome FROM penny_auth_mail_attempts WHERE transport='rer' ORDER BY started_at").all()).results.map(row=>row.outcome)).toEqual(['accepted','failed'])
 await g.status('Managed request update',3600001)
 const fixed=start+3660001,clock=vi.spyOn(Date,'now').mockReturnValue(fixed)
 const wake=()=>runNotificationQueue(createMessageBatch('feedback-penny-local-jobs',[{id:crypto.randomUUID(),timestamp:Date.now(),attempts:1,body:{kind:'notifications.drain'}}]),bindings)
 await wake()
 expect(requests).toHaveLength(3);expect(requests[2].text).toContain('Managed request update');expect(requests[2].text).toContain('Unsubscribe from all requester email:')
 expect(requests[2]).toMatchObject({to:g.email,listUnsubscribe:`<${await unsubscribeUrl(createPennyRuntime(bindings,source),g,'all')}>`,listUnsubscribePost:true})
 expect(await batches()).toMatchObject([{state:'accepted'},{state:'queued',provider:'rer',next_attempt_at:new Date(fixed+60000).toISOString(),failure_reason:'provider_rate_limited'}])
 await wake();expect(requests).toHaveLength(3)
 clock.mockReturnValue(fixed+60000);await wake();expect(requests).toHaveLength(4)
 expect(requests[3]).toEqual(requests[2])
 expect(await batches()).toMatchObject([{state:'accepted'},{state:'accepted',provider:'rer'}])
 const redirected=await requestLink();expect(redirected.status).toBe(503);expect(requests).toHaveLength(5)
 expect(await env.DB.prepare("SELECT outcome FROM penny_auth_mail_attempts WHERE transport='rer' ORDER BY started_at DESC LIMIT 1").first()).toEqual({outcome:'failed'})
})
it('[NOTIFY-002] Queue transport drains before Cron and duplicate wakeups never resend',async()=>{
 const g=await setup();await g.follow();await g.status('Cron path')
 // All day timezone configurations are tested above; force current clock into a
 // daylight hour for the compiled Worker, whose buyer timezone is Brisbane.
 const fixed=start+60000,clock=vi.spyOn(Date,'now').mockReturnValue(start+30000)
 const sent=capture()
 await runNotificationQueue(createMessageBatch('feedback-penny-local-jobs',[{id:'early-wakeup',timestamp:start+30000,attempts:1,body:{kind:'notifications.drain'}}]),env)
 expect(sent).toHaveLength(0)
 clock.mockReturnValue(fixed)
 await runNotificationQueue(createMessageBatch('feedback-penny-local-jobs',[{id:'first-wakeup',timestamp:fixed,attempts:1,body:{kind:'notifications.drain'}}]),env)
 expect(sent).toHaveLength(1)
 await runNotificationQueue(createMessageBatch('feedback-penny-local-jobs',[{id:'duplicate-wakeup',timestamp:fixed,attempts:1,body:{kind:'notifications.drain'}}]),env)
 await runNotificationSchedule(createScheduledController({scheduledTime:fixed,cron:'* * * * *'}),env)
 expect(sent).toHaveLength(1);expect(await batches()).toMatchObject([{state:'accepted'}])
})

it('[REQ-024 NOTIFY-002] identity merge preserves global and request mute, accepts old links, and suppresses muted intent',async()=>{
 const g=await setup();await g.follow();await g.status('Queued before merge')
 const oldLink=await unsubscribeUrl(runtime(),g,'all')
 const targetSession=await requester()
 const target=(await env.DB.prepare('SELECT id FROM requesters WHERE id!=?').bind(g.requesterId).first<{id:string}>())!
 await call('/api/public/requester/notifications',{muted:true},g.person,'PATCH')
 await env.DB.prepare('INSERT INTO request_notification_mutes(requester_id,request_id,created_at,updated_at) VALUES(?,?,?,?)').bind(g.requesterId,g.requestId,time(),time()).run()
 await new RequestOperatorRepository(runtime().database).mergeRequesters(g.requesterId,target.id,g.operatorId,time(100))
 expect(await env.DB.prepare('SELECT muted_at FROM requester_notification_preferences WHERE requester_id=?').bind(target.id).first()).toMatchObject({muted_at:expect.any(String)})
 expect(await env.DB.prepare('SELECT request_id FROM request_notification_mutes WHERE requester_id=?').bind(target.id).first()).toEqual({request_id:g.requestId})
 expect((await call(new URL(oldLink).pathname+new URL(oldLink).search,{},{})).status).toBe(200)
 const sent=capture();await drainNotifications(runtime(),()=>start+3600000)
 expect(sent).toHaveLength(0);expect(await batches()).toMatchObject([{state:'suppressed'}])
 expect((await call('/api/public/requester/activity',undefined,targetSession)).status).toBe(200)
})
it('[NOTIFY-002 REQ-008/009] request-scoped mute follows canonical resolution and survives unmerge',async()=>{
 const g=await setup();await g.follow()
 const response=await call('/api/public/requests',{title:'Target',description:'Public target',boardSlug:'product',idempotencyKey:crypto.randomUUID()},g.person)
 const {slug}=await response.json() as {slug:string}
 expect((await call(`/api/operator/moderation/${slug}`,{verdict:'approved',title:'Target',description:'Target description',boardSlug:'product',displayName:'Name'},g.operator)).status).toBe(200)
 await env.DB.prepare('INSERT INTO request_notification_mutes(requester_id,request_id,created_at,updated_at) VALUES(?,?,?,?)').bind(g.requesterId,g.requestId,time(),time()).run()
 expect((await call(`/api/operator/requests/${g.slug}/merge`,{targetSlug:slug},g.operator)).status).toBe(200)
 await new RequestOperatorRepository(runtime().database).publishStatusUpdate({slug,operatorId:g.operatorId,status:'under_review',body:'Muted canonical',pinned:false,now:time(),appOrigin:'https://penny.test'})
 expect((await env.DB.prepare('SELECT count(*) n FROM notification_intents').first<{n:number}>())!.n).toBe(0)
 expect((await call(`/api/operator/requests/${g.slug}/unmerge`,{},g.operator)).status).toBe(200)
 await g.status('Still muted origin',100)
 expect((await env.DB.prepare('SELECT count(*) n FROM notification_intents').first<{n:number}>())!.n).toBe(0)
 expect((await call(`/api/public/requests/${g.slug}/follow`,{muted:false},g.person,'PATCH')).status).toBe(204)
 await g.status('Explicitly resumed',200)
 expect((await env.DB.prepare('SELECT count(*) n FROM notification_intents').first<{n:number}>())!.n).toBe(1)
})
it('[NOTIFY-002 EVID-006] corrected approved comment sends the current public projection',async()=>{
 const g=await setup();await g.follow()
 const reply=await call(`/api/operator/requests/${g.slug}/comments`,{body:'Removed public wording'},g.operator);const {id}=await reply.json() as {id:string}
 await env.DB.prepare('UPDATE notification_events SET created_at=? WHERE id=?').bind(time(),id).run()
 await env.DB.prepare('UPDATE notification_intents SET created_at=? WHERE event_id=?').bind(time(),id).run()
 await env.DB.prepare("UPDATE request_comments SET body='Correct approved wording' WHERE id=?").bind(id).run()
 const sent=capture();await drainNotifications(runtime(),()=>start+3600000)
 expect(sent).toHaveLength(1);expect(JSON.stringify(sent)).toContain('Correct approved wording');expect(JSON.stringify(sent)).not.toContain('Removed public wording')
})
it('[NOTIFY-005 REL-006] known local validation failures are bounded and the retry window expires after one hour',async()=>{
 const g=await setup();await g.follow();await g.status('No transport effect')
 const bad=createPennyRuntime({...env,WORKSPACE_TIMEZONE:source.workspaceTimezone,MAIL_FROM:'invalid-address'},source),sent=capture()
 await drainNotifications(bad,()=>start+3600000)
 expect(sent).toHaveLength(0);expect(await batches()).toMatchObject([{state:'queued',attempt_count:1}])
 expect(await env.DB.prepare('SELECT state FROM notification_attempts').first()).toEqual({state:'rejected'})
 await drainNotifications(runtime(),()=>start+7200000)
 expect(sent).toHaveLength(0);expect(await batches()).toMatchObject([{state:'failed',failure_reason:'retry_window_exhausted'}])
})

it('[REQ-030 BASE-OPS-005] chosen private request and comment rejection reaches the scheduled provider transport exactly once',async()=>{
 const {rejectionFixture,rejectionRows,localRejectionBindings,rejectionTime}=await import('./rejection-fixture')
 const {providerMessages}=await import('./provider-messages')
 const request=await rejectionFixture(),comment=await rejectionFixture({comment:true,operator:request.operator}),silent=await rejectionFixture({operator:request.operator})
 expect((await request.reject()).status).toBe(200);expect((await comment.reject()).status).toBe(200)
 expect((await silent.reject(false)).status).toBe(200)
 expect((await request.reject()).status).toBe(409);expect((await comment.reject()).status).toBe(409)
 const bindings=localRejectionBindings(),local=createPennyRuntime(bindings),sent=capture()
 vi.spyOn(Date,'now').mockReturnValue(rejectionTime)
 await runNotificationSchedule(createScheduledController({scheduledTime:rejectionTime,cron:'* * * * *'}),bindings)
 await runNotificationSchedule(createScheduledController({scheduledTime:rejectionTime,cron:'* * * * *'}),bindings)
 expect(sent).toHaveLength(3) // Two rejection notices and the subscribed author's publication notice.
 const allMail=await providerMessages(local)!.list()
 expect(allMail).toHaveLength(3)
 const rejectionIds=new Set((await rejectionRows()).map(row=>row.id))
 const mail=allMail.filter(row=>rejectionIds.has(row.message.deliveryId))
 expect(mail).toHaveLength(2)
 expect(allMail.filter(row=>!rejectionIds.has(row.message.deliveryId))).toHaveLength(1)
 expect(mail.map(row=>row.message.to[0]).sort()).toEqual([request.email,comment.email].sort())
 for(const row of mail){expect(row.message.text).toContain('Please explain the workflow you need.');expect(row.message.text).toContain('/api/public/notifications/unsubscribe?');expect(JSON.stringify(row.message)).not.toMatch(/PRIVATE|COMMERCIAL|HELD/)}
 expect(await rejectionRows()).toMatchObject([{state:'accepted',attempts:1},{state:'accepted',attempts:1}])
 expect((await call(`/api/public/requests/${request.slug}`)).status).toBe(404)
 expect(await (await call(`/api/public/requests/${comment.slug}`)).text()).not.toContain('PRIVATE HELD COMMENT')
 const inbox=await (await call('/api/operator/notifications',undefined,request.operator)).json() as {deliveries:{kind:string;state:string;provider:string}[]}
 expect(inbox.deliveries.filter(d=>d.kind==='rejection')).toMatchObject([{state:'accepted',provider:'sendgrid'},{state:'accepted',provider:'sendgrid'}])
 expect((await call('/api/operator/notifications',undefined,request.person)).status).toBe(401)
 const audits=await env.DB.prepare("SELECT actor_type,actor_id,entity_id,occurred_at,details_json FROM audit_entries WHERE action='moderation.rejection_mail'").all()
 expect(audits.results).toHaveLength(4)
 for(const row of audits.results){expect(row).toMatchObject({actor_type:'system',actor_id:'moderation_rejection_mail',entity_id:expect.any(String),occurred_at:expect.any(String)});expect(String(row.details_json)).not.toMatch(/@|Please explain|PRIVATE/)}
})
it('[NOTIFY-004] a reply to a notification creates nothing',async()=>{
 const g=await setup();await g.follow();await g.status('Reply loop check')
 const sent=capture();await drainNotifications(runtime(),()=>start+3600000)
 expect(sent).toHaveLength(1)
 // Without a NOTIFY-013 reply-to, a reply goes to the deployment sender, which Penny never reads.
 const mail=sent[0].body as {from:{email:string};reply_to?:unknown;headers?:Record<string,string>}
 expect(mail.from.email).toBe(env.MAIL_FROM);expect(mail.reply_to).toBeUndefined()
 expect(mail.headers).toMatchObject({'Auto-Submitted':'auto-generated'})
 // Per-IP request counters are charged for every HTTP request whatever it carries; every other table must stay as it was.
 const counters=new Set(['penny_public_admission','native_rate_limits'])
 const rows=async()=>Object.fromEntries(await Promise.all((await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").all<{name:string}>()).results
  .filter(({name})=>!counters.has(name)).map(async({name})=>[name,(await env.DB.prepare(`SELECT count(*) AS n FROM "${name}"`).first<{n:number}>())!.n])))
 const before=await rows(),subject='Re: Updates: Approved title',text='Thanks, but we still need this for the finance export.'
 const raw=`From: ${g.email}\r\nTo: ${mail.from.email}\r\nSubject: ${subject}\r\nIn-Reply-To: <${g.requestId}@penny.test>\r\nAuto-Submitted: no\r\n\r\n${text}`
 const parse=new FormData();for(const [key,value] of Object.entries({from:g.email,to:mail.from.email,subject,text,email:raw}))parse.set(key,value)
 // Raw message, SendGrid Inbound Parse and a JSON inbound webhook, at the origin root, the signed provider event route and plausible capture paths.
 const shapes:[string,BodyInit][]=[['message/rfc822',raw],['',parse],['application/json',JSON.stringify({type:'email.received',data:{from:g.email,to:[mail.from.email],subject,text}})]]
 let ip=0
 for(const path of ['/','/email','/inbound','/api/inbound','/api/email','/api/public/email','/api/public/inbound','/api/public/mail/events','/api/public/mail/inbound','/api/operator/evidence','/api/operator/inbox'])for(const [type,body] of shapes){
  const response=await exports.default.fetch(new Request('https://penny.test'+path,{method:'POST',redirect:'manual',headers:{Host:'penny.test','CF-Connecting-IP':`198.51.100.${++ip}`,...(type?{'Content-Type':type}:{})},body}))
  const label=`${path} ${type||'multipart/form-data'}`
  // The origin root renders the public document whatever the method; every other path refuses the message.
  if(path==='/')expect(response.headers.get('Content-Type'),label).toMatch(/^text\/html/)
  else expect(response.status,label).toBeGreaterThanOrEqual(400)
  await response.body?.cancel()
 }
 expect(await rows()).toEqual(before)
})
