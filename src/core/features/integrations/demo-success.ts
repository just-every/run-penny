import type {WireRequest,WireResponse} from '../../../../base/modules/integrations/core/types'

/** Provider envelopes for demoEffect; never used by a production send. */
export function demoIntegrationSuccess(wire:WireRequest):WireResponse {
 const url=new URL(wire.url),headers={'content-type':'application/json'}
 if(url.hostname==='api.linear.app'){
  const input=JSON.parse(wire.body).variables.input,id=crypto.randomUUID()
  return {status:200,headers,body:JSON.stringify({data:{issueCreate:{success:true,issue:{id,title:input.title,url:`https://linear.app/demo/issue/DEMO-${Date.now()}`,team:{id:input.teamId}}}}})}
 }
 if(url.pathname==='/rest/api/3/issue'){
  const id=String(Date.now())
  return {status:201,headers,body:JSON.stringify({id,key:`DEMO-${id}`,self:`${url.origin}/rest/api/3/issue/${id}`})}
 }
 if(url.hostname==='hooks.slack.com')return {status:200,headers:{'content-type':'text/plain'},body:'ok'}
 return {status:200,headers,body:JSON.stringify({ok:true})}
}
