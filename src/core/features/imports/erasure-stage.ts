import {randomUUID} from 'node:crypto'
import {NativeError} from '../auth/native-tokens'
import type {D1ImportContext,D1Sql} from '../../../../base/modules/import-kit/src/d1/types'
import type {ErasureFragment} from '../../../../base/modules/import-kit/src/d1/erasure-fragments'
import {ErasureCompiler} from '../../../../base/modules/import-kit/src/d1/erasure-compiler'
import {authority,finalAuthority,readonlyChecks,guard,sql,prepare,withinBatchBytes} from '../../../../base/modules/import-kit/src/d1/database'
import {remaining,packGuards,D1RequestLimitError} from '../../../../base/modules/import-kit/src/d1/budget'
import {nativeStageAtomic,nativeStageGuards,type NativeStageBinding} from '../../../../base/modules/import-kit/src/d1/native-staging-state'
import {nativeStageCost} from '../../../../base/modules/import-kit/src/d1/native-staging-admission'
import {beginNativeStage,discardNativeStage} from '../../../../base/modules/import-kit/src/d1/native-staging-lifecycle'
import {nativePublication} from '../../../../base/modules/import-kit/src/d1/native-staging-publication'
import {nativeRowStatements} from '../../../../base/modules/import-kit/src/d1/native-staging-rows'
import {erasureIndexColumns,erasureValueColumns,privacyRows,valueRows} from '../../../../base/modules/import-kit/src/d1/erasure-values'
import {sha256} from '../../../../base/modules/import-kit/src/provenance/identity'
import {ResumedStageRows} from './erasure-stage-rows'

export const tooLarge=()=>new NativeError('feedback_legacy_erasure_upgrade_required: One step of this saved import erasure does not fit a single request. No records or files were removed.',409)

/** What one staged erasure publishes. `fragments` receives the stage id, which
 * Base's compiled references and private staging closure are bound to. The
 * caller's own statements surround the compiled writes in the final batch.
 * `direct` first tries Base's one-batch form when its complete values fit. */
export interface StagedErasure {
 direct?:boolean
 fragments:(id:string)=>()=>AsyncGenerator<ErasureFragment>
 snapshotGuards:D1Sql[]
 anchor:(compiler:ErasureCompiler)=>{id:string;fingerprint:string;fence:number}|undefined
 jobs:(compiler:ErasureCompiler)=>string[]
 targets:{kind:string;id:string;present:boolean}[]
 final:(compiler:ErasureCompiler,id:string)=>D1Sql[]
 statements?:(compiler:ErasureCompiler)=>Promise<{before:D1Sql[];after:D1Sql[]}>
}
type StageRow=NativeStageBinding&{revision:number;registered_revision:number|null;sealed_revision:number|null}

/** Base's bounded erasure stages, registers, seals and publishes in one request.
 * Here each request continues the same private stage from what earlier requests
 * verified: an unchanged custody snapshot recompiles to the same generation, and
 * anything else discards the stage and starts again. Every batch keeps Base's
 * baseline and stage guards. Returns true once published; false while pending.
 * `admit` proves, without writing, that every step fits one request. */
