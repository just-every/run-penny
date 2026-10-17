import {expect,vi} from 'vitest'
import {call,env,owner,requester,finishFirstRun,origin,messages} from './support'
import {createPennyRuntime} from '@/core/app/runtime'
import {drainNotifications} from '@/core/features/notifications/delivery'
export {call,env,requester,origin}
export type Person=Awaited<ReturnType<typeof requester>>
export interface ProviderMessage {from:{name?:string;email:string};reply_to?:{email:string};personalizations:{to:{email:string}[]}[];content:{type:string;value:string}[]}
export const body=(message:ProviderMessage)=>message.content.find(part=>part.type==='text/plain')!.value
export async function accepted(response:Promise<Response>,status=200){const result=await response;expect(result.status,await result.clone().text()).toBe(status);return result}
export async function graph(existing?:{Cookie:string}){
 const operator=existing??await owner({finishSetup:false});if(!existing)await accepted(finishFirstRun(operator),303)
 await accepted(call('/api/operator/boards',{slug:'subscriptions',name:'Subscription board',visibility:'public'},operator),201)
 const author=await requester('Author'),voter=await requester('Voter')
 const boards=await (await call('/api/public/boards')).json() as {slug:string;subscriptionDisclosure:{enabled:boolean;version:number;vote:string;submission:string}}[]
 const disclosure=boards.find(board=>board.slug==='subscriptions')!.subscriptionDisclosure
 const sent:ProviderMessage[]=[]
 vi.mocked(fetch).mockImplementation(async(url,init)=>{expect(String(url)).toBe('https://api.sendgrid.com/v3/mail/send');const message=JSON.parse(String(init?.body)) as ProviderMessage;sent.push(message);const link=body(message).match(/https?:\/\/[^\s]+/)?.[0];if(link)messages.push({to:message.personalizations[0].to[0].email,url:link});return new Response(null,{status:202,headers:{'x-message-id':crypto.randomUUID()}})})
 const submit=async(person=author,emailUpdates=false)=>{
  const response=await accepted(call('/api/public/requests',{title:'Improve feedback',description:'A requester problem',boardSlug:'subscriptions',idempotencyKey:crypto.randomUUID(),emailUpdates,subscriptionVersion:disclosure.version},person),201)
  return (await response.json() as {slug:string}).slug
 }
 const publish=async(slug:string)=>accepted(call(`/api/operator/moderation/${slug}`,{verdict:'approved',title:'Improve feedback',description:'A public problem',boardSlug:'subscriptions',displayName:'Approved author'},operator))
 const status=async(slug:string,value:string)=>accepted(call(`/api/operator/requests/${slug}/status-updates`,{status:value,body:''},operator))
 let clock=new Date();clock.setUTCHours(12,0,0,0);if(clock.getTime()<Date.now())clock=new Date(clock.getTime()+86400000)
 const runtime=createPennyRuntime({...env,WORKSPACE_TIMEZONE:'UTC'},{workspaceTimezone:'UTC',operatorAllowlist:['owner@penny.invalid'],publicOriginAllowlist:[origin]})
 const flush=async()=>{clock=new Date(clock.getTime()+120000);await drainNotifications(runtime,()=>clock.getTime());clock=new Date(clock.getTime()+120000);await drainNotifications(runtime,()=>clock.getTime())}
 const email=async(person:Person)=>(await (await call('/api/public/identity/session',undefined,person)).json() as {email:string}).email
 const rows=async()=> (await env.DB.prepare('SELECT * FROM requester_update_permissions ORDER BY created_at,id').all<Record<string,unknown>>()).results
 return {operator,author,voter,disclosure,sent,submit,publish,status,flush,email,rows}
}
