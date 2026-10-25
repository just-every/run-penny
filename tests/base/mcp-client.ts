import {Client} from '@modelcontextprotocol/sdk/client/index.js'
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import {expect} from 'vitest'
import {env,origin} from './support'
import {createPennyApi} from '@/core/app/api'

/** Official client, using the Worker's public HTTP door as its fetch transport. */
export async function mcpProof(operator:Record<string,string>,fixtureSlug:string){
 const api=createPennyApi()
 const http=async(path:string,body?:unknown,headers:Record<string,string>={},method=body===undefined?'GET':'POST')=>api.fetch(new Request(origin+path,{method,headers:{Origin:origin,...headers,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})}),env)
 const issue=async(scopes:string[])=>{
  const response=await http('/api/operator/integrations/keys',{name:'synthetic-penny-1',scopes},operator)
  expect(response.status).toBe(201)
  return response.json() as Promise<{token:string;credential:{id:string}}>
 }
 const connect=async(token:string)=>{
  const client=new Client({name:'synthetic-penny-1',version:'1.0.0'})
  const transport=new StreamableHTTPClientTransport(new URL(origin+'/api/mcp'),{
   requestInit:{headers:{Authorization:'Bearer '+token}},
   fetch:async(input,init)=>api.fetch(new Request(input,init),env),
  })
  await client.connect(transport)
  return client
 }
 const read=await issue(['requests:read']),write=await issue(['requests:write','votes:write'])
 const reader=await connect(read.token),writer=await connect(write.token)
 try{
  expect((await reader.listTools()).tools.map(tool=>tool.name).sort()).toEqual(['read_roadmap','search_requests'])
  expect((await writer.listTools()).tools.map(tool=>tool.name).sort()).toEqual(['add_feedback','record_proxy_vote'])
  await reader.ping()
  const search=await reader.callTool({name:'search_requests',arguments:{q:'Public request'}})
  expect(JSON.stringify(search)).toContain(fixtureSlug)
  const roadmap=await reader.callTool({name:'read_roadmap',arguments:{}})
  expect(JSON.parse((roadmap.content as {text:string}[])[0].text)).toEqual(await (await http('/api/public/roadmap')).json())
  const counts=async()=>({requests:await env.DB.prepare('SELECT count(*) n FROM requests').first('n'),votes:await env.DB.prepare('SELECT count(*) n FROM penny_proxy_votes').first('n'),audits:await env.DB.prepare('SELECT count(*) n FROM audit_entries').first('n')})
  const input={title:'synthetic-penny-2',description:'Private capture context',boardSlug:'regression'}
  const before=await counts()
  await expect(reader.callTool({name:'add_feedback',arguments:input})).rejects.toThrow()
  expect(await counts()).toEqual(before)
  const added=await writer.callTool({name:'add_feedback',arguments:input})
  expect(added.isError).not.toBe(true)
  const captured=JSON.parse((added.content as {text:string}[])[0].text) as {id:string;slug:string}
  expect(await env.DB.prepare('SELECT title,description FROM requests WHERE id=?').bind(captured.id).first()).toEqual({title:input.title,description:input.description})
  // The same REST capture is held for review; approve it through the existing door,
  // then read it back through the scoped REST public projection.
  expect((await http('/api/operator/moderation/'+captured.slug,{verdict:'approved',...input,displayName:'synthetic-penny-2'},operator)).status).toBe(200)
  expect(await (await http('/api/v1/requests',undefined,{Authorization:'Bearer '+read.token})).text()).toContain(captured.slug)
  const vote=await writer.callTool({name:'record_proxy_vote',arguments:{slug:fixtureSlug,contact:{displayName:'synthetic-penny-3'},source:'synthetic-penny-3'}})
  expect(vote.isError).not.toBe(true)
  expect((await counts()).votes).toBe(Number(before.votes)+1)
  const actor=await env.DB.prepare('SELECT actor_id FROM penny_api_issuers WHERE token_id=?').bind(write.credential.id).first('actor_id')
  for(const action of ['request.created','request.proxy_vote_recorded']){
   expect(await env.DB.prepare('SELECT count(*) n FROM audit_entries WHERE action=? AND actor_id=?').bind(action,actor).first('n')).toBe(1)
  }
  const after=await counts()
  const call={jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'add_feedback',arguments:input}}
  for(const mode of ['missing','revoked','expired']){
   if(mode==='revoked')expect((await http('/api/operator/integrations/keys/'+write.credential.id,{},operator,'DELETE')).status).toBe(200)
   if(mode==='expired')await env.DB.prepare('UPDATE integration_tokens SET revoked_at=NULL,expires_at=1 WHERE id=?').bind(write.credential.id).run()
   const checkpoint=await counts()
   expect((await http('/api/mcp',call,mode==='missing'?{}:{Authorization:'Bearer '+write.token})).status).toBe(401)
   expect(await counts()).toEqual(checkpoint)
  }
  expect((await counts()).requests).toBe(after.requests)
  const headers={Authorization:'Bearer '+read.token}
  expect((await http('/api/mcp',undefined,headers)).status).toBe(405)
  expect((await http('/api/mcp',{jsonrpc:'2.0',method:'notifications/initialized'},headers)).status).toBe(202)
  for(const [body,code] of [[{},-32600],[{jsonrpc:'2.0',id:1,method:'unknown'},-32601],[{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'unknown'}},-32602]] as const){
   expect(await (await http('/api/mcp',body,headers)).json()).toMatchObject({error:{code}})
  }
 }finally{await reader.close();await writer.close()}
}
