import {requestContext,reserveReturn} from '../../../../base/modules/import-kit/src/d1/budget'
import {atomic} from '../../../../base/modules/import-kit/src/d1/database'
import {prepareReversal,reversalDatabase} from './reversal'
import {jobReceipt} from './receipt-read'
import { applyD1ImportBatches,createD1ImportJob,readD1ImportJob,resumeD1Import,undoD1Import,rollbackD1Import,readD1ImportOriginals } from '../../../../base/modules/import-kit/src/d1/index.ts'
import type { D1ImportContext } from '../../../../base/modules/import-kit/src/d1/index.ts'
import type { PennyRuntime } from '@/core/app/runtime'
import { authenticateOperator } from '../auth/operator'
import { importAuthority,importAuthorityPredicate,IMPORT_OWNER_PRINCIPAL } from './job-authority'
import { NativeError } from '../auth/native-tokens'
import { feedbackTargets } from './native-targets'
import { nativeDependencies } from './native-relations'
import { feedbackMappingVersion } from './mapping'
import { type SavedFeedbackInput } from './types'
import {prepareFeedback} from './planning'
import {retainBundle,bundleOriginals,sealedContext} from './bundle'
import {createD1ImportStream,resumeD1ImportStream,readD1ImportStream,undoD1ImportStream} from '../../../../base/modules/import-kit/src/d1/index'
import {withoutLiveEffects} from '../integrations/effect-suppression'
import {redactionSettings} from '../redaction/settings'
import {admitPolicyResume,policyContext} from './redaction-policy'

function forwardContext(context:D1ImportContext,id:string):D1ImportContext {
 const original=context.authorization.predicate
 return {...context,authorization:{...context.authorization,predicate(action,destination){const guard=original(action,destination);return action==='apply'?{sql:`(${guard.sql}) AND NOT EXISTS(SELECT 1 FROM feedback_import_reversal_scans WHERE job_id=?)`,params:[...guard.params??[],id]}:guard}}}
}
async function admitApply(job:{id:string;state:string},context:D1ImportContext):Promise<D1ImportContext>{
 const scan=await context.storage.database.prepare('SELECT intent FROM feedback_import_reversal_scans WHERE job_id=?').bind(job.id).first()
 if(scan||['undoing','rolling_back'].includes(job.state))throw new NativeError('This import is reversing. Resume existing job '+job.id+' to continue its chosen reversal.',409)
 return forwardContext(context,job.id)
}

/** Who an import step acts for. A request carries the owner's session; a step
 * the server continues carries that owner's standing and its claim's fenced
 * database (data/runner). Base checks `predicate` inside every batch. */
