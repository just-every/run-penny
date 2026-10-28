import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError,digest} from '../auth/native-tokens'
import {guardedDatabase} from '../integrations/guarded-database'
import {redactCaptured,redactionFence} from '../redaction/settings'
import {captureGuard,readSettings,selected,snowflake} from './configuration'
const user=z.object({id:snowflake,username:z.string().max(200).optional(),global_name:z.string().max(200).nullable().optional(),bot:z.boolean().optional()})
export const interaction=z.object({type:z.number().int(),application_id:snowflake,guild_id:snowflake.optional(),channel_id:snowflake.optional(),member:z.object({user}).optional(),data:z.object({type:z.number(),name:z.string(),target_id:snowflake}).optional()})
export const gatewayEvent=z.object({t:z.literal('MESSAGE_REACTION_ADD'),d:z.object({guild_id:snowflake,channel_id:snowflake,message_id:snowflake,user_id:snowflake,member:z.object({user}).optional(),emoji:z.object({id:snowflake.nullable(),name:z.string().max(100).nullable()})})})
export async function enqueueDiscord(runtime:PennyRuntime,input:{guild:string;channel:string;message:string;capturer:string;name:string|null;kind:'command'|'reaction';emoji?:string}){
 const raw=runtime.database.binding,settings=await readSettings(raw)
 if(!selected(settings,input.guild,input.channel)||input.emoji!==undefined&&input.emoji!==settings!.emoji)return {accepted:false}
 if(!discordReady(runtime))throw new NativeError('discord_transport_unconfigured',503)
 const db=guardedDatabase(raw,captureGuard(settings!)),id=`${input.guild}/${input.channel}/${input.message}`,now=new Date().toISOString()
 if(await db.prepare('SELECT 1 FROM penny_discord_receipts WHERE source_digest=?').bind(await digest(id)).first())return {accepted:true,state:'done',duplicate:true}
 const safe=await redactCaptured(raw,{name:input.name},['name']),fence=redactionFence(db,safe.revision)
 const result=await db.batch([fence.before,fence.after,db.prepare(`INSERT INTO penny_discord_jobs(id,guild_id,channel_id,message_id,capturer_id,capturer_name,trigger_kind,owner_id,owner_version,actor_id,revision,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,'pending',?,?) ON CONFLICT DO NOTHING RETURNING id`).bind(id,input.guild,input.channel,input.message,input.capturer,safe.input.name,input.kind,settings!.owner_id,settings!.owner_version,settings!.actor_id,settings!.revision,now,now)])
 const state=await db.prepare('SELECT state FROM penny_discord_jobs WHERE id=?').bind(id).first<string>('state')
 return {accepted:true,state,duplicate:result[2].results.length===0}
}
function discordReady(runtime:PennyRuntime){return Boolean(runtime.bindings.PENNY_DISCORD_EGRESS)}
