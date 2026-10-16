import {integrationAvailable} from './transport'
import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError} from '../auth/native-tokens'
import {integrationOperator} from './destinations'
import {outboundRelayRequired} from './relay'
const bounded=z.string().trim().min(1).max(128)
export const trackerConnectionInput=z.object({id:z.uuid().optional(),name:bounded,provider:z.enum(['linear','jira']),projectIdentity:bounded,organizationIdentity:z.string().max(128).default(''),siteOrigin:z.string().max(300).default(''),issueType:z.string().max(128).default(''),apiToken:z.string().max(4096).default(''),apiEmail:z.string().max(254).default(''),signingKey:z.string().min(32).max(4096)}).strict()
export interface TrackerConnection {id:string;name:string;provider:'linear'|'jira';project_identity:string;organization_identity:string;site_origin:string;issue_type:string;native_operator_id:string;operator_version:number;actor_id:string;created_at:number;revoked_at:number|null;api_token:string;api_email:string;signing_key:string}
export function jiraOrigin(input:string) {
 let url:URL;try{url=new URL(input)}catch{throw new NativeError('tracker_origin_refused',422)}
 if(url.origin!==input||url.protocol!=='https:'||url.username||url.password||url.port||!url.hostname.endsWith('.atlassian.net')||!/^[a-z0-9-]+\.atlassian\.net$/.test(url.hostname))throw new NativeError('tracker_origin_refused',422)
 return input
}
export async function createTrackerConnection(runtime:PennyRuntime,request:Request,input:z.infer<typeof trackerConnectionInput>) {
 const {session,actor,db}=await integrationOperator(runtime,request)
 if(input.provider==='linear'){
  if(!z.uuid().safeParse(input.projectIdentity).success||!z.uuid().safeParse(input.organizationIdentity).success||input.siteOrigin||input.apiEmail||input.issueType)throw new NativeError('tracker_configuration_refused',422)
 }else{
  jiraOrigin(input.siteOrigin)
  if(!/^\d+$/.test(input.projectIdentity)||!/^\d+$/.test(input.issueType)||input.organizationIdentity||(input.apiToken&&!z.email().safeParse(input.apiEmail).success)||(!input.apiToken&&input.apiEmail))throw new NativeError('tracker_configuration_refused',422)
 }
 if([input.apiToken,input.signingKey].some(value=>/[\r\n\0]/.test(value)))throw new NativeError('tracker_configuration_refused',422)
 if(input.apiToken&&!integrationAvailable(runtime))throw new NativeError('integration_relay_required',409,outboundRelayRequired)
 // The page names the id first so its webhook URL can be set in the tracker before the secret exists.
 const id=input.id??crypto.randomUUID()
 await db.batch([
  db.prepare('INSERT INTO penny_tracker_connections(id,name,provider,project_identity,organization_identity,site_origin,issue_type,native_operator_id,operator_version,actor_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,input.name,input.provider,input.projectIdentity,input.organizationIdentity,input.siteOrigin,input.issueType,session.operatorId,session.operator.version,actor.id,Date.now()),
  db.prepare('INSERT INTO penny_tracker_secrets(connection_id,api_token,api_email,signing_key) VALUES(?,?,?,?)').bind(id,input.apiToken,input.apiEmail,input.signingKey),
 ])
 return {id,path:'/api/integrations/trackers/'+id,creation:input.apiToken&&integrationAvailable(runtime)?'configured':'configuration-disabled'}
}
export async function trackerConnection(runtime:PennyRuntime,id:string) {
 const row=await runtime.database.binding.prepare(`SELECT c.*,s.api_token,s.api_email,s.signing_key FROM penny_tracker_connections c JOIN penny_tracker_secrets s ON s.connection_id=c.id JOIN oa_operators o ON o.id=c.native_operator_id WHERE c.id=? AND c.revoked_at IS NULL AND o.status='active' AND o.version=c.operator_version`).bind(id).first<TrackerConnection>()
 if(!row)throw new NativeError('tracker_configuration_unavailable',409)
 return row
}
