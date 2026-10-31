import {expect,vi} from 'vitest'
import {applyD1Migrations,reset,createScheduledController} from 'cloudflare:test'
import {env,origin} from './support'
import {graph} from './notification-regression-fixture'
import {createPennyApp} from '@/core/app/worker'
import {runNotificationSchedule} from '@/core/features/notifications/scheduled'
import type {WireRequest} from '../../base/modules/integrations/core/types'

export async function proveDurableIntegration(migrations:Parameters<typeof applyD1Migrations>[1]){
 for(const kind of ['webhook','slack'] as const){
 await reset();await applyD1Migrations(env.DB,migrations)
 // Retry advances start on today's date so D1 sees current session authority.
 vi.setSystemTime(new Date(vi.getRealSystemTime()).setUTCHours(9,0,0,0))
 try{
 const endpoint=kind==='webhook'?'https://events.example.com/penny':'https://hooks.slack.com/services/synthetic-penny-1/synthetic-penny-2/synthetic-penny-3'
 const identity=(wire:WireRequest)=>wire.headers['webhook-id']??wire.headers['penny-delivery-id']
 const g=await graph(),calls:WireRequest[]=[]
 let reply:'retry'|'unknown'='retry',app=createPennyApp(),ip=0
 const edge={send:async(wire:WireRequest)=>{
  calls.push(structuredClone(wire))
  expect(wire.url).toBe(endpoint)
  expect(wire.body).toContain('Public request 0')
  expect(identity(wire)).toBeTruthy()
  if(reply==='unknown')throw new Error('synthetic-penny-response-unknown')
  return {status:429,headers:{'retry-after':'1'},body:''}
 }}
 const bindings={...env,PENNY_EGRESS:edge,WORKSPACE_TIMEZONE:'UTC'}
 const call=(path:string,body?:unknown,method=body===undefined?'GET':'POST')=>app.fetch(new Request(origin+path,{method,headers:{...g.operator,Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':`192.0.2.${++ip}`},...(body===undefined?{}:{body:JSON.stringify(body)})}),bindings)
 const cron=()=>runNotificationSchedule(createScheduledController({scheduledTime:Date.now(),cron:'* * * * *'}),bindings)
 const restart=()=>{app=createPennyApp()}
 const snapshot=async()=>await (await call('/api/operator/integrations/destinations')).json() as {deliveries:{id:string;state:string;attempts:number;next_at:number}[];attempts:unknown[]}
 const attempts=async()=>(await env.DB.prepare('SELECT * FROM integration_attempts ORDER BY delivery_id,number').all()).results
 const configure=async()=>{const result=await call('/api/operator/integrations/destinations',{name:'synthetic-penny-durable',kind,endpoint,events:['status.published']});expect(result.status).toBe(201);return (await result.json() as {id:string}).id}
 const publish=async(body:string)=>expect((await call(`/api/operator/requests/${g.requests[0].slug}/status-updates`,{status:'under_review',body,idempotencyKey:crypto.randomUUID()})).status).toBe(200)
 const destination=await configure()
 await publish('synthetic-penny-finite-retry');await cron()
 const queued=(await snapshot()).deliveries[0],prior=await attempts()
 expect(queued).toMatchObject({state:'queued',attempts:1})
 restart()
 expect(await attempts()).toEqual(prior)
 const limit=await env.DB.prepare('SELECT max_attempts FROM integration_deliveries WHERE id=?').bind(queued.id).first<number>('max_attempts')
 for(let n=1;n<limit!;n++){
  const pending=(await snapshot()).deliveries.find(row=>row.id===queued.id)!
  vi.setSystemTime(pending.next_at)
  await cron();restart()
 }
 expect((await snapshot()).deliveries.find(row=>row.id===queued.id)).toMatchObject({state:'rejected',attempts:limit})
 expect(calls.map(identity)).toEqual(Array.from({length:limit!},()=>queued.id))
 const terminalCalls=calls.length,terminalAttempts=await attempts()
 vi.setSystemTime(Date.now()+86_400_000);restart();await cron()
 expect({calls:calls.length,attempts:await attempts()}).toEqual({calls:terminalCalls,attempts:terminalAttempts})
 reply='unknown'
 for(const outcome of ['accepted','rejected']){
  await publish(`synthetic-penny-unknown-${outcome}`);await cron()
  const held=(await snapshot()).deliveries.find(row=>row.state==='uncertain')!,heldAttempts=await attempts(),heldCalls=calls.length
  expect(held).toMatchObject({attempts:1})
  restart();await cron()
  expect({calls:calls.length,attempts:await attempts(),state:(await snapshot()).deliveries.find(row=>row.id===held.id)?.state}).toEqual({calls:heldCalls,attempts:heldAttempts,state:'uncertain'})
  const path=`/api/operator/integrations/deliveries/${held.id}/reconcile`,body={outcome,evidenceCode:'synthetic_known_receipt'}
  expect((await call(path,body)).status).toBe(200)
  restart()
  expect((await call(path,body)).ok).toBe(false)
  await cron()
  expect({state:(await snapshot()).deliveries.find(row=>row.id===held.id)?.state,resolutions:await env.DB.prepare('SELECT count(*) n FROM integration_resolutions WHERE delivery_id=?').bind(held.id).first('n'),calls:calls.length}).toEqual({state:outcome,resolutions:1,calls:heldCalls})
 }
 const beforeFences=calls.length
 await publish('synthetic-penny-revoked')
 expect((await call(`/api/operator/integrations/destinations/${destination}`,undefined,'DELETE')).status).toBe(200)
 restart();await cron()
 expect(calls.length).toBe(beforeFences)
 await configure();await publish('synthetic-penny-private')
 expect((await call('/api/operator/boards/regression',{visibility:'internal'},'PATCH')).status).toBe(200)
 restart();await cron()
 expect(calls.length).toBe(beforeFences)
 expect((await call('/api/operator/boards/regression',{visibility:'public'},'PATCH')).status).toBe(200)
 await publish('synthetic-penny-blocked')
 expect((await call(`/api/operator/requesters/${g.recipient.requesterId}/block`,{})).status).toBe(200)
 restart();await cron()
 expect(calls.length).toBe(beforeFences)
 }finally{vi.useRealTimers()}
 }
}
