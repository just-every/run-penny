import {canonicalJson} from '../../../../base/modules/import-kit/src/d1/index'
import {planFingerprint} from '../../../../base/modules/import-kit/src/plan/index'
import {measureErasurePages} from '../../../../base/modules/import-kit/src/d1/erasure-pages'
import {readErasureSnapshot} from '../../../../base/modules/import-kit/src/d1/erasure-snapshot'
import {decode} from '../../../../base/modules/import-kit/src/d1/jobs'
import {attachReversal,loadReversalState,policyHash,snapshotReversalGuards} from '../../../../base/modules/import-kit/src/d1/undo-state'
import {readOriginals} from '../../../../base/modules/import-kit/src/d1/originals'
import {custodyGuards,inventoryGuards,releaseInventory} from '../../../../base/modules/import-kit/src/d1/integrity'
import {originalVersions} from '../../../../base/modules/import-kit/src/d1/original-storage'
import {retainPlan,storedPlanSnapshot} from '../../../../base/modules/import-kit/src/d1/plans'
import {erasureWrites} from '../../../../base/modules/import-kit/src/d1/erasure-writes'
import {planIndex,erasedIndexGuards} from '../../../../base/modules/import-kit/src/d1/erasure-index'
import {streamBoundary} from '../../../../base/modules/import-kit/src/d1/stream-boundary'
import {exactRows,selectedCounts} from '../../../../base/modules/import-kit/src/d1/sets'
import {ExpectedState,changed,deleteRows} from '../../../../base/modules/import-kit/src/d1/expected-state'
import {atomic,guard,sql} from '../../../../base/modules/import-kit/src/d1/database'
import type {D1ImportContext,D1Sql,ImportPlan} from '../../../../base/modules/import-kit/src/d1/index'
import type {ErasureFragment} from '../../../../base/modules/import-kit/src/d1/erasure-fragments'
import {publishSourceErasure} from './erasure-source-publication'
import type {InventorySnapshot} from '../../../../base/modules/import-kit/src/d1/inventory-snapshot'

/** Old Penny passed mapper-only options to Base. Remove them only after Base
 * has authenticated and erased the record/artifact custody. The replacement
 * retains every source decision, original withdrawal and replay fence. Returns
 * false while a staged rewrite still needs another request. */
