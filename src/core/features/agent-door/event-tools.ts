import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import type {ToolContext} from '../../../../base/modules/agent-door/types.ts'
import {ToolRefusal} from '../../../../base/modules/agent-door/errors.ts'
import {tool,id,external} from './tool'
import {eventServices} from '../integrations/delivery'

export async function eventOrigin(runtime:PennyRuntime,deliveryId:string){
 const eventId=deliveryId.slice(0,deliveryId.lastIndexOf(':'))
 return runtime.database.binding.prepare("SELECT principal,label FROM penny_agent_work WHERE kind='integration-event' AND id=?").bind(eventId).first<{principal:string;label:string}>()
}
async function own(runtime:PennyRuntime,deliveryId:string,ctx:ToolContext){
 const row=await eventOrigin(runtime,deliveryId)
 if(!row)throw new ToolRefusal('agent_delivery_not_owned')
 const p=JSON.parse(row.principal)
 if(p.person.id!==ctx.person.id||p.agent.id!==ctx.agent.id||p.consent!==ctx.consent||(p.clientId??null)!==(ctx.clientId??null))throw new ToolRefusal('agent_delivery_not_owned')
}
export function eventTools(runtime:PennyRuntime){return [tool(runtime,{name:'integrations.dispatch',title:'Dispatch one retained signed webhook or Slack event',scope:'delivery:write',clauses:['INT-001','INT-003','SURFACE-003'],classes:['external'],schema:z.object({id}),classify:async(a,_n,c)=>{await own(runtime,a.id,c);return external('known',1)},summary:async(a)=>({target:{id:a.id},items:['One currently authorized native event projection; recipient and signing credentials stay in native custody.']}),run:async(a,n,c)=>{await own(runtime,a.id,c);const {repository,webhook,slackSend}=eventServices({...runtime,database:n.database});const row=await repository.get(a.id);if(!row)throw new ToolRefusal('not_found');if(row.protocol==='webhook')await webhook.dispatch(a.id);else await slackSend.dispatch(a.id);const result=await repository.get(a.id);return {id:a.id,state:result?.state}}})]}
