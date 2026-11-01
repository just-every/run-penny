import {z} from 'zod'
import {registerTeamsNotificationSettings} from './notification-settings'
import type {Hono} from 'hono'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {NativeError} from '../auth/native-tokens'
import {boundedRawBody} from '../integrations/raw-body'
import {teamsConfiguration,readSettings} from './configuration'
import {verifyTeamsToken} from './token'
import {enqueueTeams,activity} from './intake'
import {registerTeamsSettings} from './settings'
export function registerTeamsRoutes(app:Hono<OperatorMutationEnvironment>){
 registerTeamsSettings(app)
 registerTeamsNotificationSettings(app)
 app.post('/api/integrations/teams/messages',async c=>{
  c.header('Cache-Control','private, no-store')
  const runtime=c.get('runtime'),config=teamsConfiguration(runtime)
  if(!config)throw new NativeError('teams_unconfigured',503)
  const serviceUrl=await verifyTeamsToken(runtime,c.req.raw)
  const raw=await boundedRawBody(c.req.raw,65536)
  let value:unknown;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw))}catch{throw new NativeError('teams_payload_invalid',400)}
  const lifecycle=z.object({type:z.enum(['conversationUpdate','installationUpdate']),channelId:z.literal('msteams'),serviceUrl:z.url(),channelData:z.object({tenant:z.object({id:z.uuid()})})}).safeParse(value)
  if(lifecycle.success){
   if(lifecycle.data.serviceUrl!==serviceUrl||lifecycle.data.channelData.tenant.id!==config.tenantId)throw new NativeError('teams_tenant_or_service_mismatch',403)
   return c.json({})
  }
  const parsed=activity.safeParse(value)
  if(!parsed.success)throw new NativeError('teams_action_invalid',400)
  const input=parsed.data
  if(input.serviceUrl!==serviceUrl||input.channelData.tenant.id!==config.tenantId)throw new NativeError('teams_tenant_or_service_mismatch',403)
  const settings=await readSettings(runtime.database.binding)
  if(input.channelData.team.aadGroupId&&settings&&input.channelData.team.aadGroupId!==settings.team_id)throw new NativeError('teams_team_mismatch',403)
  // Some Bot Framework activities omit aadGroupId. The selected team UUID is
  // installation configuration; never derive a provider URL from an activity link.
  const result=settings?await enqueueTeams(runtime,{team:settings.team_id,channel:input.channelData.channel.id,message:input.value.messagePayload.id,parent:input.value.messagePayload.replyToId??null,capturer:input.from.id,name:input.from.name??null}):{accepted:false}
  return c.json({task:{type:'message',value:result.accepted?result.state==='done'?'This message has already been handled by Penny.':result.state==='pending'||result.state==='running'?'Queued for Penny. Review capture progress in Penny settings.':'Capture needs owner review in Penny settings.':'This channel is not selected for Penny capture.'}})
 })
}
