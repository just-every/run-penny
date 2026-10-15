import type {Row} from '../data/archive'
import {dataBatch,type DataAuthority} from '../data/authority'
import type {ImportPlan,D1ImportContext} from '../../../../base/modules/import-kit/src/d1/index'
import {encodePlan} from '../../../../base/modules/import-kit/src/d1/plans'
import {planFingerprint} from '../../../../base/modules/import-kit/src/plan/index'
import {policyHash} from '../../../../base/modules/import-kit/src/d1/undo-state'
import {expandCompressedPlan} from '../../../../base/modules/import-kit/src/d1/compressed-plan'
import {validateFeedbackArchive} from './archive-custody'
import {feedbackMappingVersion} from './mapping'
import {withErasureDatabase} from './erasure-database'
import {eraseLegacySourceOptions} from './erasure-source'
import {NativeError} from '../auth/native-tokens'

function erasedOptions(data:Record<string,Row[]>,job:Row):ImportPlan|undefined{
 let body=String(job.plan_json),marker=JSON.parse(body)
 if(marker.d1Plan===1){body=data.ik_d1_plan_chunks.filter(row=>row.job_id===job.id).sort((a,b)=>Number(a.ordinal)-Number(b.ordinal)).map(row=>row.body).join('');marker=JSON.parse(body)}
 const plan:ImportPlan=marker.d1Plan?expandCompressedPlan(body):marker
 if(!Object.hasOwn(plan.source,'options')||!plan.erasure)return
 if(plan.erasure.originalPolicy!=='withdraw-all-job-artifacts'||!plan.entries.some(entry=>entry.erased)||plan.source.artifacts.some(artifact=>artifact.original?.status==='available'))throw new Error('FEEDBACK_SOURCE_ERASURE_NOT_AUTHORIZED')
 if(!['strict','preserve-conflicts'].includes(String(job.reversal_policy))||(job.reversal_policy_hash===null?job.reversal_policy!=='strict':job.reversal_policy_hash!==policyHash(String(job.id),plan.fingerprint,job.reversal_policy as 'strict'|'preserve-conflicts')))throw new NativeError('feedback_archive_custody_invalid',409)
 for(const entry of plan.entries.filter(entry=>entry.erased))if(!data.ik_d1_erased_sources.some(row=>row.destination===plan.destination&&row.identity===entry.identity)||!data.ik_d1_erased_targets.some(row=>row.destination===plan.destination&&row.identity===entry.erasedTargetIdentity))throw new NativeError('feedback_archive_custody_invalid',409)
 return plan
}
/** Validate the supplied archive first, then apply the existing privacy decision
 * to its legacy mapper copy. Import never reintroduces already erased originals.
 * Un-erased jobs and opaque erasure identities are left byte-exact. */
export function eraseArchivedSourceOptions(data:Record<string,Row[]>):void{
 validateFeedbackArchive(data)
 for(const job of data.ik_jobs){
  const plan=erasedOptions(data,job);if(!plan)continue
  const {options:discarded,...source}=plan.source as ImportPlan['source']&{options:unknown};void discarded
  const next={...plan,source};next.fingerprint=planFingerprint(next)
  const encoded=encodePlan(next,String(job.id));job.plan_json=encoded.body;job.fingerprint=next.fingerprint
  if(job.reversal_policy_hash!==null)job.reversal_policy_hash=policyHash(String(job.id),next.fingerprint,job.reversal_policy as 'strict'|'preserve-conflicts')
  data.ik_d1_plan_chunks=[...data.ik_d1_plan_chunks.filter(row=>row.job_id!==job.id),...encoded.chunks]
  data.ik_d1_creation_plans=data.ik_d1_creation_plans.filter(row=>row.job_id!==job.id)
  for(const row of data.ik_d1_indexed_jobs)if(row.job_id===job.id)row.fingerprint=next.fingerprint
  for(const row of data.ik_d1_custody_states)if(row.job_id===job.id)row.revision=Number(row.revision)+1
  for(const row of data.ik_d1_custody_revisions)if(row.job_id===job.id){row.revision=Number(row.revision)+1;row.seal=null}
 }
 validateFeedbackArchive(data)
}

/** Authenticated export also repairs already-completed historical erasures in
 * the live store. The export lock owns the repair, and each job uses the same
 * checked bounded publication as a pending erasure. */
export async function eraseExportedSourceOptions(db:D1Database,operation:string,data:Record<string,Row[]>,authority?:DataAuthority):Promise<boolean>{
 const jobs=data.ik_jobs.filter(job=>erasedOptions(data,job))
 if(!jobs.length)return false
 await dataBatch(db,[db.prepare("INSERT INTO data_apply_claims(operation_id) VALUES((SELECT s.lock_id FROM data_state s JOIN data_operations o ON o.id=s.lock_id WHERE s.singleton=1 AND s.lock_id=? AND s.phase='locked' AND o.kind='export' AND o.status='pending'))").bind(operation)],authority)
 let changed=false
 const revision=await db.prepare('SELECT revision FROM feedback_import_native_revision WHERE singleton=1').first<number>('revision')
 if(revision===null)throw new Error('FEEDBACK_REVISION_MISSING')
 const guards=[{sql:'EXISTS(SELECT 1 FROM feedback_import_native_revision WHERE singleton=1 AND revision=?)',params:[revision]}]
 const context:D1ImportContext={destination:'penny-feedback',namespace:'privacy-export',mappingVersion:feedbackMappingVersion,maxBatchBytes:1024*1024,storage:{database:db,targets:{read:async()=>undefined,matches:()=>guards[0],stagingRead:async()=>({row:undefined,guards}),stagingPublication:()=>({protect:[],seal:[],release:[],final:guards}),write:()=>{throw new Error('FEEDBACK_ARCHIVE_WRITE_REFUSED')},remove:()=>{throw new Error('FEEDBACK_ARCHIVE_WRITE_REFUSED')},list:async()=>[],matchesCount:count=>({sql:'?=0',params:[count]})}},authorization:{principalId:authority?.operatorId??'local-data-maintenance',predicate:()=>({sql:`EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND lock_id=? AND phase='applying')${authority?" AND EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id WHERE s.id=? AND s.operator_id=? AND s.revoked_at IS NULL AND s.expires_at>unixepoch('subsec')*1000 AND o.status='active' AND o.version=s.operator_version AND o.version=?)":''}`,params:[operation,...(authority?[authority.id,authority.operatorId,authority.operator.version]:[])]})}}
 await withErasureDatabase(context,operation,authority,'pending',async bounded=>{
 for(const job of jobs){
  // A large rewrite continues on the next export; nothing is exported meanwhile.
  if(!await eraseLegacySourceOptions(String(job.id),{...bounded,namespace:String(job.namespace)}))throw new NativeError('feedback_export_repair_continuing: An older saved import is still being cleaned before export. Run the export again to continue; nothing was exported.',503)
  changed=true
 }
 })
 return changed
}
