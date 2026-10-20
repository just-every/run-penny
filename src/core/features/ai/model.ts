import {reserve,settle,failReservation,type Reservation} from './budget'
import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError} from '../auth/native-tokens'
import {send} from '../learning/configuration'
import {selected,type Capability} from './configuration'
import {promptInput} from './privacy'
const usage=z.object({input:z.number().int().nonnegative(),output:z.number().int().nonnegative()})
/** One enforcing RPC path, one reservation, no retry after ambiguous paid work. */
export async function modelCall(runtime:PennyRuntime,db:D1Database,capability:Capability,instructions:string,input:unknown,schema:Record<string,unknown>,ceiling=Number.MAX_SAFE_INTEGER,onSend=async()=>{},prepaid?:Reservation){
 const c=await selected(runtime,db,capability),user=JSON.stringify(await promptInput(db,input))
 const body=JSON.stringify(c.provider==='openai'?{model:c.id,messages:[{role:'system',content:instructions},{role:'user',content:user}],max_completion_tokens:c.maxOutputTokens,response_format:{type:'json_schema',json_schema:{name:'penny_output',strict:true,schema}}}:{model:c.id,system:instructions,messages:[{role:'user',content:user}],max_tokens:c.maxOutputTokens,output_config:{format:{type:'json_schema',schema}}})
 // All prompt/schema UTF-8 bytes plus conservative provider framing. No tools,
 // images, caching, extended thinking or automatic provider calls are enabled.
 const upper=Math.ceil((new TextEncoder().encode(body).length+16000)*c.inputMicrosPerToken+c.maxOutputTokens*c.outputMicrosPerToken)
 if(!Number.isSafeInteger(upper)||upper>ceiling)throw new NativeError('learning_call_budget_exceeded',409)
 const native=runtime.database.binding,reservation=prepaid??await reserve(db,capability,c.provider,c.id,upper)
 let transmitted=false
 try{
  // Recheck operator/scope authority immediately before the network edge.
  await onSend();await db.prepare('SELECT 1').first();transmitted=true
  const response=await send(runtime,{url:c.provider==='openai'?'https://api.openai.com/v1/chat/completions':'https://api.anthropic.com/v1/messages',method:'POST',headers:c.provider==='openai'?{Authorization:`Bearer ${c.apiKey}`,'Content-Type':'application/json'}:{'x-api-key':c.apiKey,'anthropic-version':'2023-06-01','Content-Type':'application/json'},body})
  if(response.status!==200)throw new NativeError('learning_model_failed',409)
  let raw:Record<string,any>,tokens:z.infer<typeof usage>
  try{raw=JSON.parse(response.body);tokens=usage.parse(c.provider==='openai'?{input:raw.usage.prompt_tokens,output:raw.usage.completion_tokens}:{input:raw.usage.input_tokens,output:raw.usage.output_tokens})}catch{throw new NativeError('learning_model_payload_invalid',409)}
  const costMicros=Math.ceil(tokens.input*c.inputMicrosPerToken+tokens.output*c.outputMicrosPerToken)
  await settle(native,reservation,costMicros+reservation.extraMicros,tokens.input,tokens.output)
  if(costMicros>upper)throw new NativeError('learning_provider_cost_exceeded',409)
  let content:string
  try{
   if(c.provider==='openai'){if(raw.choices.length!==1||raw.choices[0].finish_reason!=='stop'||raw.choices[0].message.refusal)throw Error();content=z.string().parse(raw.choices[0].message.content)}
   else {if(raw.stop_reason!=='end_turn'||raw.content.length!==1||raw.content[0].type!=='text')throw Error();content=z.string().parse(raw.content[0].text)}
  }catch{throw new NativeError('learning_model_incomplete',409)}
  return {content,costMicros,runId:reservation.id,inputTokens:tokens.input,outputTokens:tokens.output}
 }catch(error){
  await failReservation(native,reservation,transmitted)
  throw error instanceof NativeError?error:new NativeError('learning_model_payload_invalid',409)
 }
}
