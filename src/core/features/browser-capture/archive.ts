import {z} from 'zod'
import type {Row} from '../data/archive'
import {NativeError} from '../auth/native-tokens'
import {pageUrl,digest} from './schema'
const hash=z.string().regex(/^[a-f0-9]{64}$/),id=z.string().min(1)
const capture=z.object({id:z.uuid(),evidence_id:id,page_url:pageUrl,source_hash:hash,payload_hash:hash,source_state:z.enum(['current','changed','removed','purged']),purge_days:z.number().int().min(0).max(365),purge_at:z.string().nullable(),state:z.enum(['uploading','pending','running','failed','done','stopped','held']),claim:z.string().nullable(),started_at:z.string().nullable(),failure:z.string().nullable(),screenshot_hash:hash.nullable(),screenshot_bytes:z.number().int().positive().max(10485760).nullable(),request_id:id.nullable(),requester_id:id.nullable(),proxy_vote:z.union([z.literal(0),z.literal(1)]),actor_id:id.nullable(),created_at:z.string(),updated_at:z.string()})
export async function validateBrowserArchive(data:Record<string,Row[]>){
 try{
  const evidence=new Map((data.evidence_items??[]).map(row=>[row.id,row])),receipts=new Set((data.penny_browser_receipts??[]).map(row=>hash.parse(row.capture_digest)))
  for(const value of data.penny_browser_captures??[]){
   const row=capture.parse(value)
   if(evidence.get(row.evidence_id)?.source_type!=='browser_extension'||!receipts.has(await digest(row.id))||Boolean(row.screenshot_hash)!==Boolean(row.screenshot_bytes)||row.proxy_vote===1&&(!row.request_id||!row.requester_id))throw Error()
  }
 }catch{throw new NativeError('browser_capture_archive_invalid',409)}
}
