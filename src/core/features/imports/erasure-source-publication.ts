import type {D1ImportContext} from '../../../../base/modules/import-kit/src/d1/types'
import type {ErasureFragment} from '../../../../base/modules/import-kit/src/d1/erasure-fragments'
import {stagedErasure} from './erasure-stage'

/** Rewrite one legacy job's metadata without its mapper-only encoded input.
 * Base's compiler keeps every exact custody guard. A rewrite that fits one
 * batch publishes directly; otherwise private staging carries the compact
 * replacement across as many bounded requests as it needs. Returns true once
 * the rewrite is published. */
export async function publishSourceErasure(context:D1ImportContext,jobId:string,fragments:()=>AsyncGenerator<ErasureFragment>,admissionOnly=false):Promise<boolean>{
 const snapshot=await context.storage.targets.stagingRead!(context.storage.database,context.destination,'','')
 if(!snapshot.guards.length)throw new Error('IMPORT_NATIVE_STAGING_GUARD_REQUIRED')
 return stagedErasure(context,{direct:true,fragments:()=>fragments,snapshotGuards:snapshot.guards,anchor:compiler=>compiler.jobs.get(jobId),jobs:()=>[jobId],targets:[],final:compiler=>[...compiler.erasedFinal]},admissionOnly)
}
