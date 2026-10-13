import {Buffer} from 'node:buffer'
import {inflateRawSync} from 'node:zlib'
import type {ImportPlan} from '../../../../base/modules/import-kit/src/types'
import {canonicalJson,sha256} from '../../../../base/modules/import-kit/src/provenance/identity'

const changed=():never=>{throw new Error('STORED_PLAN_CHANGED')}
export type CopyPlanPage={witness:string;fingerprint:string;principal_id:string;namespace:string;destination:string;body:string;compressed:boolean;size:number;expandedSha?:string}
/** Capture one native page and check the storage envelope and byte checksum.
 * Its canonical plan and native fingerprint are verified separately, so a cold
 * preview continuation never has to decode, verify and search a large page.
 * A sealed witness binds later reads to these exact bytes and job identity;
 * only the witness crosses requests, never the retained private source page. */
export async function readCopyPlanPage(db:D1Database,id:string,expectedWitness?:string):Promise<CopyPlanPage>{
 const job=await db.prepare('SELECT plan_json,fingerprint,principal_id,namespace,destination FROM ik_jobs WHERE id=?').bind(id).first<{plan_json:string;fingerprint:string;principal_id:string;namespace:string;destination:string}>()
 if(!job)return changed()
 const {plan_json,...native}=job
 let body=plan_json,value=JSON.parse(body),expandedSha:string|undefined
 if(value.d1Plan===1){
  if(canonicalJson(value)!==body||canonicalJson(Object.keys(value).sort())!=='["chunks","d1Plan","sha256","size"]'||!Number.isSafeInteger(value.size)||value.size<0||typeof value.sha256!=='string'||!/^[a-f0-9]{64}$/.test(value.sha256)||!Number.isSafeInteger(value.chunks)||value.chunks<1)return changed()
  expandedSha=value.sha256
  const parts=(await db.prepare('SELECT ordinal,body FROM ik_d1_plan_chunks WHERE job_id=? ORDER BY ordinal').bind(id).all<{ordinal:number;body:string}>()).results
  body=parts.map(part=>part.body).join('')
  if(parts.length!==value.chunks||parts.some((part,i)=>part.ordinal!==i)||Buffer.byteLength(body)!==value.size||sha256(body)!==value.sha256)return changed()
  value=JSON.parse(body)
 }
 const witness=sha256(canonicalJson([id,native,sha256(body),expandedSha??null]))
 if(expectedWitness!==undefined&&expectedWitness!==witness)return changed()
 if(value.d1Plan){
  // Codec envelopes require a codec-aware import reader; never guess an encoding.
  if(value.d1Plan===3)throw new Error('IMPORT_PLAN_CODEC_REQUIRED')
  if(value.d1Plan!==2||!Number.isSafeInteger(value.size)||value.size<0||canonicalJson(Object.keys(value).sort())!==canonicalJson(['d1Plan','data','sha256','size'].sort())||sha256(canonicalJson(value))!==sha256(body))return changed()
  if(expectedWitness===undefined){
   const input=Buffer.from(value.data,'base64')
   const result=inflateRawSync(input,{info:true,maxOutputLength:value.size}) as unknown as {buffer:Buffer;engine:{bytesWritten:number}}
   if(input.toString('base64')!==value.data||result.engine.bytesWritten!==input.length||result.buffer.length!==value.size||sha256(result.buffer)!==value.sha256)return changed()
  }
  return {...native,witness,body:value.data,compressed:true,size:value.size,expandedSha:value.sha256}
 }
 return {...native,witness,body,compressed:false,size:Buffer.byteLength(body),expandedSha}
}
export function decodeCopyPlanPage(page:CopyPlanPage):ImportPlan{
 return JSON.parse(page.compressed?inflateRawSync(Buffer.from(page.body,'base64'),{maxOutputLength:page.size}).toString('utf8'):page.body) as ImportPlan
}
export function verifyCopyPlanPage(page:CopyPlanPage):ImportPlan{
 const plan=decodeCopyPlanPage(page)
 // Encode each canonical top-level value once: the expanded checksum and
 // content fingerprint differ only by the fingerprint field.
 const fields=Object.keys(plan).sort().map(key=>({key,body:JSON.stringify(key)+':'+canonicalJson((plan as unknown as Record<string,unknown>)[key])}))
 if(page.expandedSha&&sha256('{'+fields.map(field=>field.body).join(',')+'}')!==page.expandedSha)return changed()
 const content='{'+fields.filter(field=>field.key!=='fingerprint').map(field=>field.body).join(',')+'}'
 if(plan.fingerprint!==page.fingerprint||sha256(content)!==page.fingerprint||plan.principalId!==page.principal_id||plan.namespace!==page.namespace||plan.destination!==page.destination)return changed()
 return plan
}
export async function copyPlan(db:D1Database,id:string):Promise<ImportPlan>{return verifyCopyPlanPage(await readCopyPlanPage(db,id))}
