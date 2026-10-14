import {applyD1Migrations,reset,createScheduledController} from 'cloudflare:test'
import {beforeEach,afterEach,expect,inject,it,vi} from 'vitest'
import {env,origin} from './support'
import {graph} from './notification-regression-fixture'
import {observeD1} from './review-race-storage'
import {connection,request,runtime,count,api} from './integration-delivery-fixture'
import {drainIntegrations,eventServices,deliveryNamespace} from '@/core/features/integrations/delivery'
import {createWebhookProtocol} from '../../base/modules/integrations/core/webhook.ts'
import {keyBytes} from '@/core/features/integrations/destinations'
import type {WireRequest} from '../../base/modules/integrations/core/types.ts'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
afterEach(()=>vi.restoreAllMocks())
it('[INT-001 INT-002] commits approved events with native publication, disables missing transport and sends exact signed minimal public bytes once',async()=>{
 const g=await graph(),target=await connection(g.operator),sent:WireRequest[]=[]
 await g.publish(0,'Approved public update')
 expect(await count('penny_integration_events')).toBe(2)
 expect(await count('penny_integration_targets')).toBe(1)
 expect(await drainIntegrations(runtime())).toEqual({state:'configuration-disabled',queued:0})
 expect(await count('integration_deliveries')).toBe(0)
 const port={send:async(wire:WireRequest)=>{
  const stamp=wire.headers['webhook-timestamp'],signed=JSON.stringify(['integrations.webhook.v1',deliveryNamespace,target.id,'status.published',wire.headers['webhook-id'],stamp,wire.body])
  const key=await crypto.subtle.importKey('raw',keyBytes(target.signingKey),{name:'HMAC',hash:'SHA-256'},false,['sign'])
  const signature=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(signed))),byte=>byte.toString(16).padStart(2,'0')).join('')
  expect(wire.headers['webhook-signature']).toBe('v1='+signature)
  sent.push(wire);return {status:204,headers:{},body:''}
 }}
 const {runNotificationSchedule}=await import('@/core/features/notifications/scheduled')
 await runNotificationSchedule(createScheduledController({scheduledTime:Date.now(),cron:'* * * * *'}),{...env,PENNY_EGRESS:port})
 await drainIntegrations(runtime(port))
 expect(sent).toHaveLength(1);expect(sent[0].body).toContain('Approved public update')
 expect(sent[0].body).not.toContain(g.recipient.email);expect(Object.keys(JSON.parse(sent[0].body)).sort()).toEqual(['body','event','id','requestId','slug','title'])
 expect(await env.DB.prepare('SELECT state FROM integration_deliveries').first('state')).toBe('accepted')
 const listed=await request('/api/operator/integrations/destinations',undefined,g.operator,'GET');const text=await listed.text();expect(text).not.toContain(target.signingKey);expect(text).not.toContain('events.example.com')
 const {feedbackFixture,apply}=await import('./feedback-import-fixture');const before=await count('penny_integration_events')
 await apply(feedbackFixture('delivery-history'),g.operator)
 expect(await count('penny_integration_events')).toBe(before);expect(await count('penny_effect_suppression')).toBe(0)
})
it('[INT-002 INT-003] restarts finite retry/uncertainty, refuses revoked/private sends and preserves failed native transactions',async()=>{
 const g=await graph(),target=await connection(g.operator);await g.publish(0,'Safe bounded update')
 let now=Date.now(),sends=0
 const port={send:async()=>{sends++;return {status:429,headers:{},body:''}}}
 for(let attempt=0;attempt<5;attempt++){await drainIntegrations(runtime(port),()=>now);now+=31000}
 expect(sends).toBe(4);expect(await env.DB.prepare('SELECT state FROM integration_deliveries').first('state')).toBe('rejected')
 await g.publish(0,'Second update',1,'second-integration-update')
 const unknown={send:async()=>{sends++;throw Error('Test-only network response lost')}}
 await drainIntegrations(runtime(unknown),()=>now);const sentBefore=sends
 await drainIntegrations(runtime(unknown),()=>now+70000);expect(sends).toBe(sentBefore)
 const unknownId=await env.DB.prepare("SELECT id FROM integration_deliveries WHERE state='uncertain'").first<string>('id')
 expect(unknownId).toBeTruthy()
 expect((await request('/api/operator/integrations/deliveries/'+unknownId+'/reconcile',{outcome:'accepted',evidenceCode:'receiver_confirmed'},g.operator)).status).toBe(200)
 await drainIntegrations(runtime(port),()=>now+80000);expect(sends).toBe(sentBefore)
 await g.publish(0,'Revoked destination update',2,'revoked-integration-update')
 const queued=eventServices(runtime(port),()=>now);const eventId=await env.DB.prepare("SELECT e.id FROM penny_integration_events e JOIN request_status_updates u ON e.status_id=u.id WHERE u.body='Revoked destination update'").first<string>('id')
 const body=JSON.stringify({id:eventId,requestId:g.requests[0].id,title:'Safe update'})
 await queued.webhook.enqueue({id:eventId+':'+target.id,tenant:deliveryNamespace,destinationId:target.id,event:'status.published',protocol:'webhook',body})
 expect((await request('/api/operator/integrations/destinations/'+target.id,{},g.operator,'DELETE')).status).toBe(200)
 await queued.webhook.dispatch(eventId+':'+target.id);expect(sends).toBe(sentBefore)
 const before=await count('request_status_updates'),events=await count('penny_integration_events')
 const broken=observeD1(env.DB,{before:async sql=>{if(sql.some(s=>s.includes('INSERT INTO request_status_updates')))throw Error('Test-only SQL interruption')}})
 const {RequestOperatorRepository}=await import('@/core/features/requests/operator-repository')
 await expect(new RequestOperatorRepository(runtime(undefined,broken).database).publishStatusUpdate({slug:g.requests[0].slug,operatorId:(await env.DB.prepare('SELECT id FROM operators').first<string>('id'))!,status:'under_review',body:'Must roll back',pinned:false,now:new Date().toISOString(),idempotencyKey:'broken-native-event'})).rejects.toThrow()
 expect(await count('request_status_updates')).toBe(before);expect(await count('penny_integration_events')).toBe(events)
})
it('[INT-004 BASE-ACCESS-002] verifies bounded original inbound bytes and atomically commits replay, internal note and processed receipt',async()=>{
 const g=await graph(),target=await connection(g.operator,'receiver'),protocol=createWebhookProtocol({resolveDestination:async()=>origin,signingKey:async()=>keyBytes(target.signingKey)})
 const envelope={id:'native-inbound-event',tenant:'penny-inbound',destinationId:target.id,event:'request.note',protocol:'webhook',body:JSON.stringify({requestId:g.requests[0].id,note:'Private tracker-independent note'})}
 const wire=await protocol.prepare(envelope,Date.now())
 const receive=(body=wire.body,headers=wire.headers,db=env.DB)=>api.fetch(new Request(origin+'/api/integrations/webhooks/'+target.id,{method:'POST',headers,body}),{...env,DB:db})
 expect((await receive(wire.body+' ')).status).toBe(401);expect(await count('request_notes')).toBe(0)
 expect((await receive()).status).toBe(200);expect((await receive()).status).toBe(200)
 expect(await count('request_notes')).toBe(1);expect(await count('penny_integration_receipts')).toBe(1);expect(await count('integration_replays')).toBe(1)
 const changed=await protocol.prepare({...envelope,body:JSON.stringify({requestId:g.requests[0].id,note:'Different'})},Date.now())
 expect((await receive(changed.body,changed.headers)).status).toBe(409)
 const second=await protocol.prepare({...envelope,id:'failed-native-inbound'},Date.now())
 const broken=observeD1(env.DB,{before:async sql=>{if(sql.some(s=>s.includes('INSERT INTO penny_integration_receipts')))throw Error('Test-only transaction failure')}})
 expect((await receive(second.body,second.headers,broken)).status).toBe(503)
 expect(await count('request_notes')).toBe(1);expect(await count('integration_replays')).toBe(1)
 expect((await request('/api/operator/integrations/destinations/'+target.id,{},g.operator,'DELETE')).status).toBe(200)
 expect((await receive(second.body,second.headers)).status).toBe(409)
})
