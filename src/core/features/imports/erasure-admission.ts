import type {Row} from '../data/archive'
import type {DataAuthority} from '../data/authority'
import {createUlid} from '@/core/shared/ulid'
import {NativeError} from '../auth/native-tokens'
import {D1RequestLimitError,requestContext,reserveReturn} from '../../../../base/modules/import-kit/src/d1/budget'
import {retireD1ImportCustodyStep} from '../../../../base/modules/import-kit/src/d1/index'
import type {D1Database as KitDatabase,D1ImportContext,D1Statement,D1Sql} from '../../../../base/modules/import-kit/src/d1/types'
import {guard} from '../../../../base/modules/import-kit/src/d1/database'
import {measureErasurePages} from '../../../../base/modules/import-kit/src/d1/erasure-pages'
import {targetIdentity} from '../../../../base/modules/import-kit/src/d1/erasure-index'
import {portabilityRedactionCheckpoint} from '../../../../scripts/portability/cleanup.mjs'
import {erasureStepKey,erasureWorkContext} from './erasure-work'
import {erasureOperationContext} from './erasure-database'
import {eraseLegacySourceOptions} from './erasure-source'
import {projectedSourceSnapshot} from './erasure-admission-snapshot'

export const tooLarge=()=>new NativeError('feedback_legacy_erasure_upgrade_required: One step of this saved import erasure does not fit a single request. No records or files were removed.',409)

/** A record in a retained flat plan this large may need a staged retirement
 * step; admission compiles it. Smaller plans' steps fit one bounded request. */
const STAGED_PLAN_BYTES=512*1024
const flatJobs=(db:KitDatabase,kind:string,id:string)=>db.prepare('SELECT j.id,COALESCE(json_extract(j.plan_json,\'$.size\'),length(CAST(j.plan_json AS BLOB))) bytes FROM ik_jobs j JOIN ik_d1_plan_index i ON i.job_id=j.id WHERE i.target_identity=? AND NOT EXISTS(SELECT 1 FROM ik_d1_stream_pages p WHERE p.job_id=j.id) GROUP BY j.id').bind(targetIdentity('penny-feedback',kind,id)).all<{id:string;bytes:number}>().then(result=>result.results)

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
  return admissionAuthority(erasureOperationContext(reserveReturn(requestContext(prepared),48),operation,'running_import'))
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
   if(jobs.some(job=>job.bytes>STAGED_PLAN_BYTES))await retireD1ImportCustodyStep({target:{kind:work.target_kind,id:work.target_id}},[complete],await step(work),await portabilityRedactionCheckpoint(db),{operationKey:erasureStepKey(operation,ordinal),admissionOnly:true})
   // Compile the actual intended Base after-state; retained original bytes
   // must not make an otherwise bounded metadata publication look too large.
   for(const job of jobs){const context=await step(work);await eraseLegacySourceOptions(job.id,context,[{sql:'UPDATE feedback_import_erasure_work SET source_cursor=? WHERE operation_id=? AND ordinal=? AND source_cursor=? AND complete=1',params:[job.id,operation,ordinal,job.id]}],{operationKey:erasureStepKey(operation,ordinal,job.id),admissionOnly:true},await projectedSourceSnapshot(job.id,work.target_kind,work.target_id,pages.find(page=>page.ids.includes(job.id))!,context))}
  }
 }catch(error){
  if(error instanceof D1RequestLimitError||error instanceof Error&&['IMPORT_D1_TRANSPORT_LIMIT','IMPORT_D1_VALUE_LIMIT','IMPORT_D1_STATEMENT_LIMIT'].includes(error.message))throw tooLarge()
  throw error
 }
 return fences
}

/** Base checks erase authority before compiling a step. Nothing is locked yet:
 * the authority that holds now is an idle installation (the operator's session
 * was asserted by the caller). The run's predicate text stays in the statement,
 * inert, so each admitted step costs at least what it will cost when it runs. */
function admissionAuthority(context:D1ImportContext):D1ImportContext{
 const predicate=context.authorization.predicate
 return {...context,authorization:{...context.authorization,predicate(action:Parameters<typeof predicate>[0],destination:string){const run=predicate(action,destination);return {sql:`EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle') AND ((${run.sql}) OR 1)`,params:run.params??[]}}}}
}

/** Only real reads reach the database; any write attempt is a defect here. */
function readOnly(db:D1Database):KitDatabase{
 // Base's authority check is itself a read-only batch of SELECT guards.
 const raw=new WeakMap<D1Statement,{statement:D1Statement;query:string}>()
 const read=(query:string)=>{if(!/^SELECT\b/i.test(query.trim()))throw new Error('FEEDBACK_ERASURE_ADMISSION_READ_REQUIRED')}
 const wrap=(statement:D1Statement,query:string):D1Statement=>{const wrapped:D1Statement={bind:(...params)=>wrap(statement.bind(...params),query),first:async<T>()=>{read(query);return statement.first<T>()},all:async<T>()=>{read(query);return statement.all<T>()}};raw.set(wrapped,{statement,query});return wrapped}
 return {prepare:query=>wrap(db.prepare(query) as unknown as D1Statement,query),async batch(statements){const originals=statements.map(statement=>raw.get(statement));for(const original of originals)read(original?.query??'');return (db as unknown as KitDatabase).batch(originals.map(original=>original!.statement))}}
}
