import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

/** Only the provider HTTP boundary is doubled; native commands and receipts use D1. */
export async function trackerCreateEdge(){
 const fixtures=Object.fromEntries(await Promise.all(['linear','jira'].map(async provider=>[provider,JSON.parse(await readFile(new URL(`../fixtures/integrations/${provider}/issue.json`,import.meta.url),'utf8')))]))
 const calls=[],expected=new Map()
 let uncertain=false
 const worker={name:'tracker-create-edge',modules:true,compatibilityDate:'2026-08-31',script:`
 import {WorkerEntrypoint} from 'cloudflare:workers';
 export default class extends WorkerEntrypoint {async send(wire){
  if(!['https://api.linear.app/graphql','https://penny-fixture.atlassian.net/rest/api/3/issue'].includes(wire.url)||!wire.headers['penny-delivery-id'])throw Error('Unexpected tracker edge');
  const response=await fetch(wire.url,{method:'POST',headers:wire.headers,body:wire.body,redirect:'manual'});
  return {status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()};
 }}`,outboundService:async request=>{
  const provider=request.url==='https://api.linear.app/graphql'?'linear':'jira',body=await request.json()
  assert.equal(request.method,'POST')
  assert.deepEqual(body,expected.get(provider),'[INT-005] the entire outbound body contains entered wording and selected tracker routing only')
  assert.doesNotMatch(JSON.stringify(body),/Private original|Private signed|synthetic-penny-private|Renewal|revenue|requester_email/,'[INT-005] private notes, identity and commercial context never enter the wire')
  calls.push({provider,body,id:request.headers.get('penny-delivery-id')})
  return uncertain?new Response(null,{status:503}):Response.json(fixtures[provider],{status:provider==='jira'?201:200})
 }}
 return {worker,calls,expected,uncertain:value=>{uncertain=value}}
}
