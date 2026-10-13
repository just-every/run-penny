import { expect, vi } from 'vitest'
import { call, env, mockMail, owner, requester } from './support'
import { createPennyRuntime } from '@/core/app/runtime'
import { RequestOperatorRepository } from '@/core/features/requests/operator-repository'

export const start=Date.parse('2026-10-07T09:00:00.000Z')
export const time=(offset=0)=>new Date(start+offset).toISOString()
export const runtime=()=>createPennyRuntime({...env,WORKSPACE_TIMEZONE:'UTC'},{workspaceTimezone:'UTC',operatorAllowlist:['owner@penny.invalid'],publicOriginAllowlist:['https://penny.test']})
export async function graph(count=1,otherAuthor=false){
 mockMail()
 const operator=await owner(),person=await requester(),author=otherAuthor?await requester('Other author'):person
 expect((await call('/api/operator/boards',{name:'Notifications',slug:'regression',visibility:'public'},operator)).status).toBe(201)
 const requests:{id:string;slug:string}[]=[]
 for(let index=0;index<count;index++){
  const submitted=await call('/api/public/requests',{title:`Request ${index}`,description:'Requester wording',boardSlug:'regression',idempotencyKey:crypto.randomUUID()},author)
  expect(submitted.status).toBe(201)
  const {slug}=await submitted.json() as {slug:string}
  expect((await call(`/api/operator/moderation/${slug}`,{verdict:'approved',title:`Public request ${index}`,description:'Public description',boardSlug:'regression',displayName:'Requester'},operator)).status).toBe(200)
  expect((await call(`/api/public/requests/${slug}/follow`,{},person)).status).toBe(204)
  requests.push((await env.DB.prepare('SELECT id,slug FROM requests WHERE slug=?').bind(slug).first<{id:string;slug:string}>())!)
 }
 const actor=(await env.DB.prepare('SELECT id FROM operators').first<{id:string}>())!
 const recipient=(await env.DB.prepare('SELECT id AS addressId,requester_id AS requesterId,email FROM requester_addresses').first<{addressId:string;requesterId:string;email:string}>())!
 const publish=(request:number,body:string,offset=0,idempotencyKey?:string)=>new RequestOperatorRepository(runtime().database).publishStatusUpdate({slug:requests[request].slug,operatorId:actor.id,status:'under_review',body,pinned:false,now:time(offset),idempotencyKey})
 return {operator,person,requests,recipient,publish}
}
export function provider(status=202){
 const sent:{url:string;body:Record<string,unknown>}[]=[]
 vi.mocked(fetch).mockImplementation(async(input,init)=>{
  expect(String(input)).toBe('https://api.sendgrid.com/v3/mail/send');expect(init?.method).toBe('POST')
  sent.push({url:String(input),body:JSON.parse(String(init?.body))})
  return new Response(null,{status,headers:{'x-message-id':`receipt-${sent.length}`}})
 })
 return sent
}
export async function rows(table:string){return (await env.DB.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()).results}
