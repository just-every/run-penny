import {canonicalJson,stageD1ImportErasure,type D1ErasureStepOptions,type D1ImportContext,type D1Sql} from '../../../../base/modules/import-kit/src/d1/index'
import type {ErasureFragment} from '../../../../base/modules/import-kit/src/d1/erasure-fragments'

/** Rewrite one legacy job's metadata without its mapper-only encoded input.
 * Base's runner keeps every exact custody guard. A rewrite that fits one batch
 * publishes directly; otherwise its journaled private stage carries the compact
 * replacement across as many bounded requests as it needs, under one operation
 * key. Returns true once the rewrite is published. */
export async function publishSourceErasure(context:D1ImportContext,jobId:string,progress:D1Sql[],fragments:(context:D1ImportContext)=>()=>AsyncGenerator<ErasureFragment>,options:D1ErasureStepOptions):Promise<boolean>{
 const binding=canonicalJson(['penny-legacy-source-options-v1',jobId,progress])
 const step=await stageD1ImportErasure(context,options,binding,async(_id,bounded)=>{
  const snapshot=await bounded.storage.targets.stagingRead!(bounded.storage.database,bounded.destination,'','')
  if(!snapshot.guards.length)throw new Error('IMPORT_NATIVE_STAGING_GUARD_REQUIRED')
  return {fragments:fragments(bounded),snapshotGuards:snapshot.guards,targets:[],final:[],survivingJobs:()=>[jobId]}
 })
 return step.phase==='complete'
}
