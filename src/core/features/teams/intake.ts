import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError,digest} from '../auth/native-tokens'
import {guardedDatabase} from '../integrations/guarded-database'
import {redactCaptured,redactionFence} from '../redaction/settings'
import {captureGuard,readSettings,selected,teamId,sourceId,messageId} from './configuration'
export const activity=z.object({
 type:z.literal('invoke'),name:z.literal('composeExtension/submitAction'),channelId:z.literal('msteams'),serviceUrl:z.url(),
 from:z.object({id:z.string().min(1).max(200).regex(/^[^\r\n\0]+$/),name:z.string().max(200).optional()}),
 channelData:z.object({tenant:z.object({id:z.uuid()}),team:z.object({id:sourceId,aadGroupId:teamId.optional()}),channel:z.object({id:sourceId})}),
 value:z.object({commandId:z.literal('sendToPenny'),messagePayload:z.object({id:messageId,replyToId:messageId.nullable().optional()})}),
})
export async function enqueueTeams(runtime:PennyRuntime,input:{team:string;channel:string;message:string;parent:string|null;capturer:string;name:string|null}){
 const raw=runtime.database.binding,settings=await readSettings(raw)
 if(!selected(settings,input.team,input.channel))return {accepted:false}
 if(!runtime.bindings.PENNY_TEAMS_EGRESS)throw new NativeError('teams_transport_unconfigured',503)
 const db=guardedDatabase(raw,captureGuard(settings!)),id=`${input.team}/${input.channel}/${input.message}`,now=new Date().toISOString()
 if(await db.prepare('SELECT 1 FROM penny_teams_receipts WHERE source_digest=?').bind(await digest(id)).first())return {accepted:true,state:'done',duplicate:true}
 const safe=await redactCaptured(raw,{name:input.name},['name']),fence=redactionFence(db,safe.revision)
 const result=await db.batch([fence.before,fence.after,db.prepare(`INSERT INTO penny_teams_jobs(id,team_id,channel_id,message_id,parent_message_id,capturer_id,capturer_name,trigger_kind,owner_id,owner_version,actor_id,revision,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'action',?,?,?,?,'pending',?,?) ON CONFLICT DO NOTHING RETURNING id`).bind(id,input.team,input.channel,input.message,input.parent,input.capturer,safe.input.name,settings!.owner_id,settings!.owner_version,settings!.actor_id,settings!.revision,now,now)])
 return {accepted:true,state:await db.prepare('SELECT state FROM penny_teams_jobs WHERE id=?').bind(id).first<string>('state'),duplicate:result[2].results.length===0}
}
