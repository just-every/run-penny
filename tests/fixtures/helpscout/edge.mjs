import assert from 'node:assert/strict'
/** Recorded synthetic Help Scout v2 shapes; the only fake is the network edge. */
export function helpScoutEdge(config){
 const calls=[],modes=new Map();let onRead=async()=>{},sendStatus=201
 const worker={name:'helpscout-network-edge',modules:true,compatibilityDate:'2026-08-31',script:`import {WorkerEntrypoint} from 'cloudflare:workers';export default class Edge extends WorkerEntrypoint{async send(wire){const response=await fetch(wire.url,{method:wire.method,headers:wire.headers,...(wire.method==='POST'?{body:wire.body}:{}),redirect:'manual'});return {status:response.status,headers:{},body:await response.text()}}fetch(){return new Response('not found',{status:404})}}`,outboundService:async request=>{
  const url=new URL(request.url);assert.equal(url.origin,'https://api.helpscout.net');const body=request.method==='POST'?await request.text():'';calls.push({path:url.pathname,query:url.search,method:request.method,body})
  if(url.pathname==='/v2/oauth2/token'){assert.equal(request.method,'POST');const form=new URLSearchParams(body);assert.equal(form.get('client_id'),config.clientId);assert.equal(form.get('client_secret'),config.clientSecret);assert.equal(form.get('grant_type'),'client_credentials');return Response.json({access_token:'synthetic-helpscout-access-token',token_type:'bearer',expires_in:172800})}
  assert.equal(request.headers.get('Authorization'),'Bearer synthetic-helpscout-access-token')
  const match=/^\/v2\/conversations\/(\d+)(\/threads|\/reply)?$/.exec(url.pathname)
  if(match){
   const id=Number(match[1]),mode=modes.get(id)
   if(!match[2]){await onRead(id);if(typeof mode==='number')return Response.json({message:'Synthetic provider refusal'}, {status:mode,headers:mode===301?{Location:'https://api.helpscout.net/v2/conversations/999'}:{}});return Response.json({id,mailboxId:mode==='wrong-mailbox'?99:config.mailboxId,tags:[{id:8,tag:mode==='untagged'?'other':config.tag}],primaryCustomer:{id:501,firstName:'Riley',lastName:'Chen'},preview:'OMITTED_PREVIEW',subject:'OMITTED_SUBJECT'})}
   if(match[2]==='/threads'){
    if(/^threads-\d+$/.test(mode))return Response.json({message:'Synthetic thread access loss'},{status:Number(mode.slice(8)),headers:{Location:'https://api.helpscout.net/v2/conversations/999'}})
    if(id===101&&!url.search)return Response.json({_embedded:{threads:Array.from({length:25},(_,n)=>({id:900+n,type:'note',body:'OMITTED_PRIVATE_NOTE',createdAt:'2026-10-28T12:31:00Z'}))},page:{number:1,totalPages:2}})
    return Response.json({_embedded:{threads:[{id:801,type:'customer',body:mode==='changed'?'<p>Edited source excerpt</p>':'<p>Please add scheduled CSV exports. Contact source.person@example.test. Reference 65674284-7077-46fe-8d77-244f47cf25c1; card 4111 1111 1111 1111.</p>',createdAt:'2026-10-28T12:30:00Z',customer:{id:502,first:'Morgan',last:'Lopez'}},{id:802,type:'note',body:'OMITTED_PRIVATE_NOTE',createdAt:'2026-10-28T12:31:00Z'}]},page:{number:id===101?2:1,totalPages:id===101?2:1}})
   }
   assert.equal(request.method,'POST');const reply=JSON.parse(body);assert.equal(reply.customer.id,501);assert.equal(reply.user,config.sidebarUserId);assert.equal(reply.draft,false);return Response.json({}, {status:sendStatus})
  }
  if(url.pathname==='/v2/customers/501')return Response.json({id:501,firstName:'Riley',lastName:'Chen',organizationId:701,_embedded:{emails:[{id:601,value:'customer@example.test',type:'work'}]},properties:[{value:'OMITTED_PRIVATE_CUSTOM_FIELD'}]})
  if(url.pathname==='/v2/organizations/701')return Response.json({id:701,name:'Harbor customer company',description:'OMITTED_COMPANY_DESCRIPTION',properties:[{value:'OMITTED_COMPANY_VALUE'}]})
  throw Error('Unexpected Help Scout fixture request: '+url.pathname)
 }}
 return {worker,calls,modes,set onRead(value){onRead=value},set sendStatus(value){sendStatus=value}}
}
