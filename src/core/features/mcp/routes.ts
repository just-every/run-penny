import type {Hono} from 'hono'
import {ZodError} from 'zod'
import type {ContentfulStatusCode} from 'hono/utils/http-status'
import {version} from '../../../../package.json'
import {MutationError,type OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {NativeError} from '../auth/native-tokens'
import {RequestLifecycleError} from '../requests/lifecycle-types'
import {boundedRawBody} from '../integrations/raw-body'
import {mcpAuthority} from './authority'
import {executeTool,toolScope,toolsFor} from './tools'
import type {ToolName} from './schemas'
import {McpError,envelope,initializeInput,listInput,protocolVersion,toolCallInput,transport} from './protocol'
export function registerMcpRoutes(app:Hono<OperatorMutationEnvironment>){
 app.all('/api/mcp',async c=>{
  c.header('Cache-Control','private, no-store');c.header('X-Content-Type-Options','nosniff')
  let id:string|number|null=null
  try{
   const runtime=c.get('runtime'),request=c.req.raw
   if(!runtime.configuration.appOrigin)throw new McpError(-32603,'Origin is not configured.',503)
   transport(request,runtime.configuration.appOrigin)
   let value:unknown
   try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await boundedRawBody(request)))}catch(error){if(error instanceof NativeError)throw error;throw new McpError(-32700,'Invalid JSON.')}
   const parsed=envelope.safeParse(value)
   if(!parsed.success)throw new McpError(-32600,'Invalid JSON-RPC request.')
   const message=parsed.data;id=message.id??null
   const resource=['initialize','notifications/initialized','ping','tools/list','tools/call'].includes(message.method)?message.method:'unknown-method'
   const access=await mcpAuthority(runtime,request,resource)
   if(message.method!=='initialize'&&request.headers.get('MCP-Protocol-Version')!==protocolVersion)throw new McpError(-32600,`Use MCP-Protocol-Version: ${protocolVersion}.`)
   if(message.method==='notifications/initialized'){
    if(message.id!==undefined)throw new McpError(-32600,'Initialized is a notification.')
    listInput.parse(message.params??{})
    return c.body(null,202)
   }
   if(message.id===undefined)throw new McpError(-32600,'This method requires a request id.')
   let result:unknown
   switch(message.method){
    case 'initialize':initializeInput.parse(message.params);result={protocolVersion,capabilities:{tools:{}},serverInfo:{name:'penny',version},instructions:'Scoped-key access only. Search and roadmap use public projections. Feedback remains unpublished. Evidence search and OAuth are not available.'};break
    case 'ping':listInput.parse(message.params??{});result={};break
    case 'tools/list':listInput.parse(message.params??{});result={tools:toolsFor(access.scopes)};break
    case 'tools/call':{
     const input=toolCallInput.parse(message.params),scope=toolScope(input.name,access.scope)
     if(scope===undefined)throw new McpError(-32602,'Unknown tool.')
     // The same authority is selected by the tool on every call; arguments can
     // neither select a scope nor name another operator as the actor.
     try{const data=await executeTool(runtime,request,input.name as ToolName,input.arguments,scope!);result={content:[{type:'text',text:JSON.stringify(data)}]}}catch(error){
      if(error instanceof MutationError||error instanceof RequestLifecycleError)result={isError:true,content:[{type:'text',text:error instanceof MutationError?error.message:error.code}]}
      else throw error
     }
     break
    }
    default:throw new McpError(-32601,'Method not found.',404)
   }
   return c.json({jsonrpc:'2.0',id,result})
  }catch(error){
   const failure=error instanceof McpError?error:error instanceof ZodError?new McpError(-32602,'Invalid method arguments.'):error instanceof NativeError?new McpError(error.status===401||error.status===403?-32001:-32602,error.code,error.status as McpError['status']):new McpError(-32603,'MCP storage operation failed.',503)
   if(failure.status===405)c.header('Allow','POST')
   return c.json({jsonrpc:'2.0',id,error:{code:failure.code,message:failure.message}},failure.status as ContentfulStatusCode)
  }
 })
}
