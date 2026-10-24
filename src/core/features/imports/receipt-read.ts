import {authorize,readAtomic,guard,sql} from '../../../../base/modules/import-kit/src/d1/database'
import type { D1ImportContext,ImportPlan,D1Database as KitDatabase } from '../../../../base/modules/import-kit/src/d1/index'
import { sha256 } from '../../../../base/modules/import-kit/src/d1/index'
import { expandCompressedPlan } from '../../../../base/modules/import-kit/src/d1/compressed-plan'
import { planFingerprint } from '../../../../base/modules/import-kit/src/plan/index'
import { receiptAccumulator } from './receipt'

export async function* jobPlans(id:string,db:KitDatabase,stream:boolean,after=-1,limit=Number.MAX_SAFE_INTEGER):AsyncGenerator<{ordinal:number;jobId:string;plan:ImportPlan}>{
 let cursor=after,remaining=limit
 while(remaining>0){
  const {results:jobs}=await db.prepare(stream?`SELECT j.id,j.plan_json,j.fingerprint,j.principal_id,j.namespace,j.destination,p.ordinal FROM ik_jobs j JOIN ik_d1_stream_pages p ON p.job_id=j.id WHERE p.stream_id=? AND p.ordinal>? ORDER BY p.ordinal LIMIT ?`:`SELECT id,plan_json,fingerprint,principal_id,namespace,destination,0 ordinal FROM ik_jobs WHERE id=? AND 0>? LIMIT ?`).bind(id,cursor,Math.min(8,remaining)).all<{id:string;plan_json:string;fingerprint:string;principal_id:string;namespace:string;destination:string;ordinal:number}>()
  if(!jobs.length)return
  for(const job of jobs){
   const {results:chunks}=await db.prepare('SELECT job_id,ordinal,body FROM ik_d1_plan_chunks WHERE job_id=? ORDER BY ordinal').bind(job.id).all<{job_id:string;ordinal:number;body:string}>()
   let body=job.plan_json,marker=JSON.parse(body)
   if(marker.d1Plan===1){const parts=chunks.filter(row=>row.job_id===job.id);body=parts.map(row=>row.body).join('');if(parts.length!==marker.chunks||parts.some((row,i)=>row.ordinal!==i)||new TextEncoder().encode(body).length!==marker.size||sha256(body)!==marker.sha256)throw new Error('STORED_PLAN_CHANGED');marker=JSON.parse(body)}
   const plan:ImportPlan=marker.d1Plan?expandCompressedPlan(body):marker
   if(plan.fingerprint!==job.fingerprint||planFingerprint(plan)!==job.fingerprint||plan.principalId!==job.principal_id||plan.namespace!==job.namespace||plan.destination!==job.destination)throw new Error('STORED_PLAN_CHANGED')
   yield {ordinal:job.ordinal,jobId:job.id,plan};cursor=job.ordinal;remaining--
  }
 }
}
export async function jobReceipt(id:string,context:D1ImportContext,stream:boolean){
 await authorize(context,'read')
 const db=context.storage.database
 const snapshot=(await db.prepare('SELECT c.job_id,c.revision FROM ik_d1_custody_states c WHERE job_id IN (SELECT job_id FROM ik_d1_stream_pages WHERE stream_id=? UNION SELECT ?) ORDER BY job_id').bind(id,id).all<{job_id:string;revision:number}>()).results
 const parent=await db.prepare(stream?'SELECT state FROM ik_d1_streams WHERE id=?':'SELECT state FROM ik_jobs WHERE id=?').bind(id).first<{state:string}>();if(!parent)throw new Error('IMPORT_JOB_NOT_FOUND')
 const children=await db.prepare('SELECT state FROM ik_jobs WHERE id IN (SELECT job_id FROM ik_d1_stream_pages WHERE stream_id=? UNION SELECT ?)').bind(id,id).all<{state:string}>()
 const scan=await db.prepare('SELECT ordinal FROM feedback_import_reversal_scans WHERE job_id=?').bind(id).first()
 const phase=scan?'preflighting':stream?(parent.state==='undoing'?(children.results.every(row=>['undone','rolled_back'].includes(row.state))?'undone':'undoing'):(children.results.every(row=>row.state==='completed')?'completed':'applying')):parent.state
 const {results}=await db.prepare(`SELECT e.source_identity,e.owner_job_id=e.job_id owned,COALESCE(MIN(p.reversed),0) reversed FROM ik_d1_entries e LEFT JOIN ik_provenance p ON p.job_id=e.job_id AND p.source_identity=e.source_identity WHERE e.job_id IN (SELECT job_id FROM ik_d1_stream_pages WHERE stream_id=? UNION SELECT ?) GROUP BY e.job_id,e.source_identity,e.owner_job_id`).bind(id,id).all<{source_identity:string;owned:number;reversed:number}>()
 const committed=new Map(results.map(row=>[row.source_identity,{owned:Boolean(row.owned),reversed:Boolean(row.reversed)}]))
 const accumulator=receiptAccumulator(phase,committed);let withdrawn=false
 for await(const {plan} of jobPlans(id,db,stream)){accumulator.add(plan);withdrawn ||= Boolean(plan.erasure?.originalPolicy)}
 const receipt=accumulator.finish()
 // Base preserves provenance on reversal. These counts are ownership receipts,
 // never current totals from unrelated work in the installation.
 const provenance=await db.prepare('SELECT COUNT(*) created,COALESCE(SUM(reversed),0) removed FROM ik_provenance WHERE job_id IN (SELECT job_id FROM ik_d1_stream_pages WHERE stream_id=? UNION SELECT ?)').bind(id,id).first<{created:number;removed:number}>()
 if(provenance?.created)receipt.destinations.push({table:'feedback_import_records',planned:receipt.sources.reduce((n,row)=>n+row.eligible,0),created:provenance.created,removed:provenance.removed,retained:provenance.created-provenance.removed})
 if(stream){const bundle=await db.prepare('SELECT originals_state FROM feedback_import_bundles WHERE id=?').bind(id).first<{originals_state:string}>();receipt.originalsRetained&&=bundle?.originals_state==='retained'}else receipt.originalsRetained&&=!withdrawn
 const notes=await db.prepare('SELECT kind,source_id,reason FROM feedback_import_receipt_notes WHERE job_id=?').bind(id).all<{kind:string;source_id:string;reason:string}>();receipt.conflicts=notes.results.map(row=>({kind:row.kind,sourceId:row.source_id,reason:row.reason}))
 await readAtomic(context,[guard(sql(`(SELECT COUNT(*) FROM ik_d1_custody_states WHERE job_id IN (SELECT job_id FROM ik_d1_stream_pages WHERE stream_id=? UNION SELECT ?))=? AND NOT EXISTS(SELECT 1 FROM json_each(?) expected WHERE NOT EXISTS(SELECT 1 FROM ik_d1_custody_states current WHERE current.job_id=json_extract(expected.value,'$.job_id') AND current.revision=json_extract(expected.value,'$.revision')))`,id,id,snapshot.length,JSON.stringify(snapshot)))])
 return receipt
}
