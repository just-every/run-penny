import {WorkerEntrypoint} from 'cloudflare:workers'

/** Only the paid RPC edge is replaced. The native prompt, privacy, model,
 * budget, receipts, persistence and sponsor checks run in the product Worker. */
export class LearningEgress extends WorkerEntrypoint {
 async send(wire) {
  const {url,method,headers,body}=wire??{}
  if(url!=='https://api.anthropic.com/v1/messages'||method!=='POST'||typeof body!=='string'||new TextEncoder().encode(body).length>512*1024)throw new Error('unexpected_provider_request')
  if(headers?.['Content-Type']!=='application/json'||headers?.['anthropic-version']!=='2023-06-01'||!headers?.['x-api-key']||Object.keys(headers).some(key=>!['Content-Type','anthropic-version','x-api-key'].includes(key)))throw new Error('invalid_provider_headers')
  const payload=JSON.parse(body)
  if(payload.model!=='penny-conformance-model'||payload.thinking?.type!=='disabled'||payload.max_tokens!==1024||typeof payload.system!=='string'||!payload.system.includes('untrusted evidence')||payload.messages?.length!==1||payload.messages[0].role!=='user'||payload.output_config?.format?.type!=='json_schema'||payload.output_config.format.schema?.type!=='object')throw new Error('invalid_native_model_payload')
  const prompt=JSON.parse(payload.messages[0].content)
  if(!['summary','reply'].includes(prompt.task)||typeof prompt.preparedBy!=='string'||!prompt.preparedBy.includes(' for ')||!Array.isArray(prompt.sources)||!prompt.sources.length||prompt.sources.some(s=>typeof s.id!=='string'||typeof s.text!=='string'))throw new Error('invalid_native_draft_context')
  const schema=payload.output_config.format.schema
  if(!schema.properties?.paragraphs?.items?.properties?.citationIds)throw new Error('unexpected_native_output_schema')
  const result={paragraphs:[{text:'Customers asked for a clearer delivery history. This draft is ready for operator review.',citationIds:[prompt.sources[0].id]}]}
  return {status:200,headers:{'content-type':'application/json','request-id':crypto.randomUUID()},body:JSON.stringify({id:'msg_'+crypto.randomUUID(),type:'message',role:'assistant',model:payload.model,content:[{type:'text',text:JSON.stringify(result)}],stop_reason:'end_turn',usage:{input_tokens:120,output_tokens:40}})}
 }
}
