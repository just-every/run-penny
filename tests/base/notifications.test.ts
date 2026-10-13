import { applyD1Migrations,reset,createScheduledController } from 'cloudflare:test'
import { beforeEach,afterEach,vi,expect,inject,it } from 'vitest'
import { exports } from 'cloudflare:workers'
import { runNotificationSchedule } from '@/core/features/notifications/scheduled'
import { call,env,owner,requester,mockMail } from './support'
import { createPennyRuntime } from '@/core/app/runtime'
import { drainNotifications } from '@/core/features/notifications/delivery'
import { prepareBatches } from '@/core/features/notifications/batches'
import { quietHours } from '@/core/features/notifications/eligibility'
import { unsubscribeUrl } from '@/core/features/notifications/unsubscribe'
import { RequestOperatorRepository } from '@/core/features/requests/operator-repository'
import { loadRuntimeConfiguration } from '@/core/platform/configuration'
import { authMail } from '@/core/features/auth/mail'
import type { AppBindings } from '@/core/shared/bindings'
const start=Date.parse('2026-10-07T09:00:00.000Z'),time=(offset=0)=>new Date(start+offset).toISOString()
const source={operatorAllowlist:['owner@penny.invalid'],workspaceTimezone:'UTC',publicOriginAllowlist:['https://penny.test']}
const runtime=(provider='sendgrid')=>createPennyRuntime({...env,WORKSPACE_TIMEZONE:source.workspaceTimezone,MAIL_PROVIDER:provider,...(provider==='resend'?{SENDGRID_API_KEY:undefined,RESEND_API_KEY:'synthetic-resend-key'}:{})},source)
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'));mockMail()})
afterEach(()=>vi.restoreAllMocks())
async function setup(){
 const operator=await owner(),person=await requester()
 expect((await call('/api/operator/boards',{name:'Feedback',slug:'product',visibility:'public'},operator)).status).toBe(201)
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
 await g.status('Second public status',3599999)
 await g.status('Exact boundary separate',3600000)
 const held=await call(`/api/public/requests/${g.slug}/comments`,{body:'Held private comment'},g.person);expect(held.status).toBe(201)
 const id=(await held.json() as {id:string}).id
 await env.DB.prepare('UPDATE request_comments SET created_at=?,updated_at=? WHERE id=?').bind(time(100),time(100),id).run()
 expect((await env.DB.prepare("SELECT count(*) n FROM notification_events WHERE kind='comment'").first<{n:number}>())!.n).toBe(0)
 // SQL approval runs the same atomic publication trigger as the real moderated route.
 await env.DB.prepare("UPDATE request_comments SET body='Approved comment',moderation_state='approved',published_at=?,updated_at=? WHERE id=?").bind(time(200),time(200),id).run()
 const sent=capture();await drainNotifications(runtime(),()=>start+3600000)
 expect(sent).toHaveLength(1)
 const body=JSON.stringify(sent[0].body)
 for(const text of ['First public status','Second public status','Approved comment'])expect(body).toContain(text)
 for(const text of ['Exact boundary separate','Held private comment','Private commercial evidence','Private original title'])expect(body).not.toContain(text)
 expect(await batches()).toMatchObject([{state:'accepted',provider_message_id:null},{state:'queued'}])
 await drainNotifications(runtime(),()=>start+7200000);expect(sent).toHaveLength(2)
 await drainNotifications(runtime(),()=>start+10800000);expect(sent).toHaveLength(2)
 await env.DB.exec("CREATE TRIGGER fail_intent BEFORE INSERT ON notification_intents BEGIN SELECT RAISE(ABORT,'injected atomic intent failure'); END;")
 await expect(g.status('Must roll back',10800000)).rejects.toThrow('injected atomic intent failure')
 expect(await env.DB.prepare("SELECT id FROM request_status_updates WHERE body='Must roll back'").first()).toBeNull()
})
it('[NOTIFY-001 REQ-007] real operator reply and approved requester comment routes capture exactly one intent each',async()=>{
 const g=await setup();await g.follow()
 expect((await call(`/api/operator/requests/${g.slug}/comments`,{body:'Public operator reply'},g.operator)).status).toBe(201)
 const held=await call(`/api/public/requests/${g.slug}/comments`,{body:'Needs review'},g.person);const {id}=await held.json() as {id:string}
 expect((await env.DB.prepare('SELECT count(*) n FROM notification_intents').first<{n:number}>())!.n).toBe(1)
 expect((await call(`/api/operator/comments/${id}/moderate`,{verdict:'approved',publicAuthorDisplayName:'Approved name',body:'Approved requester reply'},g.operator)).status).toBe(200)
 expect((await env.DB.prepare('SELECT count(*) n FROM notification_intents').first<{n:number}>())!.n).toBe(2)
 expect((await call(`/api/operator/comments/${id}/moderate`,{verdict:'approved',publicAuthorDisplayName:'Approved name'},g.operator)).status).toBe(409)
 expect((await call(`/api/operator/requests/${g.slug}/notes`,{body:'Internal secret'},g.operator)).status).toBe(201)
 expect((await env.DB.prepare('SELECT count(*) n FROM notification_intents').first<{n:number}>())!.n).toBe(2)
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
it('[NOTIFY-002] timezone quiet hours hold at20:00 and release at08:00, including DST',async()=>{
 expect(quietHours(new Date('2026-10-07T09:59:59Z'),'Australia/Brisbane')).toBe(false)
 expect(quietHours(new Date('2026-10-07T10:00:00Z'),'Australia/Brisbane')).toBe(true)
 expect(quietHours(new Date('2026-10-07T21:59:59Z'),'Australia/Brisbane')).toBe(true)
 expect(quietHours(new Date('2026-10-07T22:00:00Z'),'Australia/Brisbane')).toBe(false)
 expect(quietHours(new Date('2026-10-07T21:00:00Z'),'Australia/Sydney')).toBe(false)
 const g=await setup();await g.follow();await g.status('Overnight')
 const sent=capture();await drainNotifications(runtime(),()=>Date.parse('2026-10-07T20:00:00Z'));expect(sent).toHaveLength(0)
 await drainNotifications(runtime(),()=>Date.parse('2026-10-08T07:59:59Z'));expect(sent).toHaveLength(0)
 await drainNotifications(runtime(),()=>Date.parse('2026-10-08T08:00:00Z'));expect(sent).toHaveLength(1)
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
it('[NOTIFY-002] Base Resend and SendGrid selection require only chosen key and produce actual provider-specific HTTP',async()=>{
 const config=(provider:string,values:Partial<AppBindings>)=>loadRuntimeConfiguration(source,{...env,PENNY_ENVIRONMENT:'production',MAIL_PROVIDER:provider,SENDGRID_API_KEY:undefined,RESEND_API_KEY:undefined,...values})
 expect(config('resend',{RESEND_API_KEY:'selected'}).mailApiKey).toBe('selected')
 expect(config('sendgrid',{SENDGRID_API_KEY:'selected'}).mailApiKey).toBe('selected')
 expect(()=>config('resend',{SENDGRID_API_KEY:'wrong'})).toThrow('RESEND_API_KEY')
 expect(()=>config('sendgrid',{RESEND_API_KEY:'wrong'})).toThrow('SENDGRID_API_KEY')
 const g=await setup();await g.follow();await g.status('Resend notification')
 const sent=capture(200);await drainNotifications(runtime('resend'),()=>start+3600000)
 expect(sent).toHaveLength(1);expect(sent[0].url).toBe('https://api.resend.com/emails')
 expect(sent[0].body).toMatchObject({to:[g.email],headers:{'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}})
 expect(await batches()).toMatchObject([{state:'accepted',provider:'resend',provider_message_id:'resend-real-fixture-id'}])
 expect(authMail(runtime('missing'))).toBeUndefined()
})
it('[NOTIFY-002] real Worker scheduled export drains its persisted due batch',async()=>{
 const g=await setup();await g.follow();await g.status('Cron path')
 // All day timezone configurations are tested above; force current clock into a
 // daylight hour for the compiled Worker, whose buyer timezone is Brisbane.
 const fixed=Date.parse('2026-10-08T00:00:00Z');vi.spyOn(Date,'now').mockReturnValue(fixed)
 const sent=capture();await runNotificationSchedule(createScheduledController({scheduledTime:fixed,cron:'* * * * *'}),env)
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
