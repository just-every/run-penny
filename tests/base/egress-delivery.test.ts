import {applyD1Migrations,reset} from 'cloudflare:test'
import {afterEach,beforeEach,expect,inject,it,vi} from 'vitest'
import {env} from './support'
import {graph} from './notification-regression-fixture'
import {connection,request,count} from './integration-delivery-fixture'
import type {EnforcingEgress} from '@/core/features/integrations/transport'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
afterEach(()=>vi.restoreAllMocks())

// Base's egress service entrypoint with test network ports: synthetic DNS
// answers and a recorded destination fetch. No socket is ever opened here.
// Base type-checks this module under its own Workers configuration; loading it
// at runtime keeps Penny's test typecheck to Penny's own sources.
type Ports={resolve(host:string):Promise<string[]>;connect(address:{hostname:string}):never;fetch(url:string,init:RequestInit):Promise<Response>}
const egressModule='../../base/modules/egress-service/entrypoint.ts'
const {createEgressEntrypoint}=await import(/* @vite-ignore */ egressModule) as {createEgressEntrypoint:(ports:()=>Ports,limits:{tls:()=>never},grant:string)=>new(ctx:ExecutionContext,env:Record<string,string>)=>EnforcingEgress}
function egress(answers:string[],reply:(url:string)=>Response){
 const seen={resolved:[] as string[],connected:[] as string[],fetched:[] as {url:string;redirect:RequestRedirect|undefined}[]}
 const Service=createEgressEntrypoint(()=>({
  resolve:async(host:string)=>{seen.resolved.push(host);return answers},
  connect:({hostname})=>{seen.connected.push(hostname);throw new Error('No socket in this test')},
  fetch:async(url,init)=>{seen.fetched.push({url,redirect:init.redirect});return reply(url)},
 }),{tls:()=>{throw new Error('No TLS in this test')}},'EgressRestricted')
 const binding=new Service({props:{},waitUntil(){},passThroughOnException(){}} as unknown as ExecutionContext,{EGRESS_GRANTS:JSON.stringify([{entrypoint:'EgressRestricted',allowedHosts:['events.example.com']}]),EGRESS_OWNED_ZONES:'[]',EGRESS_WORKERS_SUFFIX:'penny-test.workers.dev'})
 return {port:binding,seen}
}
async function deliverThroughCron(port:EnforcingEgress){
 const {runNotificationSchedule}=await import('@/core/features/notifications/scheduled')
 await runNotificationSchedule({} as ScheduledController,{...env,PENNY_EGRESS:port})
 const delivery=(await env.DB.prepare('SELECT id,state FROM integration_deliveries ORDER BY created_at DESC,id DESC LIMIT 1').first<{id:string;state:string}>())!
 const attempt=await env.DB.prepare('SELECT outcome FROM integration_attempts WHERE delivery_id=? ORDER BY number DESC LIMIT 1').bind(delivery.id).first<{outcome:string}>()
 return {state:delivery.state,outcome:JSON.parse(attempt!.outcome) as {kind:string;code:string;status?:number}}
}

it('[INT-002] sends through the egress service binding and refuses private and redirect destinations without following them',async()=>{
 const g=await graph()
 // A private address is refused when the destination is saved, before any send.
 const literal=await request('/api/operator/integrations/destinations',{name:'Private target',kind:'webhook',endpoint:'https://10.0.0.5/penny',events:['status.published']},g.operator)
 expect(literal.status).toBe(422);expect(await count('penny_integration_destinations')).toBe(0)
 await connection(g.operator);await g.publish(0,'Approved public update')
 // A public name that resolves to a private address: refused at resolution, never dialled.
 const privateAnswer=egress(['93.184.216.34','10.0.0.5'],()=>new Response(null,{status:204}))
 const refused=await deliverThroughCron(privateAnswer.port)
 expect(privateAnswer.seen).toEqual({resolved:['events.example.com'],connected:[],fetched:[]})
 expect(refused).toEqual({state:'uncertain',outcome:{kind:'uncertain',code:'response_unknown'}})
 // A redirect is returned as a response, never followed, and never accepted.
 await g.publish(0,'Second update',1,'second-integration-update')
 const redirect=egress(['104.16.0.10'],()=>new Response(null,{status:302,headers:{Location:'https://169.254.169.254/latest/meta-data'}}))
 const redirected=await deliverThroughCron(redirect.port)
 expect(redirect.seen.fetched).toEqual([{url:'https://events.example.com/penny',redirect:'manual'}])
 expect(redirect.seen.connected).toEqual([])
 expect(redirected).toEqual({state:'uncertain',outcome:{kind:'uncertain',code:'webhook_response_uncertain',status:302}})
})
