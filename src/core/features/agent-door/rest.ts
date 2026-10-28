import type {PennyRuntime} from '@/core/app/runtime'
import {pennyAgentDoor} from './index'

/** Compatibility routes use the canonical MCP credential and policy admission. */
export async function agentRest(runtime:PennyRuntime,request:Request,name:string,args:Record<string,unknown>,successStatus=200){
 const headers=new Headers(request.headers)
 headers.set('Content-Type','application/json');headers.set('Accept','application/json');headers.set('MCP-Protocol-Version','2025-11-25')
 const key=request.headers.get('Idempotency-Key')
 const response=await pennyAgentDoor(runtime).handle(new Request(new URL('/mcp',runtime.configuration.appOrigin),{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',id:crypto.randomUUID(),method:'tools/call',params:{name:'penny.'+name,arguments:{...args,...(key?{idempotency_key:key}:{})}}})}))
 if(!response)return Response.json({code:'agent_door_unavailable'},{status:503})
 const answer=await response.json() as {result?:{structuredContent?:unknown;isError?:boolean;resultType?:string;_meta?:Record<string,unknown>};error?:{data?:{code?:string}}}
 const error=answer.result?._meta?.['com.runeditrun/error'] as {code?:string}|undefined
 if(error||answer.error){const code=error?.code??answer.error?.data?.code??'agent_refused';return Response.json({code},{status:response.status===401||['integration_authority_changed','sponsor_inactive','unauthenticated'].includes(code)?401:code==='not_found'?404:/conflict|revision/.test(code)?409:code==='invalid_arguments'||code==='idempotency_key_required'?400:403})}
 if(answer.result?.resultType==='input_required')return Response.json({pending:true,...answer.result._meta},{status:202})
 const value=answer.result?.structuredContent as Record<string,unknown>|undefined
 const result=value&&'items' in value&&['boards.public','comments.public','status.public','votes.contacts','releases.public','requests.public'].includes(name)?value.items:value
 return Response.json(result??{code:'agent_response_invalid'},{status:successStatus})
}
