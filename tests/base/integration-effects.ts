import {expect} from 'vitest'
import {applyD1Migrations,reset,createScheduledController} from 'cloudflare:test'
import {env,origin,owner} from './support'
import {graph} from './notification-regression-fixture'
import {releaseGraph} from './release-fixture'
import {request,connection} from './integration-delivery-fixture'
import {apply,feedbackFixture} from './feedback-import-fixture'
import {createWebhookProtocol} from '../../base/modules/integrations/core/webhook'
import {runNotificationSchedule} from '@/core/features/notifications/scheduled'
import type {Archive,ErasureJournal} from '@/core/features/data/archive'
import type {WireRequest} from '../../base/modules/integrations/core/types'

/** Selected effects and their portable custody, through native HTTP doors. */
export async function proveExplicitIntegration(migrations:Parameters<typeof applyD1Migrations>[1]){
 await reset();await applyD1Migrations(env.DB,migrations)
 const g=await graph(),calls:WireRequest[]=[],edge={send:async(wire:WireRequest)=>{calls.push(structuredClone(wire));return {status:204,headers:{},body:''}}}
 let operator=g.operator
 const call=(path:string,body:unknown=undefined,method=body===undefined?'GET':'POST')=>request(path,body,operator,method,env.DB,edge)
 const json=async<T>(path:string,body:unknown=undefined,status=200,method=body===undefined?'GET':'POST')=>{const response=await call(path,body,method);expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<T>}
 const cron=()=>runNotificationSchedule(createScheduledController({scheduledTime:Date.now(),cron:'* * * * *'}),{...env,PENNY_EGRESS:edge,WORKSPACE_TIMEZONE:'UTC'})
 const events=['request.published','comment.published','status.published','release.published']
 const destinations=await Promise.all(events.map(event=>connection(operator,'webhook',[event],edge)))
 expect((await call('/api/operator/integrations/destinations',{name:'synthetic-penny-unapproved',kind:'webhook',endpoint:'https://events.example.com/penny',events:['request.private']})).status).toBe(400)
 const subject=await json<{id:string;slug:string}>('/api/operator/requests',{title:'synthetic-penny-private-title',description:'synthetic-penny-private-evidence',boardSlug:'regression'},201)
 await json('/api/operator/moderation/'+subject.slug,{verdict:'approved',title:'synthetic-penny-approved-request',description:'synthetic-penny-approved-description',boardSlug:'regression',displayName:'Product team'})
 await json('/api/operator/requests/'+subject.slug+'/comments',{body:'synthetic-penny-approved-reply'},201)
 const publish=(body:string,status='under_review')=>call('/api/operator/requests/'+subject.slug+'/status-updates',{status,body,idempotencyKey:crypto.randomUUID()})
 expect((await publish('synthetic-penny-approved-status')).status).toBe(200)
 const release=await releaseGraph(1,false,g)
 await json('/api/operator/releases/'+release.draft.slug+'/publish',{})
 const targets=async()=>(await env.DB.prepare('SELECT e.event,t.event_id,t.destination_id FROM penny_integration_targets t JOIN penny_integration_events e ON e.id=t.event_id ORDER BY t.id').all<{event:string;event_id:string;destination_id:string}>()).results
 const captured=await targets()
 expect(captured.map(row=>({event:row.event,destination:row.destination_id})).sort((a,b)=>a.event.localeCompare(b.event))).toEqual(events.map((event,index)=>({event,destination:destinations[index].id})).sort((a,b)=>a.event.localeCompare(b.event)))
 // No edit door can retarget committed history. A changed endpoint is a new record.
 const original=destinations[0]
 expect((await call('/api/operator/integrations/destinations/'+original.id,{endpoint:'https://events.example.com/replacement'},'PATCH')).ok).toBe(false)
 const replacement=await json<{id:string}>('/api/operator/integrations/destinations',{name:'synthetic-penny-replacement',kind:'webhook',endpoint:'https://events.example.com/replacement',events:['request.published']},201)
 expect(replacement.id).not.toBe(original.id)
 expect(await env.DB.prepare('SELECT endpoint FROM penny_integration_credentials WHERE id=?').bind(original.id).first('endpoint')).toBe('https://events.example.com/penny')
 expect(await targets()).toEqual(captured)
 // A late target failure must roll back the business publication and event too.
 const before={request:await env.DB.prepare('SELECT * FROM requests WHERE id=?').bind(subject.id).first(),updates:(await env.DB.prepare('SELECT * FROM request_status_updates ORDER BY id').all()).results,events:(await env.DB.prepare('SELECT * FROM penny_integration_events ORDER BY id').all()).results,targets:await targets()}
 await env.DB.exec("CREATE TRIGGER synthetic_penny_target_failure BEFORE INSERT ON penny_integration_targets BEGIN SELECT RAISE(ABORT,'synthetic target failure'); END")
 try{expect((await publish('synthetic-penny-uncommitted-status','planned')).status).toBe(503)}finally{await env.DB.exec('DROP TRIGGER synthetic_penny_target_failure')}
 expect({request:await env.DB.prepare('SELECT * FROM requests WHERE id=?').bind(subject.id).first(),updates:(await env.DB.prepare('SELECT * FROM request_status_updates ORDER BY id').all()).results,events:(await env.DB.prepare('SELECT * FROM penny_integration_events ORDER BY id').all()).results,targets:await targets()}).toEqual(before)
 await cron()
 expect(calls.map(wire=>JSON.parse(wire.body).event).sort()).toEqual([...events].sort())
 for(const wire of calls){expect(wire.url).toBe('https://events.example.com/penny');expect(wire.body).not.toContain('synthetic-penny-private')}
 const completed=(await env.DB.prepare('SELECT * FROM integration_attempts ORDER BY id').all()).results
 expect(completed).toHaveLength(captured.length)
 // Saved history cannot manufacture a live event or outbound call.
 await apply(feedbackFixture('synthetic-penny-integration-history'),operator)
 await cron();expect(calls).toHaveLength(captured.length);expect(await targets()).toEqual(captured)
 // A signed receiver contributes an actual retained receipt, never a fabricated row.
 const receiver=await connection(operator,'receiver',[],edge)
 const protocol=createWebhookProtocol({resolveDestination:async()=>origin,signingKey:async()=>Uint8Array.from(receiver.signingKey.match(/../g)!,value=>parseInt(value,16))})
 const wire=await protocol.prepare({id:'synthetic-penny-receipt',tenant:'penny-inbound',destinationId:receiver.id,event:'request.note',protocol:'webhook',body:JSON.stringify({requestId:subject.id,note:'synthetic-penny-private-receiver-note'})},Date.now())
 const {createPennyApi}=await import('@/core/app/api')
 const response=await createPennyApi().fetch(new Request(origin+'/api/integrations/webhooks/'+receiver.id,{method:'POST',headers:wire.headers,body:wire.body}),env)
 expect(response.status).toBe(200)
 const receipts=(await env.DB.prepare('SELECT * FROM penny_integration_receipts ORDER BY id').all()).results
 expect(receipts).toHaveLength(1)
 const bundle=await json<{archive:Archive;journal:ErasureJournal}>('/api/operator/data/export')
 expect(bundle.archive.tables.penny_integration_targets).toEqual((await env.DB.prepare('SELECT * FROM penny_integration_targets ORDER BY id').all()).results)
 expect(bundle.archive.tables.integration_attempts).toEqual(completed)
 expect(bundle.archive.tables.penny_integration_receipts).toEqual(receipts)
 expect(bundle.archive.tables.penny_integration_events.every(row=>row.held===1)).toBe(true)
 for(const value of [receiver.signingKey,'https://events.example.com/penny','https://events.example.com/replacement'])expect(JSON.stringify(bundle)).not.toContain(value)
 expect(bundle.archive.tables.penny_integration_credentials).toBeUndefined()
 await reset();await applyD1Migrations(env.DB,migrations);operator=await owner({timezone:'UTC'})
 await json('/api/operator/data/import',bundle)
 expect((await env.DB.prepare('SELECT * FROM integration_attempts ORDER BY id').all()).results).toEqual(completed)
 expect((await env.DB.prepare('SELECT * FROM penny_integration_receipts ORDER BY id').all()).results).toEqual(receipts)
 expect(await env.DB.prepare('SELECT count(*) n FROM penny_integration_credentials').first('n')).toBe(0)
 expect(await env.DB.prepare('SELECT count(*) n FROM penny_integration_destinations WHERE revoked_at IS NULL').first('n')).toBe(0)
 expect(await env.DB.prepare('SELECT count(*) n FROM penny_integration_events WHERE held=0').first('n')).toBe(0)
 const sent=calls.length
 await cron()
 // Even newly entered credentials do not acquire restored historical targets.
 await connection(operator,'webhook',events,edge);await cron()
 expect(calls).toHaveLength(sent)
}
