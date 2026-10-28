import type {PennyRuntime} from '@/core/app/runtime'
import type {ToolContext} from '../../../../base/modules/agent-door/types.ts'
import {pennyAgentDoor} from './index'
import {ToolRefusal} from '../../../../base/modules/agent-door/errors.ts'

export async function deliveryOrigin(runtime:PennyRuntime,kind:'request'|'release'|'rejection',id:string){
 const db=runtime.database.binding
 const rows=kind==='request'?(await db.prepare("SELECT DISTINCT w.principal,w.label FROM penny_agent_work w JOIN notification_intents i ON i.event_id=w.id WHERE w.kind='notification-event' AND i.batch_id=?").bind(id).all<{principal:string;label:string}>()).results:(await db.prepare("SELECT principal,label FROM penny_agent_work WHERE kind='mail-outbox' AND id=?").bind(id).all<{principal:string;label:string}>()).results
 if(!rows.length)return null
 if(new Set(rows.map(row=>row.principal)).size!==1)throw new ToolRefusal('mixed_agent_delivery_authority')
 return rows[0]
}
export async function sameDeliveryOrigin(runtime:PennyRuntime,kind:'request'|'release'|'rejection',id:string,ctx:ToolContext){
 const saved=await deliveryOrigin(runtime,kind,id)
 if(!saved)throw new ToolRefusal('agent_delivery_not_owned')
 const principal=JSON.parse(saved.principal)
 if(!Array.isArray(principal.scopes)||principal.scopes.some((scope:string)=>!ctx.scopes.includes(scope)))throw new ToolRefusal('insufficient_scope')
 if(principal.person.id!==ctx.person.id||principal.agent.id!==ctx.agent.id||(principal.clientId??null)!==(ctx.clientId??null)||(principal.consent??null)!==(ctx.consent??null))throw new ToolRefusal('agent_delivery_not_owned')
 return saved
}
/** Native workers hand off exactly the retained actor, consent and original
 * scopes before claiming an attempt; an approval never owns a provider lease. */
export async function deferredDelivery(runtime:PennyRuntime,kind:'request'|'release'|'rejection',id:string){
 const saved=await deliveryOrigin(runtime,kind,id)
 if(!saved)return false
 const result=await pennyAgentDoor(runtime).invoke('penny.deliveries.dispatch',{kind,id,idempotency_key:`delivery:${kind}:${id}`},JSON.parse(saved.principal))
 if(result.outcome==='refused'){
  if(kind==='request')await runtime.database.binding.prepare("UPDATE notification_batches SET state='suppressed',failure_reason=? WHERE id=? AND state='queued'").bind(result.code??'agent_refused',id).run()
  else await runtime.database.binding.prepare("UPDATE notification_outbox SET delivery_state='suppressed',failure_reason=? WHERE id=? AND delivery_state='queued' AND claim_id IS NULL").bind(result.code??'agent_refused',id).run()
 }
 return true
}
