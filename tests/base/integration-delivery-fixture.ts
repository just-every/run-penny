import {expect} from 'vitest'
import {createPennyApi} from '@/core/app/api'
import {env,origin} from './support'
import {createPennyRuntime} from '@/core/app/runtime'
import type {EnforcingEgress} from '@/core/features/integrations/transport'
export const api=createPennyApi()
export const request=(path:string,body:unknown,headers:Record<string,string>,method='POST',db=env.DB,relay?:EnforcingEgress)=>api.fetch(new Request(origin+path,{method,headers:{Origin:origin,...headers,'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body)})}),{...env,DB:db,...(relay?{PENNY_EGRESS:relay}:{})})
/** An outbound connection is saved only where the installation can send it: pass its relay. */
export async function connection(operator:Record<string,string>,kind='webhook',events=['status.published'],relay?:EnforcingEgress) {
 const response=await request('/api/operator/integrations/destinations',{name:'Public integration',kind,endpoint:kind==='receiver'?'':kind==='slack'?'https://hooks.slack.com/services/T123/B123/test-only-fixture':'https://events.example.com/penny',events:kind==='receiver'?[]:events},operator,'POST',env.DB,relay)
 expect(response.status,await response.clone().text()).toBe(201)
 return await response.json() as {id:string;signingKey:string;transport:string}
}
export function runtime(port?:EnforcingEgress,db=env.DB){return createPennyRuntime({...env,DB:db,...(port?{PENNY_EGRESS:port}:{})})}
export const count=(table:string)=>env.DB.prepare('SELECT count(*) n FROM '+table).first<number>('n')