export async function eraseLegacySourceOptions(id:string,context:D1ImportContext,progress:D1Sql[]=[],admissionOnly=false,projected?:InventorySnapshot):Promise<boolean>{
 if(projected&&!admissionOnly)throw new Error('FEEDBACK_ERASURE_PROJECTION_READ_ONLY')
 const pages=await measureErasurePages([id],context.storage.database)
 const initial=projected??await readErasureSnapshot(pages[0],context.storage.database,context.storage.targets.planCodec)
 if(!Object.hasOwn(initial.plans.get(id)!.source,'options')){
  const raw=initial.rows('ik_jobs','id',[id])[0],plan=initial.plans.get(id)!,job=decode(raw)
  const reversal=await loadReversalState(raw,plan,context,false,initial);attachReversal(job,reversal)
  await readOriginals(plan,id,context,initial);await inventoryGuards(job,plan,context,initial);releaseInventory(context)
  // No custody bytes change. The verified plan and its complete dependency
  // revision fence prove the mapper copy is absent while advancing the cursor.
  if(!admissionOnly){const native=context.storage.targets.stagingPublication!(id,context.destination,[]).final.map(guard),unchanged=[guard(pages[0].fence),...streamBoundary(id,'erase')];await atomic(context,'erase',[...native,...unchanged,...progress,...unchanged,...native,{sql:'SELECT 1',finalChecks:[...native,...unchanged]}])}
  return true
 }
 const fragments=async function*():AsyncGenerator<ErasureFragment>{
  const snapshot=projected??await readErasureSnapshot(pages[0],context.storage.database,context.storage.targets.planCodec)
  const raw=snapshot.rows('ik_jobs','id',[id])[0],plan=snapshot.plans.get(id)!
  const job=decode(raw),reversal=await loadReversalState(raw,plan,context,false,snapshot);attachReversal(job,reversal)
  await readOriginals(plan,id,context,snapshot)
  const streamPages=snapshot.rows('ik_d1_stream_pages','job_id',[id])
  const before=[...streamBoundary(id,'erase'),...exactRows('ik_d1_stream_pages',['stream_id','ordinal','job_id','total','erased_records'],streamPages),...selectedCounts('ik_d1_stream_pages','job_id',[id],streamPages),...snapshotReversalGuards(raw,reversal),...custodyGuards(plan,id),...await inventoryGuards(job,plan,context,snapshot)]
  const creation=projected?[]:(await context.storage.database.prepare('SELECT * FROM ik_d1_creation_plans WHERE job_id=? ORDER BY ordinal').bind(id).all<{job_id:string;ordinal:number;body:string;released:number}>()).results
  if(projected)for(const owner of projected.tables.get('ik_jobs')!)before.push(...exactRows('ik_d1_plan_chunks',['job_id','ordinal','body'],projected.tables.get('ik_d1_plan_chunks')!.filter(row=>row.job_id===owner.id),sql('job_id=?',owner.id)))
  const expectedCreation=storedPlanSnapshot(plan,id).chunks.map(row=>({...row,released:0}))
  if(creation.length&&canonicalJson(creation)!==canonicalJson(expectedCreation))throw new Error('FEEDBACK_SOURCE_CREATION_CHANGED')
  before.push(...exactRows('ik_d1_creation_plans',['job_id','ordinal','body','released'],creation,sql('job_id=?',id)))
  const index=planIndex(plan,id)
  before.push(...exactRows('ik_d1_plan_index',['job_id','ordinal','source_identity','target_identity'],index,sql('job_id=?',id)),guard(sql('EXISTS(SELECT 1 FROM ik_d1_indexed_jobs WHERE job_id=? AND fingerprint=?)',id,plan.fingerprint)))
  const source=plan.source as ImportPlan['source']&{options?:unknown}
  let writes:D1Sql[]=[...progress],post:D1Sql[]=[]
  if(Object.hasOwn(source,'options')){
   if(!admissionOnly&&(plan.erasure?.originalPolicy!=='withdraw-all-job-artifacts'||!plan.entries.some(entry=>entry.erased)||plan.source.artifacts.some(artifact=>artifact.original?.status==='available')))throw new Error('FEEDBACK_SOURCE_ERASURE_NOT_AUTHORIZED')
   const {options:discarded,...retainedSource}=source;void discarded
   const next={...plan,source:retainedSource};next.fingerprint=planFingerprint(next);originalVersions.set(next,originalVersions.get(plan)!)
   // Base fingerprints include unknown source fields. Rebind the plan, index
   // receipt and reversal policy together; operation keys remain review history.
   const retained=retainPlan(next,id),release=[sql('UPDATE ik_d1_creation_plans SET released=1 WHERE job_id=?',id),sql('DELETE FROM ik_d1_creation_plans WHERE job_id=?',id)]
   writes=[...release,changed(sql('DELETE FROM ik_d1_plan_chunks WHERE job_id=?',id),deleteRows('ik_d1_plan_chunks',row=>row.job_id===id)),...retained.statements,...release,...erasureWrites([{id,body:retained.body,fingerprint:next.fingerprint,erasedRecords:next.entries.filter(entry=>entry.erased).length,policyHash:reversal.binding===null?null:policyHash(id,next.fingerprint,reversal.policy)}],[]),...progress]
   post=[...custodyGuards(next,id),...exactRows('ik_d1_plan_chunks',['job_id','ordinal','body'],retained.encoded.chunks,sql('job_id=?',id)),...exactRows('ik_d1_plan_index',['job_id','ordinal','source_identity','target_identity'],index,sql('job_id=?',id)),guard(sql('EXISTS(SELECT 1 FROM ik_d1_indexed_jobs WHERE job_id=? AND fingerprint=?)',id,next.fingerprint)),guard(sql('EXISTS(SELECT 1 FROM ik_jobs WHERE id=? AND plan_json=? AND fingerprint=?)',id,retained.body,next.fingerprint)),guard(sql('NOT EXISTS(SELECT 1 FROM ik_d1_creation_plans WHERE job_id=?)',id)),...erasedIndexGuards(next)]
   // The entry/index tuples must remain identical, including opaque tombstones.
   if(canonicalJson(planIndex(next,id))!==canonicalJson(index))throw new Error('FEEDBACK_SOURCE_ERASURE_INDEX_CHANGED')
  }
  post.push(...streamBoundary(id,'erase'))
  post.unshift(...new ExpectedState([...before,...writes]).guards())
  releaseInventory(context)
  yield {before,writes,post,plans:[...snapshot.plans.values()],jobs:snapshot.tables.get('ik_jobs')!,erased:0}
 }
 return publishSourceErasure(context,id,fragments,admissionOnly)
}
