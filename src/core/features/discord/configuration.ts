import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError} from '../auth/native-tokens'
export const snowflake=z.string().regex(/^[0-9]{17,20}$/)
const shape=z.object({applicationId:snowflake,publicKey:z.string().regex(/^[a-f0-9]{64}$/i),botToken:z.string().min(20).max(512),gatewaySecret:z.string().min(32).max(256)}).strict()
export function discordConfiguration(runtime:PennyRuntime){
 if(!runtime.bindings.PENNY_DISCORD)return null
 try{return shape.parse(JSON.parse(runtime.bindings.PENNY_DISCORD))}catch{throw new NativeError('discord_configuration_invalid',503)}
}
export interface DiscordEgress {send(request:{url:string;method:'GET';headers:Record<string,string>;body:string}):Promise<{status:number;headers:Record<string,string>;body:string}>}
export async function discordMessage(runtime:PennyRuntime,channel:string,message:string){
 const config=discordConfiguration(runtime),port=runtime.bindings.PENNY_DISCORD_EGRESS
 if(!config||!port)throw new NativeError('discord_transport_unconfigured',503)
 // Neither host nor path comes from a provider-supplied URL. The installation's
 // RPC service must enforce DNS/IP, TLS, no redirects and a response byte limit.
 if(!snowflake.safeParse(channel).success||!snowflake.safeParse(message).success)throw new NativeError('discord_message_invalid',400)
 const response=await port.send({url:`https://discord.com/api/v10/channels/${channel}/messages/${message}`,method:'GET',headers:{Authorization:`Bot ${config.botToken}`},body:''})
 if(!Number.isInteger(response.status)||typeof response.body!=='string'||new TextEncoder().encode(response.body).length>65536)throw new NativeError('discord_response_invalid',503)
 return response
}
export const settingsInput=z.object({guildId:snowflake,channelIds:z.array(snowflake).min(1).max(50).refine(ids=>new Set(ids).size===ids.length),emoji:z.string().trim().min(1).max(100),enabled:z.boolean(),purgeDays:z.number().int().min(0).max(365)}).strict()
export interface DiscordSettings {guild_id:string;channels_json:string;emoji:string;owner_id:string;owner_version:number;actor_id:string;enabled:number;revision:number;purge_days:number;updated_at:string}
export const readSettings=(db:D1Database)=>db.prepare('SELECT * FROM penny_discord_settings WHERE singleton=1').first<DiscordSettings>()
export function selected(settings:DiscordSettings|null,guild:string,channel:string){return settings?.enabled===1&&settings.guild_id===guild&&(JSON.parse(settings.channels_json) as string[]).includes(channel)}
export function captureGuard(settings:DiscordSettings){return {sql:`EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle') AND EXISTS(SELECT 1 FROM penny_discord_settings s JOIN oa_operators o ON o.id=s.owner_id WHERE s.singleton=1 AND s.enabled=1 AND s.revision=? AND o.status='active' AND o.role='owner' AND o.version=s.owner_version)`,params:[settings.revision] as (string|number|null)[]}}
