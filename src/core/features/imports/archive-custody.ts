import {feedbackReceipt} from './receipt'
import {validateStreamArchive} from './archive-streams'
import {expandCompressedPlan} from '../../../../base/modules/import-kit/src/d1/compressed-plan'
import {sha256} from '../../../../base/modules/import-kit/src/d1/index'
import { canonicalJson } from '../../../../base/modules/import-kit/src/d1/index.ts'
import { encodePlan } from '../../../../base/modules/import-kit/src/d1/plans.ts'
import { planFingerprint } from '../../../../base/modules/import-kit/src/plan/index.ts'
import { originalStorage } from '../../../../base/modules/import-kit/src/d1/original-storage.ts'
import { planIndex } from '../../../../base/modules/import-kit/src/d1/erasure-index.ts'
import type { ImportPlan } from '../../../../base/modules/import-kit/src/types.ts'
import type { Row } from '../data/archive'
import { NativeError } from '../auth/native-tokens'
const refuse=():never=>{throw new NativeError('feedback_archive_custody_invalid',409)}
const equal=(actual:unknown,expected:unknown)=>{if(canonicalJson(actual)!==canonicalJson(expected))refuse()}
const sorted=(rows:unknown[])=>rows.map(canonicalJson).sort()
/** Archive custody is an authenticated product-data operation, separate from
 * actor-bound job execution. Use the pinned kit's own encoders/fingerprint and
 * original layout; no fabricated import principal or session is admitted. */
