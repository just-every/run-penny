import {pennyAgentDoor} from '../agent-door/index'
import {eventOrigin} from '../agent-door/event-tools'
import {D1SqlDatabase} from '../../../../base/modules/integrations/core/database.ts'
import {IntegrationsRepository} from '../../../../base/modules/integrations/core/repository.ts'
import {DeliveryService} from '../../../../base/modules/integrations/core/delivery.ts'
import {createWebhookProtocol} from '../../../../base/modules/integrations/core/webhook.ts'
import {createSlackNotifier} from '../../../../base/modules/integrations/slack/notifier.ts'
import {createSlackIncomingWebhookProtocol} from '../../../../base/modules/integrations/slack/protocol.ts'
import type {PennyRuntime} from '@/core/app/runtime'
import {destination,keyBytes,type Destination,integrationEvents} from './destinations'
import {integrationTransport,integrationAvailable} from './transport'
import {projectEvent,type ProductEvent} from './event-projection'
import {guardedDatabase} from './guarded-database'
import {NativeError} from '../auth/native-tokens'
export const deliveryNamespace='penny-events'
export function eventServices(runtime:PennyRuntime,now:()=>number=Date.now) {
 const transport=integrationTransport(runtime),guard={sql:"EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle')",params:[]}
 const repository=new IntegrationsRepository(new D1SqlDatabase(guardedDatabase(runtime.database.binding,guard)),deliveryNamespace)
 async function permitted(id:string,kind:Destination['kind']) {
  const value=await destination(runtime,id,kind)
  return value
 }
 const checkedTransport={send:async(wire:Parameters<typeof transport.send>[0])=>{
  const id=wire.headers['webhook-id']??wire.headers['penny-delivery-id']
  const current=await repository.get(id)
  if(!current)throw new NativeError('integration_delivery_unavailable',409)
  await destination(runtime,current.destinationId)
  const eventId=id.slice(0,id.lastIndexOf(':')),event=await runtime.database.binding.prepare('SELECT * FROM penny_integration_events WHERE id=?').bind(eventId).first<ProductEvent>()
  if(!event||!await projectEvent(runtime,event))throw new NativeError('integration_publication_unavailable',409)
  return transport.send(wire)
 }}
 const webhook=new DeliveryService({repository,transport:checkedTransport,now,protocols:[createWebhookProtocol({resolveDestination:async id=>(await permitted(id,'webhook')).endpoint,signingKey:async e=>keyBytes((await permitted(e.destinationId,'webhook')).signing_key!)})]})
 const templates=Object.fromEntries(integrationEvents.map(event=>[event,(data:{title:string;body?:string})=>({summary:data.title,sections:[data.title,...(data.body?[data.body.slice(0,2900)]:[])]})]))
 const slack=createSlackNotifier({repository,transport:checkedTransport,now,templates,incomingWebhook:async id=>(await permitted(id,'slack')).endpoint})
 const protocol=createSlackIncomingWebhookProtocol({resolveDestination:async id=>(await permitted(id,'slack')).endpoint})
 const slackSend=new DeliveryService({repository,transport:checkedTransport,now,protocols:[{...protocol,prepare:async(envelope,time)=>{const wire=await protocol.prepare(envelope,time);return {...wire,headers:{...wire.headers,'penny-delivery-id':envelope.id}}}}]})
 return {repository,webhook,slack,slackSend}
}
export async function drainIntegrations(runtime:PennyRuntime,now:()=>number=Date.now) {
 if(!integrationAvailable(runtime))return {state:'configuration-disabled',queued:0}
 const {repository,webhook,slack,slackSend}=eventServices(runtime,now),db=runtime.database.binding
 const {results:destinations}=await db.prepare("SELECT * FROM penny_integration_destinations WHERE kind IN('webhook','slack') AND revoked_at IS NULL ORDER BY id LIMIT 100").all<Destination>()
 const {results:events}=await db.prepare(`SELECT e.* FROM penny_integration_events e WHERE e.held=0 AND EXISTS(SELECT 1 FROM penny_integration_destinations d WHERE d.kind IN('webhook','slack') AND d.revoked_at IS NULL AND EXISTS(SELECT 1 FROM penny_integration_targets t WHERE t.event_id=e.id AND t.destination_id=d.id) AND NOT EXISTS(SELECT 1 FROM integration_deliveries i WHERE i.namespace='penny-events' AND i.id=e.id||':'||d.id)) ORDER BY e.created_at,e.id LIMIT 1000`).all<ProductEvent>()
 let queued=0
 for(const event of events){
  let projection=await projectEvent(runtime,event);const saved=await db.prepare("SELECT label FROM penny_agent_work WHERE kind='integration-event' AND id=?").bind(event.id).first<{label:string}>();if(projection&&saved)projection={...projection,title:projection.title+' — '+saved.label};if(!projection){await db.prepare('UPDATE penny_integration_events SET held=1 WHERE id=?').bind(event.id).run();continue}
  for(const target of destinations){
   if(!await db.prepare('SELECT id FROM penny_integration_targets WHERE event_id=? AND destination_id=?').bind(event.id,target.id).first())continue
   try{await destination(runtime,target.id)}catch{continue}
   const id=event.id+':'+target.id
   if(await repository.get(id))continue
   if(target.kind==='webhook')await webhook.enqueue({id,tenant:deliveryNamespace,destinationId:target.id,event:event.event,protocol:'webhook',body:JSON.stringify(projection)})
   else await slack.enqueue({id,tenant:deliveryNamespace,destinationId:target.id,event:event.event,mode:'incoming-webhook',data:projection})
   queued++
  }
 }
 // Protocol-selected dispatch avoids treating a Slack attempt as a webhook.
 await repository.recoverExpired(now())
 for(const id of await repository.due(now(),100)){
  const row=await repository.get(id)
  const saved=await eventOrigin(runtime,id)
  if(saved){await pennyAgentDoor(runtime).invoke('penny.integrations.dispatch',{id,idempotency_key:'integration:'+id},JSON.parse(saved.principal));continue}
  if(row?.protocol==='webhook')await webhook.dispatch(id)
  else if(row)await slackSend.dispatch(id)
 }
 return {state:'configured',queued}
}
