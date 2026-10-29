import type {Hono} from 'hono'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {NativeError} from '../auth/native-tokens'
import {boundedRawBody} from '../integrations/raw-body'
import {discordConfiguration} from './configuration'
import {verifyDiscord} from './signatures'
import {enqueueDiscord,interaction,gatewayEvent} from './intake'
import {registerDiscordSettings} from './settings'
export function registerDiscordRoutes(app:Hono<OperatorMutationEnvironment>){
 registerDiscordSettings(app)
 for(const kind of ['interactions','gateway'] as const)app.post('/api/integrations/discord/'+kind,async c=>{
  c.header('Cache-Control','private, no-store')
  const runtime=c.get('runtime'),config=discordConfiguration(runtime)
  if(!config)throw new NativeError('discord_unconfigured',503)
  const raw=await boundedRawBody(c.req.raw,65536)
  // Authenticate original bytes before JSON parsing, including ping probes.
  await verifyDiscord(c.req.raw,raw,kind==='gateway'?config.gatewaySecret:config.publicKey,kind==='gateway')
  let value:unknown;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw))}catch{throw new NativeError('discord_payload_invalid',400)}
  if(kind==='interactions'){
   const parsed=interaction.safeParse(value);if(!parsed.success)throw new NativeError('discord_payload_invalid',400)
   const input=parsed.data
   if(input.application_id!==config.applicationId)throw new NativeError('discord_application_mismatch',403)
   if(input.type===1)return c.json({type:1})
   if(input.type!==2||input.data?.type!==3||input.data.name!=='Send to Penny'||!input.guild_id||!input.channel_id||!input.member||input.member.user.bot)throw new NativeError('discord_command_invalid',400)
   const result=await enqueueDiscord(runtime,{guild:input.guild_id,channel:input.channel_id,message:input.data.target_id,capturer:input.member.user.id,name:input.member.user.global_name??input.member.user.username??null,kind:'command'})
   return c.json({type:4,data:{content:result.accepted?result.state==='done'?'This message has already been handled by Penny.':result.state==='pending'||result.state==='running'?'Queued for Penny. The connector owner can review capture progress in settings.':'This capture is stopped or failed. Ask the connector owner to review it in Penny settings.':'This channel is not selected for Penny capture.',flags:64,allowed_mentions:{parse:[]}}})
  }
  const parsed=gatewayEvent.safeParse(value);if(!parsed.success)throw new NativeError('discord_payload_invalid',400)
  const d=parsed.data.d
  if(d.member&&d.member.user.id!==d.user_id)throw new NativeError('discord_member_mismatch',400)
  if(d.member?.user.bot)return c.json({accepted:false})
  return c.json(await enqueueDiscord(runtime,{guild:d.guild_id,channel:d.channel_id,message:d.message_id,capturer:d.user_id,name:d.member?.user.global_name??d.member?.user.username??null,kind:'reaction',emoji:d.emoji.id??d.emoji.name??''}),202)
 })
}
