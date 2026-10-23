import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {apiAuthority} from '../integrations/keys'
import {NativeError} from '../auth/native-tokens'
import {portalReadService} from '../portal/service'
import {createOperatorRequest} from '../requests/operator-context'
import {recordProxyVote} from '../requests/proxy-votes'
import {toolInputs,feedbackInput,proxyInput,searchInput,roadmapInput,type ToolName} from './schemas'
import type {ApiScope} from './authority'
const catalog:{name:ToolName;description:string;scope:ApiScope|null;readOnly:boolean}[]=[
 {name:'search_requests',description:'Search published, customer-safe requests. Private evidence and operator fields are excluded.',scope:'requests:read',readOnly:true},
 {name:'read_roadmap',description:'Read the same approved, customer-safe roadmap shown on the portal.',scope:null,readOnly:true},
 {name:'add_feedback',description:'Capture feedback as an unpublished request awaiting operator review. This does not publish or grant notification consent.',scope:'requests:write',readOnly:false},
 {name:'record_proxy_vote',description:'Record a customer’s vote with its supplied source. This does not verify identity or create notification permission.',scope:'votes:write',readOnly:false},
]
export function toolsFor(scopes:readonly string[]){return catalog.filter(tool=>tool.scope===null||scopes.includes(tool.scope)).map(tool=>({name:tool.name,description:tool.description,inputSchema:z.toJSONSchema(toolInputs[tool.name],{io:'input'}),annotations:{readOnlyHint:tool.readOnly,destructiveHint:false,openWorldHint:false}}))}
export function toolScope(name:string,readScope:ApiScope):ApiScope|null|undefined{const tool=catalog.find(tool=>tool.name===name);return tool?tool.scope??readScope:undefined}
export async function executeTool(runtime:PennyRuntime,request:Request,name:ToolName,args:unknown,scope:ApiScope){
 const auth=await apiAuthority(runtime,request,scope,`mcp/${name}`)
 switch(name){
  case 'search_requests':return portalReadService(auth.database).listRequests(searchInput.parse(args))
  case 'read_roadmap':roadmapInput.parse(args);return portalReadService(auth.database).listRoadmap()
  case 'add_feedback':{
   const input=feedbackInput.parse(args)
   if(new Set(input.evidenceIds).size!==input.evidenceIds.length)throw new NativeError('validation_failed',400)
   const created=await createOperatorRequest(auth.database,input,auth.actor.id)
   return {slug:created.slug,reviewRequired:true}
  }
  case 'record_proxy_vote':{const input=proxyInput.parse(args),result=await recordProxyVote(auth.database.binding,input.requestSlug,input.vote,auth.actor.id);return {requestSlug:input.requestSlug,recorded:result.created}}
 }
}
