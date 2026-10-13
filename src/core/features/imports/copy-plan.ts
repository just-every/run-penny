import {Buffer} from 'node:buffer'
import {inflateRawSync} from 'node:zlib'
import type {ImportPlan} from '../../../../base/modules/import-kit/src/types'
import {canonicalJson,sha256} from '../../../../base/modules/import-kit/src/provenance/identity'

const changed=():never=>{throw new Error('STORED_PLAN_CHANGED')}
/** The copy search needs one page, not a receipt. Use the maintained canonical
 * JSON encoding and native SHA-256 once for each distinct custody witness.
 * This avoids rewalking every byte through the streaming canonical hasher and
 * repeating the expanded fingerprint check in the receipt reader. */
export async function copyPlan(db:D1Database,id:string):Promise<ImportPlan>{
 const job=await db.prepare('SELECT plan_json,fingerprint,principal_id,namespace,destination FROM ik_jobs WHERE id=?').bind(id).first<{plan_json:string;fingerprint:string;principal_id:string;namespace:string;destination:string}>()
 if(!job)return changed()
 let body=job.plan_json,value=JSON.parse(body)
 if(value.d1Plan===1){
  const parts=(await db.prepare('SELECT ordinal,body FROM ik_d1_plan_chunks WHERE job_id=? ORDER BY ordinal').bind(id).all<{ordinal:number;body:string}>()).results
  body=parts.map(part=>part.body).join('')
  if(parts.length!==value.chunks||parts.some((part,i)=>part.ordinal!==i)||Buffer.byteLength(body)!==value.size||sha256(body)!==value.sha256)return changed()
  value=JSON.parse(body)
 }
 if(value.d1Plan){
  // Codec envelopes require a codec-aware import reader; the prior receipt
  // reader also refuses them without a codec. Never guess another encoding.
  if(value.d1Plan===3)throw new Error('IMPORT_PLAN_CODEC_REQUIRED')
  if(value.d1Plan!==2||!Number.isSafeInteger(value.size)||value.size<0||canonicalJson(Object.keys(value).sort())!==canonicalJson(['d1Plan','data','sha256','size'].sort())||sha256(canonicalJson(value))!==sha256(body))return changed()
  const input=Buffer.from(value.data,'base64')
  const result=inflateRawSync(input,{info:true,maxOutputLength:value.size}) as unknown as {buffer:Buffer;engine:{bytesWritten:number}}
  if(input.toString('base64')!==value.data||result.engine.bytesWritten!==input.length||result.buffer.length!==value.size||sha256(result.buffer)!==value.sha256)return changed()
  const expanded=JSON.parse(result.buffer.toString('utf8'))
  if(sha256(canonicalJson(expanded))!==value.sha256)return changed()
  value=expanded
 }
 const plan=value as ImportPlan,{fingerprint,...content}=plan
 if(fingerprint!==job.fingerprint||sha256(canonicalJson(content))!==job.fingerprint||plan.principalId!==job.principal_id||plan.namespace!==job.namespace||plan.destination!==job.destination)return changed()
 return plan
}
