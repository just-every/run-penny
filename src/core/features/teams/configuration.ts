import {validNotificationUrl} from './notifications-url'
import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError} from '../auth/native-tokens'
export const teamId=z.uuid()
export const sourceId=z.string().min(1).max(200).regex(/^[A-Za-z0-9:@._=+-]+$/)
export const messageId=z.string().regex(/^[0-9]{1,30}$/)
const shape=z.object({applicationId:z.uuid(),tenantId:z.uuid(),clientSecret:z.string().min(20).max(1024),notificationUrl:z.url().refine(validNotificationUrl).optional()}).strict()
export function teamsConfiguration(runtime:PennyRuntime){
 if(!runtime.bindings.PENNY_TEAMS)return null
 try{return shape.parse(JSON.parse(runtime.bindings.PENNY_TEAMS))}catch{throw new NativeError('teams_configuration_invalid',503)}
}
/** The installation-owned RPC service enforces TLS, DNS/IP policy, no redirects,
 * exact host/path/method allowlists, timeouts and bounded responses. No fetch fallback. */
export interface TeamsEgress {send(request:{url:string;method:'GET'|'POST';headers:Record<string,string>;body:string}):Promise<{status:number;headers:Record<string,string>;body:string}>}
export async function teamsWire(runtime:PennyRuntime,url:string,method:'GET'|'POST'='GET',headers:Record<string,string>={},body=''){
 const port=runtime.bindings.PENNY_TEAMS_EGRESS
 if(!port)throw new NativeError('teams_transport_unconfigured',503)
 const response=await port.send({url,method,headers,body})
 if(!Number.isInteger(response.status)||typeof response.body!=='string'||new TextEncoder().encode(response.body).length>131072)throw new NativeError('teams_response_invalid',503)
 return response
}
export const settingsInput=z.object({teamId,channelIds:z.array(sourceId).min(1).max(50).refine(ids=>new Set(ids).size===ids.length),enabled:z.boolean(),purgeDays:z.number().int().min(0).max(365)}).strict()
export interface TeamsSettings {team_id:string;channels_json:string;owner_id:string;owner_version:number;actor_id:string;enabled:number;revision:number;purge_days:number;updated_at:string}
export const readSettings=(db:D1Database)=>db.prepare('SELECT * FROM penny_teams_settings WHERE singleton=1').first<TeamsSettings>()
export function selected(settings:TeamsSettings|null,team:string,channel:string){return settings?.enabled===1&&settings.team_id===team&&(JSON.parse(settings.channels_json) as string[]).includes(channel)}
export function captureGuard(settings:TeamsSettings){return {sql:`EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle') AND EXISTS(SELECT 1 FROM penny_teams_settings s JOIN oa_operators o ON o.id=s.owner_id WHERE s.singleton=1 AND s.enabled=1 AND s.revision=? AND o.status='active' AND o.role='owner' AND o.version=s.owner_version)`,params:[settings.revision] as (string|number|null)[]}}
