import {z} from 'zod'
import type {Row} from '../data/archive'
import {NativeError,digest} from '../auth/native-tokens'
import {settingsInput,snowflake} from './configuration'
const sourceIdentity=z.object({guild_id:snowflake,channel_id:snowflake,message_id:snowflake,capturer_id:snowflake,capturer_name:z.string().max(2048).nullable()})
const job=sourceIdentity.extend({id:z.string(),owner_id:z.string().min(1),owner_version:z.number().int().nonnegative(),actor_id:z.string().min(1),trigger_kind:z.enum(['command','reaction']),revision:z.number().int().positive(),state:z.enum(['pending','running','failed','done','stopped','held']),evidence_id:z.string().nullable(),attempts:z.number().int().nonnegative(),claim:z.string().nullable(),started_at:z.string().nullable(),failure:z.string().nullable(),created_at:z.string(),updated_at:z.string()})
const source=sourceIdentity.extend({evidence_id:z.string(),job_id:z.string(),jump_url:z.string(),author_id:snowflake.nullable(),source_hash:z.string().regex(/^[a-f0-9]{64}$/),source_state:z.enum(['current','changed','removed','purged']),removed_at:z.string().nullable(),purge_at:z.string().nullable(),next_check:z.string(),check_failure:z.string().nullable(),check_claim:z.string().nullable(),check_started_at:z.string().nullable()})
export async function validateDiscordArchive(data:Record<string,Row[]>){
 try{
  const settings=data.penny_discord_settings??[]
  if(settings.length>1)throw Error()
  for(const row of settings){
   if(row.singleton!==1||![0,1].includes(Number(row.enabled))||typeof row.owner_id!=='string'||typeof row.actor_id!=='string'||!Number.isSafeInteger(row.owner_version)||!Number.isSafeInteger(row.revision)||Number(row.revision)<1)throw Error()
   settingsInput.parse({guildId:row.guild_id,channelIds:JSON.parse(String(row.channels_json)),emoji:row.emoji,enabled:row.enabled===1,purgeDays:row.purge_days})
  }
  const jobs=(data.penny_discord_jobs??[]).map(row=>job.parse(row)),sources=(data.penny_discord_sources??[]).map(row=>source.parse(row)),evidence=new Map((data.evidence_items??[]).map(row=>[row.id,row]))
  const receipts=new Set((data.penny_discord_receipts??[]).map(row=>{if(typeof row.source_digest!=='string'||!/^([a-f0-9]{64})$/.test(row.source_digest))throw Error();return row.source_digest}))
  const jobsById=new Map(jobs.map(row=>[row.id,row])),sourcesByJob=new Map(sources.map(row=>[row.job_id,row]))
  for(const row of jobs){
   const completed=row.state==='done',hasEvidence=row.evidence_id!==null
   if(row.id!==`${row.guild_id}/${row.channel_id}/${row.message_id}`||completed!==hasEvidence)throw Error()
   if(row.evidence_id!==null&&(evidence.get(row.evidence_id)?.source_type!=='discord'||sourcesByJob.get(row.id)?.evidence_id!==row.evidence_id))throw Error()
  }
  for(const row of sources){
   const parent=jobsById.get(row.job_id)
   if(!receipts.has(await digest(row.job_id)))throw Error()
   if(!parent||parent.evidence_id!==row.evidence_id||row.job_id!==`${row.guild_id}/${row.channel_id}/${row.message_id}`||row.capturer_id!==parent.capturer_id||row.jump_url!==`https://discord.com/channels/${row.guild_id}/${row.channel_id}/${row.message_id}`)throw Error()
  }
 }catch{throw new NativeError('discord_archive_invalid',409)}
}
