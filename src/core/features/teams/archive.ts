import {z} from 'zod'
import {validTeamsLink} from './provider'
import type {Row} from '../data/archive'
import {NativeError,digest} from '../auth/native-tokens'
import {settingsInput,sourceId,teamId} from './configuration'
const sourceIdentity=z.object({team_id:teamId,channel_id:sourceId,message_id:sourceId,parent_message_id:sourceId.nullable(),capturer_id:z.string().min(1).max(200),capturer_name:z.string().max(2048).nullable()})
const job=sourceIdentity.extend({id:z.string(),owner_id:z.string().min(1),owner_version:z.number().int().nonnegative(),actor_id:z.string().min(1),trigger_kind:z.literal('action'),revision:z.number().int().positive(),state:z.enum(['pending','running','failed','done','stopped','held']),evidence_id:z.string().nullable(),attempts:z.number().int().nonnegative(),claim:z.string().nullable(),started_at:z.string().nullable(),failure:z.string().nullable(),created_at:z.string(),updated_at:z.string()})
const source=sourceIdentity.extend({evidence_id:z.string(),job_id:z.string(),jump_url:z.string(),author_id:z.string().max(200).nullable(),source_hash:z.string().regex(/^[a-f0-9]{64}$/),source_state:z.enum(['current','changed','removed','purged']),removed_at:z.string().nullable(),purge_at:z.string().nullable(),next_check:z.string(),check_failure:z.string().nullable(),check_claim:z.string().nullable(),check_started_at:z.string().nullable()})
export async function validateTeamsArchive(data:Record<string,Row[]>){
 try{
  const settings=data.penny_teams_settings??[]
  if(settings.length>1)throw Error()
  for(const row of settings){
   if(row.singleton!==1||![0,1].includes(Number(row.enabled))||typeof row.owner_id!=='string'||typeof row.actor_id!=='string'||!Number.isSafeInteger(row.owner_version)||!Number.isSafeInteger(row.revision)||Number(row.revision)<1)throw Error()
   settingsInput.parse({teamId:row.team_id,channelIds:JSON.parse(String(row.channels_json)),enabled:row.enabled===1,purgeDays:row.purge_days})
  }
  const jobs=(data.penny_teams_jobs??[]).map(row=>job.parse(row)),sources=(data.penny_teams_sources??[]).map(row=>source.parse(row)),evidence=new Map((data.evidence_items??[]).map(row=>[row.id,row]))
  const receipts=new Set((data.penny_teams_receipts??[]).map(row=>{if(typeof row.source_digest!=='string'||!/^([a-f0-9]{64})$/.test(row.source_digest))throw Error();return row.source_digest}))
  const jobsById=new Map(jobs.map(row=>[row.id,row])),sourcesByJob=new Map(sources.map(row=>[row.job_id,row]))
  for(const row of jobs){
   const completed=row.state==='done',hasEvidence=row.evidence_id!==null
   if(row.id!==`${row.team_id}/${row.channel_id}/${row.message_id}`||completed!==hasEvidence)throw Error()
   if(row.evidence_id!==null&&(evidence.get(row.evidence_id)?.source_type!=='teams'||sourcesByJob.get(row.id)?.evidence_id!==row.evidence_id))throw Error()
  }
  for(const row of sources){
   const parent=jobsById.get(row.job_id)
   if(!receipts.has(await digest(row.job_id)))throw Error()
   if(!parent||parent.evidence_id!==row.evidence_id||row.job_id!==`${row.team_id}/${row.channel_id}/${row.message_id}`||row.capturer_id!==parent.capturer_id||row.parent_message_id!==parent.parent_message_id||!validTeamsLink(row.jump_url))throw Error()
  }
 }catch{throw new NativeError('teams_archive_invalid',409)}
}