export async function stagedErasure(context:D1ImportContext,spec:StagedErasure,admit=false):Promise<boolean>{
 const db=context.storage.database,principal=context.authorization.principalId
 const existing=(await db.prepare("SELECT * FROM ik_d1_native_staging WHERE destination=? AND principal_id=? AND action='erase'").bind(context.destination,principal).all<StageRow>()).results
 const id=existing.length===1?existing[0].id:randomUUID(),compiler=new ErasureCompiler(context,id,spec.fragments(id));await compiler.inspect()
 if(spec.direct&&compiler.direct&&await direct(context,compiler,admit))return true
 const anchor=spec.anchor(compiler)
 if(compiler.unsafeOriginals||!anchor)throw tooLarge()
 const baseline=[...compiler.baseline(),...spec.snapshotGuards.map(guard)]
 const stage:NativeStageBinding={id,generation:sha256(id+'\n'+compiler.fingerprints.join('\n')),destination:context.destination,namespace:context.namespace,mapping_version:context.mappingVersion,principal_id:principal,job_id:anchor.id,fingerprint:anchor.fingerprint,job_fence:anchor.fence,action:'erase',values_count:compiler.values,chunks_count:compiler.payload.count,identities:compiler.indexes.count}
 const begin=[sql("DELETE FROM ik_d1_native_staging WHERE destination=? AND action='erase' AND (principal_id=? OR job_id=? OR id=?)",context.destination,principal,anchor.id,id),...beginNativeStage(stage,baseline)],discard=discardNativeStage(stage)
 const registered=stage.identities,sealed=registered+stage.chunks_count
 const registration=[...baseline,...nativeStageGuards(stage,registered),guard(sql('(SELECT count(*) FROM ik_d1_native_staging_index WHERE stage_id=?)=?',id,registered)),sql('UPDATE ik_d1_native_staging SET registered_revision=revision WHERE id=?',id),...baseline,...nativeStageGuards(stage,registered)]
 const seal=[...baseline,...nativeStageGuards(stage,sealed),guard(sql('EXISTS(SELECT 1 FROM ik_d1_native_staging WHERE id=? AND registered_revision IS NOT NULL) AND (SELECT count(*) FROM ik_d1_native_staging_values WHERE stage_id=?)=? AND (SELECT count(DISTINCT value_ordinal) FROM ik_d1_native_staging_values WHERE stage_id=?)=?',id,id,stage.chunks_count,id,stage.values_count)),sql('UPDATE ik_d1_native_staging SET sealed_revision=revision WHERE id=?',id),...baseline,...nativeStageGuards(stage,sealed)]
 const own=await spec.statements?.(compiler)??{before:[],after:[]}
 const publication=nativePublication(context,stage,{baseline,writes:[...own.before,...compiler.compiled.before,...compiler.compiled.writes,...own.after],post:compiler.compiled.post,jobs:spec.jobs(compiler),targets:spec.targets,binding:[],final:spec.final(compiler,id),erasure:true})
 // Each request must be able to replay the snapshot and verify one batch, or publish.
 compiler.indexes.cost(context,stage,baseline,'index',0);compiler.payload.cost(context,stage,baseline,'values',registered)
 const flush=nativeStageCost(context,stage,nativeRowStatements(stage,baseline,'values',erasureValueColumns,'[]',1,0,registered))
 const cost=(rows:D1Sql[])=>nativeStageCost(context,stage,rows)
 if(compiler.readQueries+cost(begin)+cost(registration)+flush>remaining(context)||cost(seal)+nativeStageCost(context,stage,publication.publication,publication.release,publication.final)>remaining(context))throw tooLarge()
 if(admit)return false
 const current=existing.find(row=>row.id===id&&(Object.keys(stage) as (keyof NativeStageBinding)[]).every(key=>row[key]===stage[key]))
 const counts=current?await db.prepare('SELECT (SELECT count(*) FROM ik_d1_native_staging_index WHERE stage_id=?) i,(SELECT count(*) FROM ik_d1_native_staging_values WHERE stage_id=?) v').bind(id,id).first<{i:number;v:number}>():null
 type Progress={i:number;v:number;revision:number;registered_revision:number|null;sealed_revision:number|null}
 const resumed:Progress|undefined=current&&counts&&current.revision===counts.i+counts.v?{i:counts.i,v:counts.v,revision:current.revision,registered_revision:current.registered_revision,sealed_revision:current.sealed_revision}:undefined
 const progress={writes:0},write=async(rows:D1Sql[],release:D1Sql[]=[],final:D1Sql[]=[])=>{await nativeStageAtomic(context,'erase',rows,0,release,final);progress.writes++}
 try{
  let state:Progress=resumed??{i:0,v:0,revision:0,registered_revision:null,sealed_revision:null}
  if(!resumed)await write(begin)
  if(state.registered_revision===null){
   const index=new ResumedStageRows({context,stage,baseline,table:'index',columns:erasureIndexColumns,progress},state.i,state.revision)
   await compiler.replay(async(fragment,_values,_start,indexStart)=>{for(const row of privacyRows(fragment,indexStart))await index.append(row)});await index.flush()
   await write(registration);state={...state,i:registered,revision:registered,registered_revision:registered}
  }
  if(state.sealed_revision===null||state.sealed_revision!==state.revision){
   const values=new ResumedStageRows({context,stage,baseline,table:'values',columns:erasureValueColumns,progress},state.v,state.revision)
   await compiler.replay(async(_fragment,retained,start)=>{for(const row of valueRows(retained,start))await values.append(row)});await values.flush()
   await write(seal)
  }
  await write(publication.publication,publication.release,publication.final)
  return true
 }catch(error){
  // A request that ran out of budget after verified progress continues next time.
  if(error instanceof D1RequestLimitError){if(progress.writes)return false;throw tooLarge()}
  await nativeStageAtomic(context,'erase',discard);throw error
 }
}

async function direct(context:D1ImportContext,compiler:ErasureCompiler,admit:boolean):Promise<boolean>{
 const {before,writes,post}=compiler.direct!,native=context.storage.targets.stagingPublication!(compiler.id,context.destination,[]).final.map(guard)
 const statements=[...packGuards([authority(context,'erase'),...native,...before,...writes,...post,...native,authority(context,'erase'),sql('DELETE FROM ik_d1_assertions')]),...readonlyChecks([...post,...native,...compiler.erasedFinal.map(guard)]),finalAuthority(context,'erase')]
 if(statements.length>remaining(context)||!withinBatchBytes(context,statements))return false
 if(!admit)await context.storage.database.batch(statements.map(row=>prepare(context.storage.database,row)))
 return true
}
