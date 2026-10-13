import {NativeError} from '../auth/native-tokens'
import {randomUUID} from 'node:crypto'
import type {D1ImportContext,D1Sql} from '../../../../base/modules/import-kit/src/d1/types'
import type {ErasureFragment} from '../../../../base/modules/import-kit/src/d1/erasure-fragments'
import {ErasureCompiler} from '../../../../base/modules/import-kit/src/d1/erasure-compiler'
import {authority,finalAuthority,readonlyChecks,guard,sql,prepare,withinBatchBytes} from '../../../../base/modules/import-kit/src/d1/database'
import {remaining,packGuards,D1RequestLimitError} from '../../../../base/modules/import-kit/src/d1/budget'
import {NativeStageRows} from '../../../../base/modules/import-kit/src/d1/native-staging-rows'
import {nativeStageAtomic,nativeStageGuards,type NativeStageBinding} from '../../../../base/modules/import-kit/src/d1/native-staging-state'
import {nativeStageCost} from '../../../../base/modules/import-kit/src/d1/native-staging-admission'
import {beginNativeStage,discardNativeStage} from '../../../../base/modules/import-kit/src/d1/native-staging-lifecycle'
import {nativePublication} from '../../../../base/modules/import-kit/src/d1/native-staging-publication'
import {erasureIndexColumns,erasureValueColumns,privacyRows,valueRows} from '../../../../base/modules/import-kit/src/d1/erasure-values'

const unsupported=()=>new NativeError('feedback_legacy_erasure_upgrade_required: This older saved import needs bounded Base erasure support before its encoded input can be removed safely.',409)

/** Rewrite one legacy job's metadata without its mapper-only encoded input.
 * Base's compiler keeps every exact custody guard. A rewrite that fits one
 * batch publishes directly; otherwise Base's bounded private staging carries
 * the compact replacement, admitted in full before its first write. */
export async function publishSourceErasure(context:D1ImportContext,jobId:string,fragments:()=>AsyncGenerator<ErasureFragment>,admissionOnly=false):Promise<void>{
 const id=randomUUID(),compiler=new ErasureCompiler(context,id,fragments);await compiler.inspect()
 const protection=context.storage.targets.stagingPublication!(id,context.destination,[]),native=protection.final.map(guard)
 if(compiler.direct){
  const {before,writes,post}=compiler.direct
  const statements=[...packGuards([authority(context,'erase'),...native,...before,...writes,...post,...native,authority(context,'erase'),sql('DELETE FROM ik_d1_assertions')]),...readonlyChecks([...post,...native,...compiler.erasedFinal.map(guard)]),finalAuthority(context,'erase')]
  if(statements.length>remaining(context))throw new D1RequestLimitError()
  if(withinBatchBytes(context,statements)){if(!admissionOnly)await context.storage.database.batch(statements.map(row=>prepare(context.storage.database,row)));return}
 }
 if(compiler.unsafeOriginals)throw unsupported()
 await stageSourceErasure(context,compiler,jobId,admissionOnly)
}

async function stageSourceErasure(context:D1ImportContext,compiler:ErasureCompiler,jobId:string,admissionOnly:boolean):Promise<void>{
 const db=context.storage.database,anchor=compiler.jobs.get(jobId)
 if(!anchor)throw unsupported()
 const snapshot=await context.storage.targets.stagingRead!(db,context.destination,'','')
 if(!snapshot.guards.length)throw new Error('IMPORT_NATIVE_STAGING_GUARD_REQUIRED')
 const baseline=[...compiler.baseline(),...snapshot.guards.map(guard)]
 const stage:NativeStageBinding={id:compiler.id,generation:randomUUID(),destination:context.destination,namespace:context.namespace,mapping_version:context.mappingVersion,principal_id:context.authorization.principalId,job_id:anchor.id,fingerprint:anchor.fingerprint,job_fence:anchor.fence,action:'erase',values_count:compiler.values,chunks_count:compiler.payload.count,identities:compiler.indexes.count}
 // A crashed earlier attempt by any operator may have left private erasure
 // values for this job; privacy authority is the destination's, so clear them.
 const begin=[sql("DELETE FROM ik_d1_native_staging WHERE destination=? AND job_id=? AND action='erase'",context.destination,anchor.id),...beginNativeStage(stage,baseline)],discard=discardNativeStage(stage)
 const registered=stage.identities,sealed=registered+stage.chunks_count
 const registration=[...baseline,...nativeStageGuards(stage,registered),guard(sql('(SELECT count(*) FROM ik_d1_native_staging_index WHERE stage_id=?)=?',stage.id,registered)),sql('UPDATE ik_d1_native_staging SET registered_revision=revision WHERE id=?',stage.id),...baseline,...nativeStageGuards(stage,registered)]
 const seal=[...baseline,...nativeStageGuards(stage,sealed),guard(sql('EXISTS(SELECT 1 FROM ik_d1_native_staging WHERE id=? AND registered_revision IS NOT NULL) AND (SELECT count(*) FROM ik_d1_native_staging_values WHERE stage_id=?)=? AND (SELECT count(DISTINCT value_ordinal) FROM ik_d1_native_staging_values WHERE stage_id=?)=?',stage.id,stage.id,stage.chunks_count,stage.id,stage.values_count)),sql('UPDATE ik_d1_native_staging SET sealed_revision=revision WHERE id=?',stage.id),...baseline,...nativeStageGuards(stage,sealed)]
 const final:D1Sql[]=[...compiler.erasedFinal]
 const publication=nativePublication(context,stage,{baseline,writes:[...compiler.compiled.before,...compiler.compiled.writes],post:compiler.compiled.post,jobs:[anchor.id],targets:[],binding:[],final,erasure:true})
 const cost=2*compiler.readQueries+compiler.indexes.cost(context,stage,baseline,'index',0)+compiler.payload.cost(context,stage,baseline,'values',registered)+[begin,registration,seal,discard].reduce((n,rows)=>n+nativeStageCost(context,stage,rows),0)+nativeStageCost(context,stage,publication.publication,publication.release,publication.final)
 if(cost>remaining(context))throw unsupported()
 if(admissionOnly)return
 try{
  await nativeStageAtomic(context,'erase',begin)
  const index=new NativeStageRows(context,stage,baseline,'index',erasureIndexColumns)
  await compiler.replay(async(fragment,_values,_start,indexStart)=>{for(const row of privacyRows(fragment,indexStart))await index.append(row)});await index.flush()
  await nativeStageAtomic(context,'erase',registration)
  const values=new NativeStageRows(context,stage,baseline,'values',erasureValueColumns);values.revision=registered
  await compiler.replay(async(_fragment,retained,start)=>{for(const row of valueRows(retained,start))await values.append(row)});await values.flush()
  await nativeStageAtomic(context,'erase',seal)
  await nativeStageAtomic(context,'erase',publication.publication,0,publication.release,publication.final)
 }catch(error){await nativeStageAtomic(context,'erase',discard);throw error}
}