export type ImportPrincipal={predicate:()=>{sql:string;params:unknown[]};actorId:string;operatorId:string;database:D1Database;session?:{id:string;operatorId:string;operator:{version:number;role:string}}}
export async function requestPrincipal(runtime:PennyRuntime,request:Request):Promise<ImportPrincipal> {
 const session=await importAuthority(runtime,request)
 if(request.method!=='GET'&&request.headers.get('Origin')!==runtime.configuration.appOrigin)throw new NativeError('forbidden_origin',403)
 const actor=await authenticateOperator(runtime,request)
 if(!actor)throw new NativeError('unauthenticated',401)
 return {predicate:()=>importAuthorityPredicate(session),actorId:actor.id,operatorId:session.operatorId,database:runtime.database.binding,session}
}
export async function importContext(runtime:PennyRuntime,principal:ImportPrincipal,namespace:string,reversing=false,jobPrincipal=IMPORT_OWNER_PRINCIPAL):Promise<{context:D1ImportContext;actor:string}> {
 const db=runtime.database.binding
 const context:D1ImportContext={destination:'penny-feedback',namespace,mappingVersion:feedbackMappingVersion,batchSize:10,maxBatches:1,
  storage:{database:withoutLiveEffects(principal.database),targets:feedbackTargets(namespace,await nativeDependencies(db),reversing,principal.actorId)},
  authorization:{principalId:jobPrincipal,predicate:principal.predicate}}
 return {context:reserveReturn(requestContext(context),32),actor:principal.actorId}
}
export async function previewFeedback(runtime:PennyRuntime,principal:ImportPrincipal,input:SavedFeedbackInput) {
 const {context,actor}=await importContext(runtime,principal,input.namespace)
 const policy=await redactionSettings(runtime.database.binding)
 return prepareFeedback(input,policyContext(context,policy.revision),actor,policy)
}
export async function applyFeedback(runtime:PennyRuntime,principal:ImportPrincipal,input:SavedFeedbackInput,fingerprint:string) {
 const admitted=await importContext(runtime,principal,input.namespace),policy=await redactionSettings(runtime.database.binding),context=policyContext(admitted.context,policy.revision),actor=admitted.actor
 const prepared=await prepareFeedback(input,context,actor,policy)
 if(prepared.counts.rejected||prepared.receipt.unresolved.length||prepared.diagnostics.some(d=>d.severity==='error'))throw new NativeError('feedback_mapping_rejected',422)
 if(prepared.fingerprint!==fingerprint)throw new NativeError('feedback_review_changed',409)
 context.reviewedFingerprint=fingerprint
 // An unchanged legacy review may already own this import. Compute its exact
 // former fingerprint in memory, then let Base validate its durable custody.
 // Never create another job with the obsolete mapper-only source property.
 if(prepared.legacyFingerprint){
  const legacyFingerprint=prepared.legacyFingerprint
  const legacy=await context.storage.database.prepare("SELECT id,state FROM ik_jobs WHERE destination=? AND namespace=? AND principal_id=? AND fingerprint=? AND state NOT IN ('undone','rolled_back') ORDER BY rowid LIMIT 1").bind(context.destination,context.namespace,context.authorization.principalId,legacyFingerprint).first<{id:string;state:string}>()
  if(legacy){context.reviewedFingerprint=legacyFingerprint;return applyD1ImportBatches(legacy.id,await admitApply(legacy,context))}
 }
 // A finished reversal releases ownership. Re-applying reviewed originals is a
 // new generation; replay of a live/completed generation remains idempotent.
 const prior=await runtime.database.binding.prepare("SELECT COUNT(*) n FROM ik_jobs j LEFT JOIN ik_d1_streams s ON s.id=j.id WHERE j.principal_id=? AND j.namespace=? AND COALESCE(s.fingerprint,j.fingerprint)=? AND j.state IN ('undone','rolled_back')").bind(context.authorization.principalId,input.namespace,fingerprint).first<{n:number}>()
 context.operationKey=prior?.n?fingerprint+':'+prior.n:fingerprint
 if(prepared.stream){
  const job=await createD1ImportStream(prepared.stream,context)
  await admitApply(job,context)
  await retainBundle(job.id,fingerprint,prepared.receipt,prepared.artifacts,context)
  return readD1ImportStream(job.id,sealedContext({...context,reviewedFingerprint:undefined},job.id))
 }
 const job=await createD1ImportJob(prepared.ordinary!,context)
 return await applyD1ImportBatches(job.id,await admitApply(job,context))
}
export type FeedbackJobAction='read'|'resume'|'undo'|'rollback'|'originals'|'receipt'
/** Admission (requestPrincipal) precedes job existence: unauthenticated requests cannot enumerate. */
export async function feedbackJob(runtime:PennyRuntime,principal:ImportPrincipal,id:string,action:FeedbackJobAction) {
 const db=runtime.database.binding, row=await db.prepare('SELECT j.namespace,j.principal_id,COALESCE(s.state,j.state) state FROM ik_jobs j LEFT JOIN ik_d1_streams s ON s.id=j.id WHERE j.id=?').bind(id).first<{namespace:string;principal_id:string;state:string}>()
 if(!row)throw new NativeError('feedback_job_not_found',404)
 const scan=await db.prepare('SELECT revision,ordinal,intent FROM feedback_import_reversal_scans WHERE job_id=?').bind(id).first<{revision:number;ordinal:number;intent:'undo'|'rollback'}>()
 const execution=scan&&['resume','undo','rollback'].includes(action)?scan.intent:action
 const reversing=['undo','rollback'].includes(action)||(action==='resume'&&(Boolean(scan)||['undoing','rolling_back'].includes(row.state)))
 const admitted=await importContext(runtime,principal,row.namespace,reversing,row.principal_id),policy=await redactionSettings(db);let context=policyContext(admitted.context,policy.revision)
 if(action==='resume'&&!reversing)await admitPolicyResume(id,context,policy)
 const stream=await db.prepare('SELECT id FROM ik_d1_streams WHERE id=?').bind(id).first()
 if(stream){context.batchSize=100;if(['resume','undo','rollback'].includes(action))context=sealedContext(context,id)}
 if(reversing){
  const prior=await db.prepare('SELECT revision FROM feedback_import_reversals WHERE job_id=? AND revision=(SELECT revision FROM feedback_import_native_revision WHERE singleton=1)').bind(id).first()
  if(!prior&&!await prepareReversal(id,context,Boolean(stream),await nativeDependencies(db),execution==='rollback'?'rollback':'undo',action==='resume')){const job=stream?await readD1ImportStream(id,context):await readD1ImportJob(id,context);return {...job,state:'preflighting',stage:'Checking every owned value and relationship before undo'}}
  context.storage.database=reversalDatabase(context.storage.database,id)
 }else if(action==='resume')context=forwardContext(context,id)
 if(action==='receipt')return jobReceipt(id,context,Boolean(stream))
 if(stream){
  const sealed=await db.prepare('SELECT sealed FROM feedback_import_bundles WHERE id=?').bind(id).first<{sealed:number}>();if(!sealed?.sealed)throw new NativeError('feedback_originals_incomplete',409)
  if(action==='originals'){await readD1ImportStream(id,context);return bundleOriginals(id,context)}
  if(execution==='resume')return resumeD1ImportStream(id,context)
  if(execution==='undo'||execution==='rollback'){
   const job=await undoD1ImportStream(id,context)
   await atomic(context,'undo',[{sql:'DELETE FROM feedback_import_reversal_scans WHERE job_id=?',params:[id]}])
   return job
  }
  const job=await readD1ImportStream(id,context);return scan?{...job,state:'preflighting',stage:'Checking every owned value and relationship before undo'}:job
 }
 if(action==='originals')return readD1ImportOriginals(id,context)
 if(execution==='resume')return resumeD1Import(id,context)
 if(execution==='undo'||execution==='rollback'){
  const job=await (execution==='undo'?undoD1Import(id,context):rollbackD1Import(id,context))
  await atomic(context,'undo',[{sql:'DELETE FROM feedback_import_reversal_scans WHERE job_id=?',params:[id]}])
  return job
 }
 const job=await readD1ImportJob(id,context);return scan?{...job,state:'preflighting',stage:'Checking every owned value and relationship before undo'}:job
}
