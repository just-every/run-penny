import {expect} from 'vitest'
import {env,origin} from './support'
import {api} from './integration-delivery-fixture'
import {createPennyRuntime} from '@/core/app/runtime'
import type {WireRequest} from '../../base/modules/integrations/core/types.ts'
import linearIssue from '../fixtures/integrations/linear/issue.json'
import linearState from '../fixtures/integrations/linear/state.json'
import jiraIssue from '../fixtures/integrations/jira/issue.json'
import jiraState from '../fixtures/integrations/jira/state.json'
export const signingKey='test-only-tracker-signing-material-keep-private'
export const fixtureIssue={linear:linearIssue,jira:jiraIssue}
export const trackerRequest=(path:string,body:unknown,operator:Record<string,string>,method='POST',port?:{send:(wire:WireRequest)=>Promise<{status:number;headers:Record<string,string>;body:string}>},db=env.DB)=>api.fetch(new Request(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...operator},...(method==='GET'?{}:{body:JSON.stringify(body)})}),{...env,DB:db,...(port?{PENNY_EGRESS:port}:{})})
export async function configure(operator:Record<string,string>,provider:'linear'|'jira',apiToken='test-only-provider-token'){
 const response=await trackerRequest('/api/operator/integrations/trackers/connections',{name:provider+' fixture',provider,projectIdentity:provider==='linear'?'461b4065-5ccf-49ae-a432-876d77554e04':'10000',organizationIdentity:provider==='linear'?'462adcc8-15a5-4802-a438-226f1fd930a6':'',siteOrigin:provider==='jira'?'https://penny-fixture.atlassian.net':'',issueType:provider==='jira'?'10001':'',apiEmail:provider==='jira'&&apiToken?'test@example.test':'',apiToken,signingKey},operator)
 expect(response.status,await response.clone().text()).toBe(201);return (await response.json() as {id:string}).id
}
export function trackerRuntime(port?:Parameters<typeof trackerRequest>[4],db=env.DB){return createPennyRuntime({...env,DB:db,...(port?{PENNY_EGRESS:port}:{})})}
export function issue(provider:'linear'|'jira'){return provider==='linear'?{externalId:linearIssue.data.issueCreate.issue.id,url:linearIssue.data.issueCreate.issue.url}:{externalId:jiraIssue.id,url:'https://penny-fixture.atlassian.net/browse/'+jiraIssue.key}}
export function state(provider:'linear'|'jira',updated='2026-10-09T12:30:00.000Z',name='In Progress'){
 const value=structuredClone(provider==='linear'?linearState:jiraState) as typeof linearState & typeof jiraState
 if(provider==='linear'){value.webhookTimestamp=Date.now();value.data.updatedAt=updated;value.data.state.name=name}else{value.issue.fields.updated=updated;value.issue.fields.status.name=name}
 return value
}
export async function receive(provider:'linear'|'jira',connectionId:string,value:unknown,deliveryId=crypto.randomUUID(),rawChange='',db=env.DB){
 const body=JSON.stringify(value),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(signingKey),{name:'HMAC',hash:'SHA-256'},false,['sign'])
 const signature=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(body))),byte=>byte.toString(16).padStart(2,'0')).join('')
 const headers:Record<string,string>=provider==='linear'?{'Linear-Signature':signature,'Linear-Delivery':deliveryId,'Linear-Event':'Issue'}:{'X-Hub-Signature':'sha256='+signature,'X-Atlassian-Webhook-Identifier':deliveryId}
 return api.fetch(new Request(origin+'/api/integrations/trackers/'+connectionId,{method:'POST',headers,body:body+rawChange}),{...env,DB:db})
}
