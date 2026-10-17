import {applyD1Migrations,reset} from 'cloudflare:test'
import {exports} from 'cloudflare:workers'
import {beforeEach,afterEach,vi,expect,inject,it} from 'vitest'
import {call,env,owner,mockMail,origin,finishFirstRun,messages} from './support'
import {graph,provider} from './notification-regression-fixture'
import {createPennyRuntime} from '@/core/app/runtime'
import {drainNotifications} from '@/core/features/notifications/delivery'
import {drainDecisionReviews} from '@/core/features/notifications/decision-reviews'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'));mockMail()})
afterEach(()=>vi.restoreAllMocks())
const clock={timezone:'America/New_York',quietEnabled:true,quietStart:20,quietEnd:8}
const save=(operator:{Cookie:string},input=clock)=>call('/api/operator/settings/workspace-clock',input,operator,'PUT')
const runtime=()=>createPennyRuntime(env)

it('[OPS-008][OPS-005] requires an IANA timezone before setup commits, retains it on repeat and confirms legacy settings once',async()=>{
 const operator=await owner({finishSetup:false})
 const complete=(timezone:string)=>exports.default.fetch(new Request(origin+'/setup',{method:'POST',redirect:'manual',headers:{...operator,Host:'penny.test',Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({confirm:'yes',companyName:'Acme',postalAddress:'10 Main Street',timezone,quietEnabled:'yes',quietStart:'20',quietEnd:'8'}).toString()}))
 for(const timezone of ['', 'not/a-timezone', '+04:00'])expect((await complete(timezone)).status).toBe(400)
 expect(await env.DB.prepare('SELECT * FROM oa_first_run').first()).toBeNull()
 expect(await env.DB.prepare('SELECT * FROM penny_workspace_clock').first()).toBeNull()
 expect((await complete(clock.timezone)).status).toBe(303)
 expect((await finishFirstRun(operator,'Asia/Tokyo')).status).toBe(303)
 expect(await (await call('/api/operator/settings/workspace-clock',undefined,operator)).json()).toMatchObject({...clock,confirmed:true})
 await env.DB.prepare('DELETE FROM penny_workspace_clock').run()
 expect(await (await call('/api/operator/settings/workspace-clock',undefined,operator)).json()).toMatchObject({confirmed:false})
 expect((await save(operator)).status).toBe(200)
 expect((await save(operator,{...clock,quietEnd:20})).status).toBe(400)
 expect((await save(operator,{...clock,quietStart:24})).status).toBe(400)
 expect((await call('/api/operator/settings/workspace-clock',clock,{},'PUT')).status).toBe(401)
 const before=await env.DB.prepare('SELECT * FROM penny_workspace_clock').first()
 expect((await call('/api/operator/settings/workspace-clock',{...clock,timezone:'UTC'},{...operator,Origin:'https://other.test'},'PUT')).status).toBe(403)
 expect((await call('/api/operator/settings/operators',{email:'clock-admin@example.test'},operator)).status).toBe(202)
 const token=new URL(messages.findLast(message=>message.to==='clock-admin@example.test')!.url).searchParams.get('token')
 const confirmed=await call('/auth/confirm',{token}),peer={Cookie:confirmed.headers.get('Set-Cookie')!.split(';')[0]}
 expect(confirmed.status).toBe(303)
 expect((await save(peer,{...clock,timezone:'UTC'})).status).toBe(403)
 expect(await env.DB.prepare('SELECT * FROM penny_workspace_clock').first()).toEqual(before)
 await env.DB.prepare("UPDATE oa_operators SET role='admin' WHERE email='clock-admin@example.test'").run()
 expect((await save(peer,{...clock,timezone:'UTC'})).status).toBe(401)
 expect((await call('/api/auth/magic-link',{email:'clock-admin@example.test'})).status).toBe(202)
 const adminToken=new URL(messages.findLast(message=>message.to==='clock-admin@example.test')!.url).searchParams.get('token')
 const admin=await call('/auth/confirm',{token:adminToken})
 expect(admin.status).toBe(303)
 expect((await save({Cookie:admin.headers.get('Set-Cookie')!.split(';')[0]},{...clock,timezone:'UTC'})).status).toBe(200)
})

it('[OPS-008][NOTIFY-002] sends Eastern daytime updates, holds overnight to 08:00 and applies timezone changes and quiet-hours off to queued mail',async()=>{
 const g=await graph(),sent=provider(),base=Date.parse('2026-10-07T18:00:00Z')
 expect((await save(g.operator)).status).toBe(200)
 await g.publish(0,'Eastern afternoon',base-Date.parse('2026-10-07T09:00:00Z'))
 await drainNotifications(runtime(),()=>base+60000);expect(sent).toHaveLength(1)
 const night=Date.parse('2026-10-08T01:00:00Z')
 await g.publish(0,'Eastern overnight',night-Date.parse('2026-10-07T09:00:00Z'))
 await drainNotifications(runtime(),()=>night+60000);expect(sent).toHaveLength(1)
 await drainNotifications(runtime(),()=>Date.parse('2026-10-08T11:59:59Z'));expect(sent).toHaveLength(1)
 await drainNotifications(runtime(),()=>Date.parse('2026-10-08T12:00:00Z'));expect(sent).toHaveLength(2)
 const next=Date.parse('2026-10-09T01:00:00Z')
 await g.publish(0,'Timezone changed',next-Date.parse('2026-10-07T09:00:00Z'))
 await drainNotifications(runtime(),()=>next+60000);expect(sent).toHaveLength(2)
 expect((await save(g.operator,{...clock,timezone:'Asia/Tokyo'})).status).toBe(200)
 await drainNotifications(runtime(),()=>next+60000);expect(sent).toHaveLength(3)
 expect((await save(g.operator)).status).toBe(200)
 const later=Date.parse('2026-10-10T03:00:00Z')
 await g.publish(0,'Quiet hours off',later-Date.parse('2026-10-07T09:00:00Z'))
 await drainNotifications(runtime(),()=>later+60000);expect(sent).toHaveLength(3)
 expect((await save(g.operator,{...clock,quietEnabled:false})).status).toBe(200)
 await drainNotifications(runtime(),()=>later+60000);expect(sent).toHaveLength(4)
 await drainNotifications(runtime(),()=>later+120000);expect(sent).toHaveLength(4)
 expect((await save(g.operator,{timezone:'UTC',quietEnabled:true,quietStart:9,quietEnd:17})).status).toBe(200)
 const custom=Date.parse('2026-10-11T12:00:00Z')
 await g.publish(0,'Custom daytime quiet hours',custom-Date.parse('2026-10-07T09:00:00Z'))
 await drainNotifications(runtime(),()=>custom+60000);expect(sent).toHaveLength(4)
 await drainNotifications(runtime(),()=>Date.parse('2026-10-11T17:00:00Z'));expect(sent).toHaveLength(5)
})

it('[OPS-008][DEC-007][NOTIFY-003] calendar reviews use the recorded timezone and operator mail has no requester quiet hours',async()=>{
 const operator=await owner();expect((await save(operator)).status).toBe(200)
 const response=await call('/api/operator/decisions',{question:'What should change?'},operator)
 expect(response.status).toBe(201)
 const decision=await response.json() as {id:string}
 const actor=await env.DB.prepare("SELECT id FROM operators WHERE email='owner@penny.invalid'").first<string>('id')
 await env.DB.prepare("UPDATE decisions SET state='committed',owner_operator_id=?,review_at='2026-10-07' WHERE id=?").bind(actor,decision.id).run()
 const sent=provider()
 await drainDecisionReviews(runtime(),()=>Date.parse('2026-10-08T03:59:59Z'));expect(sent).toHaveLength(0)
 await drainDecisionReviews(runtime(),()=>Date.parse('2026-10-08T04:00:00Z'));expect(sent).toHaveLength(1)
 await drainDecisionReviews(runtime(),()=>Date.parse('2026-10-08T05:00:00Z'));expect(sent).toHaveLength(1)
})
