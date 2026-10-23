import {exports} from 'cloudflare:workers'
import {expect} from 'vitest'
import {call,env,origin} from './support'
import {releaseGraph} from './release-fixture'
import type {graph} from './notification-regression-fixture'
interface RpcResult {jsonrpc:string;id:number|null;result?:Record<string,unknown>;error?:{code:number;message:string}}
/** A small wire client: real HTTP initialize, notification, negotiated headers,
 * request/response IDs, tool discovery and text-content decoding. */
class McpClient {
 private nextId=0
 version:string|undefined
 constructor(readonly headers:Record<string,string>){ }
 async send(method:string,params?:unknown,status=200){
  const id=++this.nextId,response=await call('/api/mcp',{jsonrpc:'2.0',id,method,...(params===undefined?{}:{params})},{Accept:'application/json, text/event-stream',...this.headers,...(this.version?{'MCP-Protocol-Version':this.version}:{})})
  expect(response.status).toBe(status)
  const message=await response.json() as RpcResult
  expect(message).toMatchObject({jsonrpc:'2.0',id})
  return message
 }
 async initialize(){
  const message=await this.send('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'synthetic-penny-20 conformance client',version:'1'}})
  expect(message.result).toMatchObject({capabilities:{tools:{}},serverInfo:{name:expect.any(String),version:expect.any(String)},protocolVersion:expect.any(String)})
  this.version=message.result!.protocolVersion as string
  const initialized=await call('/api/mcp',{jsonrpc:'2.0',method:'notifications/initialized'},{Accept:'application/json, text/event-stream',...this.headers,'MCP-Protocol-Version':this.version})
  expect(initialized.status).toBe(202);expect(await initialized.text()).toBe('')
 }
 async tools(){const result=await this.send('tools/list');return (result.result!.tools as {name:string;inputSchema:{type:string}}[])}
 async tool(name:string,args:unknown,status=200){const message=await this.send('tools/call',{name,arguments:args},status);if(!message.result)return message;const result=message.result as {content:{type:string;text:string}[];isError?:boolean};expect(result.isError).not.toBe(true);expect(result.content[0].type).toBe('text');return JSON.parse(result.content[0].text) as Record<string,unknown>}
}
export async function proveMcp(g:Awaited<ReturnType<typeof graph>>){
 await releaseGraph(1,false,g)
 const issue=async(scopes:string[])=>{const response=await call('/api/operator/integrations/keys',{name:'synthetic-penny-21 MCP key',scopes},g.operator);expect(response.status).toBe(201);const issued=await response.json() as {token:string;credential:{id:string}};return {...issued,headers:{Authorization:`Bearer ${issued.token}`}}}
 const read=await issue(['requests:read']),write=await issue(['requests:write']),votes=await issue(['votes:write'])
 const reader=new McpClient(read.headers),writer=new McpClient(write.headers),voter=new McpClient(votes.headers)
 for(const client of [reader,writer,voter])await client.initialize()
 expect((await reader.send('ping')).result).toEqual({})
 const listed=await reader.tools()
 expect(listed.map(t=>t.name)).toEqual(['search_requests','read_roadmap'])
 expect(listed.every(t=>t.inputSchema.type==='object')).toBe(true)
 expect((await writer.tools()).map(t=>t.name)).toEqual(['read_roadmap','add_feedback'])
 expect((await voter.tools()).map(t=>t.name)).toEqual(['read_roadmap','record_proxy_vote'])
 const search=await reader.tool('search_requests',{q:'Public request'}),restSearch=await(await call('/api/v1/requests?q=Public%20request',undefined,read.headers)).json()
 expect(search).toEqual(restSearch)
 const roadmap=await writer.tool('read_roadmap',{}),publicRoadmap=await(await call('/api/public/roadmap')).json()
 expect(roadmap).toEqual(publicRoadmap)
 expect(JSON.stringify(roadmap)).not.toContain('Private commercial rationale')
 const input={title:'synthetic-penny-22 MCP feedback',description:'Finance requested a monthly workflow improvement.',boardSlug:'regression'}
 const captured=await writer.tool('add_feedback',input) as {slug:string;reviewRequired:boolean}
 expect(captured.reviewRequired).toBe(true)
 const stored=await env.DB.prepare('SELECT id,title,description,board_id,author_operator_id,moderation_state,public_state FROM requests WHERE slug=?').bind(captured.slug).first<Record<string,string>>()
 const rest=await call('/api/v1/requests',{...input,title:'synthetic-penny-23 REST feedback'},write.headers)
 expect(rest.status).toBe(201)
 const restCreated=await rest.json() as {id:string},restRow=await env.DB.prepare('SELECT description,board_id,author_operator_id,moderation_state,public_state FROM requests WHERE id=?').bind(restCreated.id).first()
 expect(stored).toMatchObject({...restRow,title:input.title,moderation_state:'awaiting_review',public_state:'unpublished'})
 expect(await env.DB.prepare("SELECT count(*) n FROM audit_entries WHERE action='request.created' AND entity_id=? AND actor_id=?").bind(stored!.id,stored!.author_operator_id).first('n')).toBe(1)
 expect(await env.DB.prepare("SELECT count(*) n FROM integration_token_usage WHERE token_id=? AND resource='mcp/add_feedback' AND allowed=1").bind(write.credential.id).first('n')).toBe(1)
 expect(JSON.stringify(await reader.tool('search_requests',{q:input.title}))).not.toContain(input.title)
 const permissions=await env.DB.prepare('SELECT count(*) n FROM requester_update_permissions').first('n')
 const proxy=await voter.tool('record_proxy_vote',{requestSlug:captured.slug,vote:{contact:{displayName:'synthetic-penny-24 Customer',email:'synthetic-penny-24@example.test'},source:'synthetic-penny-25 Support conversation',sourceUrl:'https://support.example.test/tickets/25'}})
 expect(proxy).toEqual({requestSlug:captured.slug,recorded:true})
 const attribution=await env.DB.prepare('SELECT p.requester_id,p.recorder_operator_id,a.verified_at FROM penny_proxy_votes p JOIN requester_addresses a ON a.requester_id=p.requester_id WHERE p.request_id=?').bind(stored!.id).first<{requester_id:string;recorder_operator_id:string;verified_at:string|null}>()
 expect(attribution).toMatchObject({recorder_operator_id:stored!.author_operator_id,verified_at:null})
 expect(await env.DB.prepare('SELECT count(*) n FROM requester_update_permissions').first('n')).toBe(permissions)
 const counts=async()=>[await env.DB.prepare('SELECT count(*) n FROM requests').first('n'),await env.DB.prepare('SELECT count(*) n FROM request_votes').first('n'),await env.DB.prepare('SELECT count(*) n FROM evidence_items').first('n')]
 const before=await counts()
 expect((await reader.send('tools/call',{name:'add_feedback',arguments:input},401)).error).toBeDefined()
 expect((await writer.send('tools/call',{name:'search_requests',arguments:{}},401)).error).toBeDefined()
 const missing=new McpClient({});missing.version=reader.version
 expect((await missing.send('tools/list',undefined,401)).error).toBeDefined()
 const expired=await issue(['requests:read']);await env.DB.prepare('UPDATE integration_tokens SET expires_at=1 WHERE id=?').bind(expired.credential.id).run()
 const expiredClient=new McpClient(expired.headers);expiredClient.version=reader.version
 expect((await expiredClient.send('tools/call',{name:'search_requests',arguments:{}},401)).error).toBeDefined()
 expect((await call(`/api/operator/integrations/keys/${votes.credential.id}`,undefined,g.operator,'DELETE')).status).toBe(200)
 expect((await voter.send('tools/call',{name:'record_proxy_vote',arguments:{requestSlug:captured.slug,vote:{contact:{displayName:'synthetic-penny-26 Refused contact'},source:'synthetic-penny-27 Refused source'}}},401)).error).toBeDefined()
 expect(await counts()).toEqual(before)
 const raw=async(body:string,headers:Record<string,string>)=>exports.default.fetch(new Request(origin+'/api/mcp',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Accept:'application/json, text/event-stream',...headers},body}))
 const malformed=await raw('{',read.headers);expect(malformed.status).toBe(400);expect(await malformed.json()).toMatchObject({error:{code:-32700}})
 const versionless=new McpClient(read.headers)
 expect((await versionless.send('ping',undefined,400)).error).toMatchObject({code:-32600})
 expect((await reader.send('tools/call',{name:'search_evidence',arguments:{}},400)).error).toMatchObject({code:-32602})
 expect((await reader.send('tools/call',{name:'search_requests',arguments:{q:'valid',operatorId:'forged'}},400)).error).toMatchObject({code:-32602})
 expect((await raw(JSON.stringify({jsonrpc:'2.0',id:1,method:'ping'}),{...read.headers,Origin:'https://elsewhere.test'})).status).toBe(403)
 expect((await call('/api/mcp',undefined,read.headers)).status).toBe(405)
}