export function validateFeedbackArchive(data:Record<string,Row[]>):void {
 // Penny retains ordinary jobs and reviewed streams. Private preparations/publication fences
 // cannot be moved to another installation as executable pending work; completed erasure
 // progress is portable custody beside its journal receipt.
 for(const [name,rows] of Object.entries(data))if((name.startsWith('ik_d1_staging')||name.startsWith('ik_d1_native_staging')||['ik_d1_preparation_receipts','ik_d1_preparation_steps','ik_d1_publication_fences'].includes(name))&&rows.length)refuse()
 if((data.ik_d1_erasure_progress??[]).some(row=>row.phase!=='complete'))refuse()
 try{validateStreamArchive(data)}catch{refuse()}
 const expectedCopies:unknown[]=[],expectedIndex:unknown[]=[],expectedOriginals:unknown[]=[],expectedOriginalChunks:unknown[]=[],expectedPlans:unknown[]=[]
 const streamPlans=new Map<string,{ordinal:number;plan:ImportPlan}[]>()
 const jobs=new Set((data.ik_jobs??[]).map(job=>job.id))
 for(const [name,rows] of Object.entries(data))if(name.startsWith('ik_')&&name!=='ik_jobs')for(const row of rows)if('job_id' in row&&!jobs.has(row.job_id))refuse()
 for(const job of data.ik_jobs??[]) {
  const parts=(data.ik_d1_plan_chunks??[]).filter(row=>row.job_id===job.id).sort((a,b)=>Number(a.ordinal)-Number(b.ordinal))
  const page=(data.ik_d1_stream_pages??[]).find(row=>row.job_id===job.id),stream=!!page
  const plan:ImportPlan=(()=>{try{let body=String(job.plan_json),marker=JSON.parse(body);if(marker?.d1Plan===1){body=parts.map(p=>p.body).join('');if(parts.length!==marker.chunks||parts.some((part,index)=>part.ordinal!==index)||new TextEncoder().encode(body).length!==marker.size||sha256(body)!==marker.sha256)return refuse();marker=JSON.parse(body)}return marker.d1Plan?expandCompressedPlan(body):marker}catch{return refuse()}})()
  if(planFingerprint(plan)!==job.fingerprint||plan.fingerprint!==job.fingerprint||plan.principalId!==job.principal_id||plan.destination!==job.destination||plan.namespace!==job.namespace||plan.mappingVersion!==job.mapping_version||plan.entries.length!==job.total)refuse()
  if(stream){const page=(data.ik_d1_stream_pages??[]).find(row=>row.job_id===job.id)!,bundle=(data.feedback_import_bundles??[]).find(row=>row.id===page.stream_id);if(!bundle)refuse();const metadata=JSON.parse(String(bundle!.originals_json));if(bundle!.originals_state!=='withdrawn')equal(plan.source.artifacts.map(({name,sha256,size})=>({name,sha256,size})),metadata.map(({name,sha256,size}:Record<string,unknown>)=>({name,sha256,size})));const plans=streamPlans.get(String(page.stream_id))??[];plans.push({ordinal:Number(page.ordinal),plan});streamPlans.set(String(page.stream_id),plans)}
  const encoded=stream?{body:String(job.plan_json),chunks:parts}:encodePlan(plan,String(job.id));equal(job.plan_json,encoded.body);equal(parts,encoded.chunks)
  expectedPlans.push(...encoded.chunks)
  // Old ordinary jobs retained these creation witnesses. The maintained kit
  // releases them after atomic creation; either exact lifecycle is portable.
  if((data.ik_d1_creation_plans??[]).some(row=>row.job_id===job.id))expectedCopies.push(...encoded.chunks.map(row=>({...row,released:0})))
  const version=(data.ik_original_sets??[]).find(row=>row.job_id===job.id)
  if(version?.version!==(stream?4:3))refuse()
  const originals=originalStorage(plan,String(job.id),stream?4:3)
  expectedOriginals.push(...originals.rows);expectedOriginalChunks.push(...originals.chunks)
  const receipt=(data.ik_d1_indexed_jobs??[]).find(row=>row.job_id===job.id)
  if(receipt){equal(receipt.fingerprint,job.fingerprint);expectedIndex.push(...planIndex(plan,String(job.id)))}
  // Base also seals stream creation with its parent ID. The exact origin,
  // parent revision/layout and sealed bundle were validated above; the plan,
  // originals and bundle receipt must still match in full. A foreign UUID or
  // an ordinary job cannot use this publication witness as custody authority.
  const parent=page&&(data.ik_d1_streams??[]).find(row=>row.id===page.stream_id)
  const creationSeal=page&&parent?.state==='applying'&&job.state==='queued'&&job.checkpoint===0&&!plan.erasure&&job.operation_key===`${page.stream_id}:${page.ordinal}`?page.stream_id:undefined
  // Completed bounded erasure retains its own UUID seal. Private staging and
  // publication rows must already be absent for either lifecycle.
  for(const name of ['ik_d1_custody_revisions','ik_d1_custody_states']){
   const rows=(data[name]??[]).filter(row=>row.job_id===job.id)
   if(rows.length!==1||!Number.isSafeInteger(rows[0].revision)||Number(rows[0].revision)<0||(name==='ik_d1_custody_revisions'&&rows[0].seal!==null&&!(creationSeal!==undefined&&rows[0].seal===creationSeal)&&!(plan.erasure&&plan.entries.some(entry=>entry.erased)&&typeof rows[0].seal==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(rows[0].seal))))refuse()
  }
 }
 for(const [id,plans]of streamPlans){const bundle=data.feedback_import_bundles.find(row=>row.id===id)!;if(bundle.originals_state==='withdrawn'){if(!plans.some(({plan})=>plan.entries.some(entry=>entry.erased)))refuse()}else equal(bundle.receipt_json,canonicalJson(feedbackReceipt(plans.sort((a,b)=>a.ordinal-b.ordinal).map(row=>row.plan))))}
 equal(sorted(data.ik_d1_creation_plans??[]),sorted(expectedCopies))
 equal(sorted(data.ik_d1_plan_chunks??[]),sorted(expectedPlans))
 equal(sorted(data.ik_originals??[]),sorted(expectedOriginals))
 equal(sorted(data.ik_d1_original_chunks??[]),sorted(expectedOriginalChunks))
 equal(sorted(data.ik_d1_plan_index??[]),sorted(expectedIndex))
}
