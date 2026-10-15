import {demoEffect} from '../../../../base/modules/demo/index.mjs'
import {demoLearningSuccess} from './demo-success'
import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError} from '../auth/native-tokens'
import {validateDestination} from '../../../../base/modules/integrations/core/destination'
const config=z.object({orbit:z.object({origin:z.string().url(),token:z.string().min(1),installationId:z.string().min(1),audiencePrincipalIds:z.array(z.string().min(1)).min(1),readCostMicros:z.number().int().nonnegative()}).strict().optional(),model:z.object({apiKey:z.string().min(1),model:z.string().min(1),inputMicrosPerToken:z.number().finite().nonnegative(),outputMicrosPerToken:z.number().finite().nonnegative(),maxOutputTokens:z.number().int().min(1).max(16000)}).strict().optional()}).strict()
export type LearningConfiguration=z.infer<typeof config>
export interface LearningWire {url:string;method:'GET'|'POST';headers:Record<string,string>;body:string}
/** Deployment-owned RPC: enforce public DNS/IP at connection, verified TLS,
 * no redirects, exact requested method, and bounded responses. Never ordinary fetch. */
export interface LearningEgress {send(request:LearningWire):Promise<{status:number;headers:Record<string,string>;body:string}>}
export function learningConfiguration(runtime:PennyRuntime):LearningConfiguration{
 if(!runtime.bindings.PENNY_LEARNING)return {}
 try{return config.parse(JSON.parse(runtime.bindings.PENNY_LEARNING))}catch{throw new NativeError('learning_configuration_invalid',503)}
}
export async function send(runtime:PennyRuntime,wire:LearningWire){
 const port=runtime.bindings.PENNY_LEARNING_EGRESS
 if(!port)throw new NativeError('learning_transport_unconfigured',503)
 validateDestination(wire.url)
 if(new TextEncoder().encode(wire.body).length>512*1024)throw new NativeError('learning_request_limit',413)
 let response:Awaited<ReturnType<LearningEgress['send']>>
 try{response=await (wire.method==='GET'?port.send(wire):demoEffect(()=>port.send(wire),()=>demoLearningSuccess(wire)))}catch{throw new NativeError('learning_transport_failed',409)}
 if(!response||!Number.isInteger(response.status)||response.status<100||response.status>599||typeof response.body!=='string'||new TextEncoder().encode(response.body).length>512*1024)throw new NativeError('learning_response_limit',413)
 return response
}
