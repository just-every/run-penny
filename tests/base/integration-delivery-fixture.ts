import {expect} from 'vitest'
import {createPennyApi} from '@/core/app/api'
import {env,origin} from './support'
import {createPennyRuntime} from '@/core/app/runtime'
import type {EnforcingEgress} from '@/core/features/integrations/transport'
import type {Row} from '@/core/features/data/archive'
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

// Compare complete portable records, including composite snapshot identities.
export const orderedRows=(rows:Row[])=>[...rows].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))
export async function publicationCustody():Promise<Record<string,Row[]>>{
 const selections:Record<string,string>={requests:"WHERE moderation_state='approved'",request_comments:"WHERE moderation_state='approved'",
  request_status_updates:'',roadmap_publications:'',roadmap_update_versions:'',roadmap_update_targets:'',roadmap_update_histories:'',roadmap_update_contexts:'',
  releases:'',release_versions:'',release_targets:'',release_target_snapshots:'',release_recipient_snapshots:'',release_recipient_contexts:''}
 return Object.fromEntries(await Promise.all(Object.entries(selections).map(async([table,where])=>[table,orderedRows((await env.DB.prepare('SELECT * FROM '+table+' '+where).all<Row>()).results)])))
}
export async function integrationCustody():Promise<Record<string,Row[]>>{
 return Object.fromEntries(await Promise.all(['penny_integration_events','penny_integration_targets','penny_tracker_commands','integration_deliveries','integration_attempts'].map(async table=>[table,orderedRows((await env.DB.prepare('SELECT * FROM '+table).all<Row>()).results)])))
}
