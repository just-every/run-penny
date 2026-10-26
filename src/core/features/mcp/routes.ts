import type {Hono} from 'hono'
import {z} from 'zod'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {MutationError} from '@/core/app/operator-mutations'
import {NativeError} from '../auth/native-tokens'
import {apiAuthority,apiScopes} from '../integrations/keys'
import {createRequestSchema} from '../integrations/api-routes'
import {portalReadService} from '../portal/service'
import {publicRequestFiltersSchema} from '../portal/routes'
import {createOperatorRequest} from '../requests/operator-context'
import {proxyVoteSchema,recordProxyVote} from '../requests/proxy-votes'

const versions=['2025-11-25','2025-06-18','2025-03-26']
const proxy=proxyVoteSchema.safeExtend({slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(128)})
const tools=[
 {name:'search_requests',scope:'requests:read',description:'Search published customer-safe requests.',schema:publicRequestFiltersSchema},
 {name:'read_roadmap',scope:'requests:read',description:'Read the published customer-safe roadmap.',schema:z.object({}).strict()},
 {name:'add_feedback',scope:'requests:write',description:'Capture feedback for operator review.',schema:createRequestSchema},
 {name:'record_proxy_vote',scope:'votes:write',description:'Record source-attributed customer demand without consent or verification.',schema:proxy},
] as const
const message=z.object({jsonrpc:z.literal('2.0'),id:z.union([z.string(),z.number()]).optional(),method:z.string(),params:z.record(z.string(),z.unknown()).optional()}).strict()
const call=z.object({name:z.string(),arguments:z.record(z.string(),z.unknown()).default({}),_meta:z.record(z.string(),z.unknown()).optional()}).strict()
const initialize=z.object({protocolVersion:z.string(),capabilities:z.record(z.string(),z.unknown()),clientInfo:z.object({name:z.string(),version:z.string()}).passthrough()}).passthrough()

/** Stateless MCP Streamable HTTP: one JSON response per request, no SSE or sessions. */
export function registerMcpRoutes(app:Hono<OperatorMutationEnvironment>){
 app.all('/api/mcp',async c=>{
  c.header('Cache-Control','private, no-store')
  if(c.req.method!=='POST'){c.header('Allow','POST');return c.body(null,405)}
  const failure=(id:string|number|null,code:number,text:string,status:400|200=200)=>c.json({jsonrpc:'2.0',id,error:{code,message:text}},status)
  if(!c.req.header('Content-Type')?.split(';')[0].trim().match(/^application\/json$/i))return c.body(null,415)
  let body:unknown
  try{body=await c.req.json()}catch{return failure(null,-32700,'Parse error',400)}
  const parsed=message.safeParse(body)
  if(!parsed.success)return failure(null,-32600,'Invalid Request',400)
  const rpc=parsed.data,id=rpc.id??null
  // Authenticate even handshake and notifications. Each scope is authorized by
  // the existing key door; no parallel identity or cached authorization exists.
  const allowed=new Set<typeof apiScopes[number]>()
  for(const scope of apiScopes){
   try{await apiAuthority(c.get('runtime'),c.req.raw,scope,'mcp');allowed.add(scope)}
   catch(error){if(!(error instanceof NativeError)||error.status!==401)throw error}
  }
  if(!allowed.size)throw new NativeError('integration_token_denied',401)
  if(rpc.id===undefined)return c.body(null,202)
  const protocol=c.req.header('MCP-Protocol-Version')
  if(protocol&&!versions.includes(protocol))return failure(id,-32600,'Unsupported protocol version',400)
  const result=(value:unknown)=>c.json({jsonrpc:'2.0',id,result:value})
  if(rpc.method==='initialize'){
   const input=initialize.safeParse(rpc.params)
   if(!input.success)return failure(id,-32602,'Invalid params')
   return result({protocolVersion:versions.includes(input.data.protocolVersion)?input.data.protocolVersion:versions[0],capabilities:{tools:{}},serverInfo:{name:'Penny',version:'1.0.0'}})
  }
  if(rpc.method==='ping')return result({})
  if(rpc.method==='tools/list')return result({tools:tools.filter(tool=>allowed.has(tool.scope)).map(tool=>({name:tool.name,description:tool.description,inputSchema:z.toJSONSchema(tool.schema,{target:'draft-7',unrepresentable:'any'})}))})
  if(rpc.method!=='tools/call')return failure(id,-32601,'Method not found')
  const input=call.safeParse(rpc.params)
  if(!input.success)return failure(id,-32602,'Invalid params')
  const tool=tools.find(tool=>tool.name===input.data.name)
  if(!tool)return failure(id,-32602,'Unknown tool')
  // Recheck at the operation, and retain the REST transaction's authority fence.
  const auth=await apiAuthority(c.get('runtime'),c.req.raw,tool.scope,tool.name)
  try{
   let value:unknown
   switch(tool.name){
    case 'search_requests':value=await portalReadService(auth.database).listRequests(publicRequestFiltersSchema.parse(input.data.arguments));break
    case 'read_roadmap':z.object({}).strict().parse(input.data.arguments);value=await portalReadService(auth.database).listRoadmap();break
    case 'add_feedback':{
     const feedback=createRequestSchema.parse(input.data.arguments)
     if(new Set(feedback.evidenceIds).size!==feedback.evidenceIds.length)throw new NativeError('validation_failed',400)
     value=await createOperatorRequest(auth.database,feedback,auth.actor.id);break
    }
    case 'record_proxy_vote':{
     const {slug,...vote}=input.data.arguments
     const key=z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(128).parse(slug)
     value=await recordProxyVote(auth.database.binding,key,proxyVoteSchema.parse(vote),auth.actor.id);break
    }
   }
   return result({content:[{type:'text',text:JSON.stringify(value)}]})
  }catch(error){
   if(error instanceof NativeError&&error.status===401)throw error
   if(error instanceof z.ZodError||error instanceof MutationError||error instanceof NativeError)return result({isError:true,content:[{type:'text',text:'Tool input or operation refused.'}]})
   throw error
  }
 })
}
