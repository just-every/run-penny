import { expect,vi } from 'vitest'
import { call,env,owner,requester } from './support'
import { createPennyRuntime } from '@/core/app/runtime'
import type { AppBindings } from '@/core/shared/bindings'
export const rejectionTime=new Date(Date.now()+86400000).setUTCHours(9,0,0,0)
export const rejectionRuntime=(overrides:Partial<AppBindings>={})=>createPennyRuntime({...env,WORKSPACE_TIMEZONE:'UTC',...overrides})
export const localRejectionBindings=()=>({...env,PENNY_ENVIRONMENT:'local',APP_ORIGIN:'http://127.0.0.1:8787',MAIL_PROVIDER:'development',WORKSPACE_TIMEZONE:'UTC',SENDGRID_API_KEY:undefined})
export async function rejectionFixture({consent=true,comment=false,operator:existingOperator}:{consent?:boolean;comment?:boolean;operator?:{Cookie:string}}={}){
 const operator=existingOperator??await owner(),person=await requester(),board=`reject-${crypto.randomUUID()}`
 expect((await call('/api/operator/boards',{name:'Review',slug:board,visibility:'public'},operator)).status).toBe(201)
 const response=await call('/api/public/requests',{title:'PRIVATE SUBMITTED TITLE',description:'PRIVATE COMMERCIAL BODY',boardSlug:board,emailUpdates:consent,idempotencyKey:crypto.randomUUID()},person)
 expect(response.status,await response.clone().text()).toBe(201)
 const {slug}=await response.json() as {slug:string}
 const recipient=(await env.DB.prepare('SELECT r.id AS requestId,r.author_requester_id AS requesterId,a.id AS addressId,a.email FROM requests r JOIN requester_addresses a ON a.requester_id=r.author_requester_id WHERE r.slug=?').bind(slug).first<{requestId:string;requesterId:string;addressId:string;email:string}>())!
 let path=`/api/operator/moderation/${slug}`,subjectId=recipient.requestId
 if(comment){
  expect((await call(path,{verdict:'approved',title:'Public request',description:'Approved description',boardSlug:board,displayName:'Customer'},operator)).status).toBe(200)
  const posted=await call(`/api/public/requests/${slug}/comments`,{body:'PRIVATE HELD COMMENT'},person)
  expect(posted.status).toBe(201)
  const item=await posted.json() as {id:string};subjectId=item.id;path=`/api/operator/comments/${subjectId}/moderate`
 }
 const reject=(notifyAuthor=true,headers=operator)=>call(path,{verdict:'rejected',reason:'Please explain the workflow you need.',notifyAuthor},headers)
 return {operator,person,board,slug,subjectId,path,reject,...recipient}
}
export function captureRejections(status=202){
 const sent:Record<string,unknown>[]=[]
 vi.mocked(fetch).mockImplementation(async(input,init)=>{
  expect(String(input)).toBe('https://api.sendgrid.com/v3/mail/send')
  sent.push(JSON.parse(String(init?.body)))
  return new Response(null,{status,headers:{'x-message-id':'rejection-provider-fixture'}})
 })
 return sent
}
export async function rejectionRows(){return (await env.DB.prepare("SELECT id,delivery_state AS state,failure_reason AS reason,attempt_count AS attempts FROM notification_outbox WHERE event_type='moderation_rejected' ORDER BY created_at,id").all<{id:string;state:string;reason:string|null;attempts:number}>()).results}
