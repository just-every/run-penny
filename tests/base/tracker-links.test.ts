import {applyD1Migrations,reset} from 'cloudflare:test'
import {beforeEach,afterEach,expect,inject,it,vi} from 'vitest'
import {env} from './support'
import {graph} from './notification-regression-fixture'
import {observeD1} from './review-race-storage'
import {configure,fixtureIssue,issue,receive,state,trackerRequest,trackerRuntime,signingKey} from './tracker-fixture'
import {drainTrackers} from '@/core/features/integrations/tracker-delivery'
import type {WireRequest} from '../../base/modules/integrations/core/types.ts'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
afterEach(()=>vi.restoreAllMocks())
it('[INT-005 BASE-ACCESS-002] creates known Linear and Jira issues through native durable commands and links HTTPS identities without a token',async()=>{
 const g=await graph(),sent:WireRequest[]=[]
 const port={send:async(wire:WireRequest)=>{sent.push(wire);const provider=wire.url==='https://api.linear.app/graphql'?'linear':'jira';return {status:provider==='linear'?200:201,headers:{},body:JSON.stringify(fixtureIssue[provider])}}}
 for(const provider of ['linear','jira'] as const){
  const connectionId=await configure(g.operator,provider),body={requestId:g.requests[0].id,connectionId,title:'Owner-approved issue',description:'Only explicitly supplied wording',operationKey:provider+'-native-create'}
  const created=await trackerRequest('/api/operator/integrations/trackers/create',body,g.operator,'POST',port);expect(created.status).toBe(202)
  await drainTrackers(trackerRuntime(port));await drainTrackers(trackerRuntime(port))
  expect((await trackerRequest('/api/operator/integrations/trackers/create',body,g.operator,'POST',port)).status).toBe(202)
  expect((await trackerRequest('/api/operator/integrations/trackers/create',{...body,title:'Conflicting'},g.operator,'POST',port)).status).toBe(409)
  const link=await env.DB.prepare('SELECT * FROM penny_tracker_links WHERE connection_id=?').bind(connectionId).first();expect(link?.external_id).toBe(issue(provider).externalId);expect(link?.issue_url).toBe(issue(provider).url)
  const tokenless=await configure(g.operator,provider,'');expect((await trackerRequest('/api/operator/integrations/trackers/links',{requestId:g.requests[0].id,connectionId:tokenless,...issue(provider)},g.operator)).status).toBe(201)
 }
 expect(sent).toHaveLength(2);expect(sent.every(wire=>!wire.body.includes(g.recipient.email)&&!wire.body.includes('Requester wording'))).toBe(true)
 expect(JSON.parse(sent[0].body).variables.input).toMatchObject({teamId:'461b4065-5ccf-49ae-a432-876d77554e04',description:'Only explicitly supplied wording'})
 expect(JSON.parse(sent[1].body).fields.description).toMatchObject({type:'doc',version:1})
 const listing=await(await trackerRequest('/api/operator/integrations/trackers',undefined,g.operator,'GET')).text();expect(listing).not.toContain(signingKey);expect(listing).not.toContain('test-only-provider-token')
 expect(await env.DB.prepare('SELECT count(*) n FROM request_status_updates').first('n')).toBe(0)
})
it('[INT-005 INT-003] resumes interrupted create journaling, retains uncertainty and reconciles a known issue without duplication',async()=>{
 const g=await graph(),connectionId=await configure(g.operator,'linear'),sent:WireRequest[]=[]
 const unknown={send:async(wire:WireRequest)=>{sent.push(wire);throw Error('Test-only lost provider response')}}
 const input={requestId:g.requests[0].id,connectionId,title:'Explicit issue',description:'Explicit body',operationKey:'uncertain-create'}
 const response=await trackerRequest('/api/operator/integrations/trackers/create',input,g.operator,'POST',unknown),commandId=(await response.json() as {id:string}).id
 expect(response.status).toBe(202);await drainTrackers(trackerRuntime(unknown));await drainTrackers(trackerRuntime(unknown));expect(sent).toHaveLength(1)
 expect(await env.DB.prepare('SELECT state FROM integration_deliveries WHERE id=?').bind(commandId).first('state')).toBe('uncertain')
 expect((await trackerRequest('/api/operator/integrations/trackers/commands/'+commandId+'/reconcile',{requestId:g.requests[0].id,connectionId,...issue('linear')},g.operator)).status).toBe(200)
 await drainTrackers(trackerRuntime(unknown));expect(sent).toHaveLength(1)
 expect(await env.DB.prepare('SELECT state FROM integration_deliveries WHERE id=?').bind(commandId).first('state')).toBe('accepted')
 const broken=observeD1(env.DB,{before:async sql=>{if(sql.some(s=>s.includes('INSERT INTO integration_deliveries')))throw Error('Test-only interrupted enqueue')}})
 expect((await trackerRequest('/api/operator/integrations/trackers/create',{...input,operationKey:'restart-create'},g.operator,'POST',unknown,broken)).status).toBe(503)
 expect(await env.DB.prepare('SELECT count(*) n FROM penny_tracker_commands').first('n')).toBe(2)
 await drainTrackers(trackerRuntime(unknown));expect(sent).toHaveLength(2)
 await drainTrackers(trackerRuntime(unknown));expect(sent).toHaveLength(2)
})
it('[INT-006 INT-005] verifies each provider’s exact bytes and stores ordered state receipts privately with atomic replay custody',async()=>{
 const g=await graph()
 for(const provider of ['linear','jira'] as const){
  const connectionId=await configure(g.operator,provider,'');expect((await trackerRequest('/api/operator/integrations/trackers/links',{requestId:g.requests[0].id,connectionId,...issue(provider)},g.operator)).status).toBe(201)
  const value=state(provider),id=crypto.randomUUID();expect((await receive(provider,connectionId,value,id,' ')).status).toBe(401)
  expect((await receive(provider,connectionId,value,id)).status).toBe(200);expect((await receive(provider,connectionId,value,id)).status).toBe(200)
  expect((await receive(provider,connectionId,state(provider,'2026-10-09T12:29:00.000Z','Older'))).status).toBe(200)
  expect(await env.DB.prepare('SELECT state FROM penny_tracker_links WHERE connection_id=?').bind(connectionId).first('state')).toBe('In Progress')
  expect((await receive(provider,connectionId,state(provider,'2026-10-09T12:30:00.000Z','Conflicting'))).status).toBe(409)
  const wrong=state(provider);if(provider==='linear')wrong.data.teamId=crypto.randomUUID();else wrong.issue.fields.project.id='99999'
  expect((await receive(provider,connectionId,wrong)).status).toBe(422)
  const before=await env.DB.prepare('SELECT count(*) n FROM penny_tracker_receipts').first('n')
  const broken=observeD1(env.DB,{before:async sql=>{if(sql.some(s=>s.includes('INSERT INTO penny_tracker_receipts')))throw Error('Test-only receipt failure')}})
  expect((await receive(provider,connectionId,state(provider,'2026-10-09T12:31:00.000Z','Done'),crypto.randomUUID(),'',broken)).status).toBe(503)
  expect(await env.DB.prepare('SELECT count(*) n FROM penny_tracker_receipts').first('n')).toBe(before);expect(await env.DB.prepare('SELECT state FROM penny_tracker_links WHERE connection_id=?').bind(connectionId).first('state')).toBe('In Progress')
 }
 const {api}=await import('./integration-delivery-fixture'),{origin}=await import('./support');const text=await(await api.fetch(new Request(origin+'/api/public/requests/'+g.requests[0].slug),env)).text();expect(text).not.toContain('linear.app');expect(text).not.toContain('In Progress')
 expect(await env.DB.prepare('SELECT count(*) n FROM request_status_updates').first('n')).toBe(0)
})
it('[INT-006 BASE-ACCESS-002 DATA-001] fences removed authority, stale signed events and restored commands without granting consent or automatic effects',async()=>{
 const g=await graph(),connectionId=await configure(g.operator,'linear',''),link={requestId:g.requests[0].id,connectionId,...issue('linear')}
 expect((await trackerRequest('/api/operator/integrations/trackers/links',link,g.operator)).status).toBe(201)
 const stale=state('linear');stale.webhookTimestamp=Date.now()-120000;expect((await receive('linear',connectionId,stale)).status).toBe(401)
 const wrong=state('linear');wrong.organizationId=crypto.randomUUID();expect((await receive('linear',connectionId,wrong)).status).toBe(422)
 let changed=false;const raced=observeD1(env.DB,{before:async sql=>{if(!changed&&sql.some(s=>s.includes('INSERT INTO penny_tracker_receipts'))){changed=true;await env.DB.prepare('UPDATE penny_tracker_connections SET revoked_at=1').run()}}})
 expect((await receive('linear',connectionId,state('linear'),crypto.randomUUID(),'',raced)).status).toBe(409);expect(await env.DB.prepare('SELECT count(*) n FROM penny_tracker_receipts').first('n')).toBe(0)
 expect((await trackerRequest('/api/operator/integrations/trackers/links',link,g.operator)).status).toBe(409)
 const pendingConnection=await configure(g.operator,'linear'),port={send:async()=>{throw Error('Test-only port must not be used during queueing/export')}}
 const pending={requestId:g.requests[0].id,connectionId:pendingConnection,title:'Explicit pending issue',description:'Explicit description',operationKey:'restored-create'}
 expect((await trackerRequest('/api/operator/integrations/trackers/create',pending,g.operator,'POST',port)).status).toBe(202)
 const {exportArchive}=await import('@/core/features/data/archive'),exported=await exportArchive(env.DB,env.FILES)
 expect(exported.archive.tables).toHaveProperty('penny_tracker_links');expect(exported.archive.tables).not.toHaveProperty('penny_tracker_secrets');expect(exported.archive.tables).not.toHaveProperty('penny_tracker_connections')
 expect(exported.archive.tables.penny_tracker_commands).toHaveLength(1);expect(exported.archive.tables.penny_tracker_commands[0].held).toBe(1)
 expect(exported.archive.tables.integration_deliveries[0].state).toBe('uncertain')
 changed=false;const createRace=observeD1(env.DB,{before:async sql=>{if(!changed&&sql.some(s=>s.includes('INSERT INTO penny_tracker_commands'))){changed=true;await env.DB.prepare('UPDATE penny_tracker_connections SET revoked_at=1 WHERE id=?').bind(pendingConnection).run()}}})
 expect((await trackerRequest('/api/operator/integrations/trackers/create',{...pending,operationKey:'revoked-before-create'},g.operator,'POST',port,createRace)).status).toBe(401)
 expect(changed).toBe(true);expect(await env.DB.prepare('SELECT count(*) n FROM penny_tracker_commands').first('n')).toBe(1)
})
it('[INT-007 BASE-ACCESS-002] persists safe owner branding without exposing configuration authority to requesters or ordinary operators',async()=>{
 const g=await graph(),{api}=await import('./integration-delivery-fixture'),{origin}=await import('./support')
 const input={description:'Our customer feedback workspace',accent:'#173c2b',showLogo:true}
 const change=(headers:Record<string,string>,body=input)=>api.fetch(new Request(origin+'/api/operator/settings/branding',{method:'PUT',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)}),env)
 expect((await change({})).status).toBe(401);expect((await change(g.person)).status).toBe(401)
 expect((await change(g.operator,{...input,accent:'#ffffff'})).status).toBe(400)
 expect(await env.DB.prepare('SELECT count(*) n FROM penny_portal_branding').first('n')).toBe(0)
 expect((await change(g.operator)).status).toBe(200)
 const appearance=await api.fetch(new Request(origin+'/api/public/branding'),env);expect(await appearance.json()).toEqual(input)
 await env.DB.prepare("INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES('branding-other-owner','other@example.test','Other','owner','active',1,1)").run()
 await env.DB.prepare("UPDATE oa_operators SET role='member' WHERE email='owner@penny.invalid'").run()
 const {call,messages}=await import('./support')
 expect((await call('/api/auth/magic-link',{email:'owner@penny.invalid'})).status).toBe(202)
 const token=new URL(messages.findLast(row=>row.to==='owner@penny.invalid')!.url).searchParams.get('token')!
 const signedIn=await call('/auth/confirm',{token});expect(signedIn.status).toBe(303)
 const member={Cookie:signedIn.headers.get('Set-Cookie')!.split(';')[0]}
 expect((await change(member)).status).toBe(403)
 expect(await env.DB.prepare('SELECT description FROM penny_portal_branding').first('description')).toBe(input.description)
})
