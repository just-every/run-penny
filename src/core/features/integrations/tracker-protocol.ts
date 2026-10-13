import type {DeliveryProtocol,WireResponse} from '../../../../base/modules/integrations/core/types.ts'
import {NativeError} from '../auth/native-tokens'
import type {TrackerConnection} from './tracker-configuration'
export const linearCreate='mutation PennyIssueCreate($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id title url team { id } } } }'
export function createBody(connection:TrackerConnection,title:string,description:string) {
 return JSON.stringify(connection.provider==='linear'?{query:linearCreate,variables:{input:{teamId:connection.project_identity,title,description}}}:{fields:{project:{id:connection.project_identity},issuetype:{id:connection.issue_type},summary:title,description:{version:1,type:'doc',content:[{type:'paragraph',content:[{type:'text',text:description}]}]}}})
}
export function issueUrl(provider:'linear'|'jira',value:string,siteOrigin='') {
 let url:URL;try{url=new URL(value)}catch{throw new NativeError('tracker_issue_url_refused',422)}
 if(url.protocol!=='https:'||url.username||url.password||url.hash||url.search||url.port||url.href!==value)throw new NativeError('tracker_issue_url_refused',422)
 if(provider==='linear'?(url.hostname!=='linear.app'||!/^\/[a-z0-9-]+\/issue\/[A-Za-z0-9-]+(?:\/[A-Za-z0-9_-]+)?$/.test(url.pathname)):(url.origin!==siteOrigin||!/^\/browse\/[A-Z][A-Z0-9_]*-\d+$/.test(url.pathname)))throw new NativeError('tracker_issue_url_refused',422)
 return url.href
}
export function knownIssue(connection:TrackerConnection,response:WireResponse) {
 try{
  const data=JSON.parse(response.body)
  if(connection.provider==='linear'){
   if(response.status!==200||data.errors?.length||data.data?.issueCreate?.success!==true)throw Error('unknown')
   const issue=data.data.issueCreate.issue
   if(typeof issue.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(issue.id)||issue.team?.id!==connection.project_identity)throw Error('unknown')
   return {externalId:issue.id,url:issueUrl('linear',issue.url)}
  }
  if(response.status!==201||typeof data.id!=='string'||!/^\d+$/.test(data.id)||typeof data.key!=='string'||!/^[A-Z][A-Z0-9_]*-\d+$/.test(data.key)||data.self!==connection.site_origin+'/rest/api/3/issue/'+data.id)throw Error('unknown')
  return {externalId:data.id,url:issueUrl('jira',connection.site_origin+'/browse/'+data.key,connection.site_origin)}
 }catch{throw new NativeError('tracker_response_uncertain',409)}
}
export function trackerProtocol(resolve:(id:string)=>Promise<TrackerConnection>):DeliveryProtocol {
 return {id:'tracker.create.v1',prepare:async(envelope)=>{
  const connection=await resolve(envelope.destinationId)
  if(!connection.api_token)throw new NativeError('tracker_creation_unconfigured',503)
  return {url:connection.provider==='linear'?'https://api.linear.app/graphql':connection.site_origin+'/rest/api/3/issue',headers:{'content-type':'application/json',accept:'application/json',authorization:connection.provider==='linear'?connection.api_token:'Basic '+btoa(connection.api_email+':'+connection.api_token),'penny-delivery-id':envelope.id},body:envelope.body}
 },classify:response=>{
  if(response.status>=200&&response.status<300)return {kind:'accepted',code:'tracker_created',status:response.status}
  if(response.status===429)return {kind:'retryable',code:'tracker_rate_limited',status:429}
  if(response.status>=400&&response.status<500&&response.status!==408)return {kind:'rejected',code:'tracker_creation_rejected',status:response.status}
  return {kind:'uncertain',code:'tracker_creation_uncertain',status:response.status}
 }}
}
