import {randomUUID} from 'node:crypto'
import type {D1ImportContext,D1Sql} from '../../../../base/modules/import-kit/src/d1/types'
import {guard,sql} from '../../../../base/modules/import-kit/src/d1/database'
import {targetIdentity,indexedDestinationGuard,unindexedJobs} from '../../../../base/modules/import-kit/src/d1/erasure-index'
import {selectKeys,selectedCounts,exactRows,jsonChunks} from '../../../../base/modules/import-kit/src/d1/sets'
import {stageErasure,stagedSourceIdentities} from '../../../../base/modules/import-kit/src/d1/staging-erasure'
import {targetGuards} from '../../../../base/modules/import-kit/src/d1/target-guards'
import {erasureFragments,type ErasureFragment} from '../../../../base/modules/import-kit/src/d1/erasure-fragments'
import {measureErasurePages,type ErasurePage} from '../../../../base/modules/import-kit/src/d1/erasure-pages'
import {tallyBefore,tallyJournal,tallyStores} from '../../../../base/modules/import-kit/src/d1/retirement-tally'
import {stagedErasure} from './erasure-stage'

/** Retained flat plans larger than this are rewritten through private staging:
 * Base's retirement batch carries roughly twice the plan in one request. */
export const STAGED_PLAN_BYTES=512*1024
export const flatJobs=(db:D1Database|D1ImportContext['storage']['database'],kind:string,id:string)=>db.prepare('SELECT j.id,COALESCE(json_extract(j.plan_json,\'$.size\'),length(CAST(j.plan_json AS BLOB))) bytes FROM ik_jobs j JOIN ik_d1_plan_index i ON i.job_id=j.id WHERE i.target_identity=? AND NOT EXISTS(SELECT 1 FROM ik_d1_stream_pages p WHERE p.job_id=j.id) GROUP BY j.id').bind(targetIdentity('penny-feedback',kind,id)).all<{id:string;bytes:number}>().then(result=>result.results)
export const stagedTarget=async(db:D1Database|D1ImportContext['storage']['database'],kind:string,id:string)=>(await flatJobs(db,kind,id)).some(job=>job.bytes>STAGED_PLAN_BYTES)

/** Retirement erases one record from every job in a single unbounded batch.
 * A job too large for one bounded batch is erased through Base's staged
 * erasure form instead, continued across requests, with the same journal
 * receipt and the caller's statements (progress and the portability restore
 * checkpoint) in its final publication. Returns true once published. */
export async function eraseStagedTarget(kind:string,targetId:string,statements:()=>Promise<D1Sql[]>,context:D1ImportContext,admit=false):Promise<boolean>{
 const {database:db,targets}=context.storage
 if(await db.prepare(`${unindexedJobs} LIMIT 1`).bind(context.destination).first())throw new Error('IMPORT_ERASURE_INDEX_UPGRADE_REQUIRED')
 const digest=targetIdentity(context.destination,kind,targetId),targetRows=await selectKeys(db,'ik_d1_plan_index','target_identity',[digest])
 const identities=new Set<string>([...targetRows.map(row=>row.source_identity),...await stagedSourceIdentities(digest,context)])
 const sourceRows=await selectKeys(db,'ik_d1_plan_index','source_identity',[...identities]),ids=[...new Set<string>(sourceRows.map(row=>row.job_id))].sort()
 const reports=(await db.prepare("SELECT id FROM ik_jobs WHERE destination=? AND reversal_policy='preserve-conflicts' AND EXISTS(SELECT 1 FROM ik_d1_reversal_reports r WHERE r.job_id=ik_jobs.id) ORDER BY id").bind(context.destination).all<{id:string}>()).results.map(row=>row.id)
 const snapshot=await targets.stagingRead!(db,context.destination,kind,targetId)
 if(!snapshot.guards.length)throw new Error('IMPORT_NATIVE_STAGING_GUARD_REQUIRED')
 const streams=(await db.prepare('SELECT DISTINCT stream_id AS id FROM ik_d1_stream_pages WHERE job_id IN (SELECT value FROM json_each(?)) ORDER BY id').bind(JSON.stringify(ids)).all<{id:string}>()).results.map(row=>row.id)
 // The stage's own private rows are discarded by its publication, never erased custody.
 const stores=(await tallyStores(db)).filter(store=>!/^ik_d1_(native_)?staging/.test(store.name)),touched={destination:context.destination,jobs:ids,streams}
 let pages:ErasurePage[]|undefined
 const fragments=(id:string)=>{
  const privateErasure=stageErasure(context.destination,digest,[...identities],id)
  const before=[indexedDestinationGuard(context.destination),...privateErasure.before,...selectedCounts('ik_d1_plan_index','target_identity',[digest],targetRows),...selectedCounts('ik_d1_plan_index','source_identity',[...identities],sourceRows),...exactRows('ik_d1_plan_index',['job_id','ordinal','source_identity','target_identity'],sourceRows),guard(sql("(SELECT count(*) FROM ik_jobs WHERE destination=? AND reversal_policy='preserve-conflicts' AND EXISTS(SELECT 1 FROM ik_d1_reversal_reports r WHERE r.job_id=ik_jobs.id))=?",context.destination,reports.length)),...targetGuards(targets,snapshot.row??null,context.destination,kind,targetId)]
  const after=[...privateErasure.after,...jsonChunks([...identities]).map(chunk=>sql('INSERT OR IGNORE INTO ik_d1_erased_sources(destination,identity) SELECT ?,value FROM json_each(?)',context.destination,chunk)),sql('INSERT OR IGNORE INTO ik_d1_erased_targets(destination,identity) VALUES(?,?)',context.destination,digest)]
  return async function*():AsyncGenerator<ErasureFragment>{
   yield {before,writes:[],post:targetGuards(targets,null,context.destination,kind,targetId),plans:[],jobs:[],erased:0}
   pages??=await measureErasurePages([...new Set([...ids,...reports])],db)
   yield* erasureFragments({ids,reports,identities,kind,targetId},context,pages)
   yield {before:[],writes:after,post:[],plans:[],jobs:[],erased:0}
  }
 }
 const final=(id:string)=>[...stageErasure(context.destination,digest,[...identities],id).final,sql('EXISTS(SELECT 1 FROM ik_d1_erased_targets WHERE destination=? AND identity=?)',context.destination,digest),...jsonChunks([...identities]).map(chunk=>sql('NOT EXISTS(SELECT 1 FROM json_each(?) i WHERE NOT EXISTS(SELECT 1 FROM ik_d1_erased_sources s WHERE s.destination=? AND s.identity=i.value))',chunk,context.destination))]
 return stagedErasure(context,{fragments,snapshotGuards:snapshot.guards,anchor:compiler=>[...compiler.jobs.values()][0],jobs:compiler=>[...compiler.jobs.keys()],targets:[{kind,id:targetId,present:false}],final:(compiler,id)=>[...final(id),...compiler.erasedFinal],
  // The journal images precede every erasure write and are counted after them;
  // compiled writes stay free of request-time values so the stage can resume.
  statements:async compiler=>{const receipt=randomUUID();return {before:tallyBefore(stores,receipt,touched),after:[...await statements(),...tallyJournal(stores,receipt,touched,{recordedAt:new Date().toISOString(),recordsErased:compiler.erased,jobsRetired:0,streamsRetired:0},true)]}}},admit)
}
