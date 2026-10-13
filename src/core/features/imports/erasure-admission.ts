import type {Row} from '../data/archive'
import type {DataAuthority} from '../data/authority'
import {NativeError} from '../auth/native-tokens'
import {createUlid} from '@/core/shared/ulid'
import {eraseBounded} from '../../../../base/modules/import-kit/src/d1/erasure-bounded'
import {D1RequestLimitError,requestContext,reserveReturn} from '../../../../base/modules/import-kit/src/d1/budget'
import type {D1Database as KitDatabase,D1Statement,D1Sql} from '../../../../base/modules/import-kit/src/d1/types'
import {guard} from '../../../../base/modules/import-kit/src/d1/database'
import {measureErasurePages} from '../../../../base/modules/import-kit/src/d1/erasure-pages'
import {targetIdentity} from '../../../../base/modules/import-kit/src/d1/erasure-index'
import {erasureWorkContext} from './erasure-work'
import {erasureOperationContext} from './erasure-database'
import {eraseLegacySourceOptions} from './erasure-source'
import {projectedSourceSnapshot} from './erasure-admission-snapshot'

/** Base admits the complete exact snapshot/compiler cost before its first write.
 * This adapter can execute only real reads: it never simulates a successful
 * mutation. Reaching a batch proves admission, then stops before publication.
 * Every flat job receives metadata admission; large flat jobs also require
 * Base publication cost admission before native erasure starts. */
export async function admitFlatImportErasure(db:D1Database,records:Row[],authority?:DataAuthority):Promise<D1Sql[]>{
 if(!records.length)return []
 const admitted=new Error('FEEDBACK_ERASURE_ADMISSION_COMPLETE'),operation=createUlid(),fences:D1Sql[]=[]
 let counted:KitDatabase|undefined
 const readonly:KitDatabase={prepare(query){
  const wrap=(statement:D1Statement):D1Statement=>({bind:(...params)=>wrap(statement.bind(...params)),first:async<T>()=>{if(!/^SELECT\b/i.test(query.trim()))throw new Error('FEEDBACK_ERASURE_ADMISSION_READ_REQUIRED');return statement.first<T>()},all:async<T>()=>{if(!/^SELECT\b/i.test(query.trim()))throw new Error('FEEDBACK_ERASURE_ADMISSION_READ_REQUIRED');return statement.all<T>()}})
  return wrap(db.prepare(query))
 },async batch(){throw admitted}}
 for(const [ordinal,row]of records.entries()){
  const readDb=(counted??db) as D1Database
  const jobs=(await readDb.prepare('SELECT j.id,COALESCE(json_extract(j.plan_json,\'$.size\'),length(CAST(j.plan_json AS BLOB))) bytes FROM ik_jobs j JOIN ik_d1_plan_index i ON i.job_id=j.id WHERE i.target_identity=? AND NOT EXISTS(SELECT 1 FROM ik_d1_stream_pages p WHERE p.job_id=j.id) GROUP BY j.id').bind(targetIdentity('penny-feedback',String(row.target_kind),String(row.target_id))).all<{id:string;bytes:number}>()).results
  if(!jobs.length)continue
  const work={ordinal,target_kind:String(row.target_kind),target_id:String(row.target_id),namespace:String(row.namespace),row_keys_json:String(row.row_keys_json)}
  const reports=(await readDb.prepare("SELECT id FROM ik_jobs WHERE destination='penny-feedback' AND reversal_policy='preserve-conflicts' AND EXISTS(SELECT 1 FROM ik_d1_reversal_reports r WHERE r.job_id=ik_jobs.id)").all<{id:string}>()).results
  const pages=await measureErasurePages([...new Set([...jobs,...reports].map(job=>job.id))],readDb)
  fences.push(...pages.map(page=>guard(page.fence)))
  const prepared=await erasureWorkContext(readDb,operation,work,authority)
  const context=erasureOperationContext(reserveReturn(requestContext({...prepared,storage:{...prepared.storage,database:counted??readonly}}),48),operation,'running_import')
  counted=context.storage.database
  try{
   try{if(jobs.some(job=>job.bytes>512*1024))await eraseBounded(work.target_kind,work.target_id,[{sql:'UPDATE feedback_import_erasure_work SET complete=1 WHERE operation_id=? AND ordinal=? AND complete=0',params:[operation,ordinal]}],context)}catch(error){if(error!==admitted)throw error}
   // Compile the actual intended Base after-state; retained original bytes
   // must not make an otherwise bounded metadata publication look too large.
   for(const job of jobs)await eraseLegacySourceOptions(job.id,context,[{sql:'UPDATE feedback_import_erasure_work SET source_cursor=? WHERE operation_id=? AND ordinal=? AND source_cursor=? AND complete=1',params:[job.id,operation,ordinal,job.id]}],true,await projectedSourceSnapshot(job.id,work.target_kind,work.target_id,pages.find(page=>page.ids.includes(job.id))!,context))
  }catch(error){
   if(error instanceof D1RequestLimitError||error instanceof Error&&['IMPORT_D1_TRANSPORT_LIMIT','IMPORT_D1_VALUE_LIMIT','IMPORT_D1_STATEMENT_LIMIT'].includes(error.message))throw new NativeError('feedback_legacy_erasure_upgrade_required: This older saved import needs bounded Base erasure support before it can be erased safely. No records or files were removed.',409)
   throw error
  }
 }
 return fences
}
