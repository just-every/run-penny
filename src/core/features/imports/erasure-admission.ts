import type {Row} from '../data/archive'
import type {DataAuthority} from '../data/authority'
import {createUlid} from '@/core/shared/ulid'
import {D1RequestLimitError,requestContext,reserveReturn} from '../../../../base/modules/import-kit/src/d1/budget'
import type {D1Database as KitDatabase,D1ImportContext,D1Statement,D1Sql} from '../../../../base/modules/import-kit/src/d1/types'
import {guard} from '../../../../base/modules/import-kit/src/d1/database'
import {measureErasurePages} from '../../../../base/modules/import-kit/src/d1/erasure-pages'
import {portabilityRedactionCheckpoint} from '../../../../scripts/portability/cleanup.mjs'
import {erasureWorkContext} from './erasure-work'
import {erasureOperationContext} from './erasure-database'
import {eraseLegacySourceOptions} from './erasure-source'
import {projectedSourceSnapshot} from './erasure-admission-snapshot'
import {eraseStagedTarget,flatJobs,STAGED_PLAN_BYTES} from './erasure-staged-target'
import {tooLarge} from './erasure-stage'

/** Every step of a saved-import erasure runs in its own request: a record's
 * staged erasure, then one legacy source rewrite per job. Before any native
 * row is removed, each distinct step is compiled from real reads in a fresh
 * request budget, exactly as it will run, and must fit. Admission itself never
 * writes, and its own reads count against this request. */
export async function admitFlatImportErasure(db:D1Database,records:Row[],authority?:DataAuthority):Promise<D1Sql[]>{
 if(!records.length)return []
 const operation=createUlid(),fences:D1Sql[]=[],admitted=new Set<string>()
 const outer=requestContext({storage:{database:readOnly(db)}} as D1ImportContext).storage.database
 // A fresh wrapper gets its own budget; its reads still pass through this request's.
 const step=async(work:{ordinal:number;target_kind:string;target_id:string;namespace:string;row_keys_json:string}):Promise<D1ImportContext>=>{
  const fresh:KitDatabase={prepare:query=>outer.prepare(query),batch:statements=>outer.batch(statements)}
  const prepared=await erasureWorkContext(fresh as unknown as D1Database,operation,work,authority)
  return erasureOperationContext(reserveReturn(requestContext(prepared),48),operation,'running_import')
 }
 try{
  for(const [ordinal,row]of records.entries()){
   const work={ordinal,target_kind:String(row.target_kind),target_id:String(row.target_id),namespace:String(row.namespace),row_keys_json:String(row.row_keys_json)}
   const jobs=await flatJobs(outer,work.target_kind,work.target_id),key=JSON.stringify(jobs.map(job=>job.id).sort())
   // Later records of the same jobs act on plans already smaller by the earlier ones.
   if(!jobs.length||admitted.has(key))continue
   admitted.add(key)
   const reports=(await outer.prepare("SELECT id FROM ik_jobs WHERE destination='penny-feedback' AND reversal_policy='preserve-conflicts' AND EXISTS(SELECT 1 FROM ik_d1_reversal_reports r WHERE r.job_id=ik_jobs.id)").all<{id:string}>()).results
   const pages=await measureErasurePages([...new Set([...jobs,...reports].map(job=>job.id))],outer)
   fences.push(...pages.map(page=>guard(page.fence)))
   const complete={sql:'UPDATE feedback_import_erasure_work SET complete=1 WHERE operation_id=? AND ordinal=? AND complete=0',params:[operation,ordinal]}
   if(jobs.some(job=>job.bytes>STAGED_PLAN_BYTES))await eraseStagedTarget(work.target_kind,work.target_id,async()=>[complete,...await portabilityRedactionCheckpoint(db)],await step(work),true)
   // Compile the actual intended Base after-state; retained original bytes
   // must not make an otherwise bounded metadata publication look too large.
   for(const job of jobs){const context=await step(work);await eraseLegacySourceOptions(job.id,context,[{sql:'UPDATE feedback_import_erasure_work SET source_cursor=? WHERE operation_id=? AND ordinal=? AND source_cursor=? AND complete=1',params:[job.id,operation,ordinal,job.id]}],true,await projectedSourceSnapshot(job.id,work.target_kind,work.target_id,pages.find(page=>page.ids.includes(job.id))!,context))}
  }
 }catch(error){
  if(error instanceof D1RequestLimitError||error instanceof Error&&['IMPORT_D1_TRANSPORT_LIMIT','IMPORT_D1_VALUE_LIMIT','IMPORT_D1_STATEMENT_LIMIT'].includes(error.message))throw tooLarge()
  throw error
 }
 return fences
}

/** Only real reads reach the database; any write attempt is a defect here. */
function readOnly(db:D1Database):KitDatabase{
 const read=(query:string)=>{if(!/^SELECT\b/i.test(query.trim()))throw new Error('FEEDBACK_ERASURE_ADMISSION_READ_REQUIRED')}
 const wrap=(statement:D1Statement,query:string):D1Statement=>({bind:(...params)=>wrap(statement.bind(...params),query),first:async<T>()=>{read(query);return statement.first<T>()},all:async<T>()=>{read(query);return statement.all<T>()}})
 return {prepare:query=>wrap(db.prepare(query) as unknown as D1Statement,query),async batch(){throw new Error('FEEDBACK_ERASURE_ADMISSION_READ_REQUIRED')}}
}
