import {withErasureDatabase} from './erasure-database'
import {NativeError} from '../auth/native-tokens'
import type { Row } from '../data/archive'
import type { DataAuthority } from '../data/authority'
import { retireD1ImportCustody,type D1ImportContext,type D1Sql } from '../../../../base/modules/import-kit/src/d1/index'
import { portabilityRedactionCheckpoint } from '../../../../scripts/portability/cleanup.mjs'
import { feedbackMappingVersion } from './mapping'
import { erasureTargets } from './erasure-targets'
import { targetIdentity } from '../../../../base/modules/import-kit/src/d1/erasure-index'
import {eraseLegacySourceOptions} from './erasure-source'
import {atomic,guard,sql} from '../../../../base/modules/import-kit/src/d1/database'

export function retainErasureWork(db:D1Database,operation:string,records:Row[]):D1PreparedStatement[]{
 const statements:D1PreparedStatement[]=[]
 for(let start=0;start<records.length;start+=250){const chunk=records.slice(start,start+250).map((row,index)=>({ordinal:start+index,kind:row.target_kind,id:row.target_id,namespace:row.namespace,keys:row.row_keys_json,target:targetIdentity('penny-feedback',String(row.target_kind),String(row.target_id))}))
  statements.push(db.prepare("INSERT INTO feedback_import_erasure_work(operation_id,ordinal,target_kind,target_id,namespace,row_keys_json) SELECT ?,json_extract(value,'$.ordinal'),json_extract(value,'$.kind'),json_extract(value,'$.id'),json_extract(value,'$.namespace'),json_extract(value,'$.keys') FROM json_each(?)").bind(operation,JSON.stringify(chunk)))
  const affected="SELECT DISTINCT p.stream_id FROM ik_d1_stream_pages p JOIN ik_d1_plan_index i ON i.job_id=p.job_id WHERE i.target_identity IN (SELECT json_extract(value,'$.target') FROM json_each(?))"
  statements.push(db.prepare(`DELETE FROM feedback_import_original_chunks WHERE bundle_id IN (${affected})`).bind(JSON.stringify(chunk)))
  statements.push(db.prepare(`UPDATE feedback_import_bundles SET originals_json='[]',receipt_json='{}',originals_state='withdrawn' WHERE id IN (${affected})`).bind(JSON.stringify(chunk)))
 }
 return statements
}
/** Data maintenance holds native writes/private reads throughout resumable
 * privacy work. Base's erasure authority is current destination authority and
 * never impersonates an old import principal. */
export async function resumeImportErasure(db:D1Database,operation:string,authority?:DataAuthority):Promise<boolean>{
 const work=await db.prepare('SELECT ordinal,target_kind,target_id,namespace,row_keys_json,complete,source_cursor,source_complete FROM feedback_import_erasure_work WHERE operation_id=? AND (complete=0 OR source_complete=0) ORDER BY ordinal LIMIT 1').bind(operation).first<{ordinal:number;target_kind:string;target_id:string;namespace:string;row_keys_json:string;complete:number;source_cursor:string;source_complete:number}>()
 if(!work){
  // The last item deletes every work row atomically with its completion. A row
  // left behind means the manifest changed outside that publication: hold.
  if(await db.prepare('SELECT 1 present FROM feedback_import_erasure_work WHERE operation_id=? LIMIT 1').bind(operation).first())throw new NativeError('feedback_erasure_work_changed: Saved import erasure work changed outside its guarded steps. The installation stays locked; nothing more was removed.',409)
  return true
 }
 const context=await erasureWorkContext(db,operation,work,authority)
 return withErasureDatabase(context,operation,authority,'running_import',async bounded=>{
 if(!work.complete){
  // Base's retirement is one D1 batch: it tombstones this record in every job (other people's
  // records keep undo and resume), journals the receipt, and carries portability's redaction
  // checkpoint so an archive older than the erasure is refused whole.
  await retireD1ImportCustody({target:{kind:work.target_kind,id:work.target_id}},[{sql:'UPDATE feedback_import_erasure_work SET complete=1 WHERE operation_id=? AND ordinal=? AND complete=0',params:[operation,work.ordinal]}],{...bounded,maxBatchBytes:undefined},await portabilityRedactionCheckpoint(db));return false}
 const next=await bounded.storage.database.prepare('SELECT DISTINCT job_id FROM ik_d1_plan_index WHERE target_identity=? AND job_id>? ORDER BY job_id LIMIT 1').bind(targetIdentity(context.destination,work.target_kind,work.target_id),work.source_cursor).first<{job_id:string}>()
 if(next){await eraseLegacySourceOptions(next.job_id,bounded,[{sql:'UPDATE feedback_import_erasure_work SET source_cursor=? WHERE operation_id=? AND ordinal=? AND source_cursor=? AND complete=1',params:[next.job_id,operation,work.ordinal,work.source_cursor]}]);return false}
 const others=await bounded.storage.database.prepare('SELECT 1 present FROM feedback_import_erasure_work WHERE operation_id=? AND ordinal<>? AND (complete=0 OR source_complete=0) LIMIT 1').bind(operation,work.ordinal).first()
 const before=context.storage.targets.stagingPublication!(operation,context.destination,[]).final.map(guard),native=context.nativeErasureGuards.map(guard),update=sql('UPDATE feedback_import_erasure_work SET source_complete=1 WHERE operation_id=? AND ordinal=? AND complete=1 AND source_cursor=?',operation,work.ordinal,work.source_cursor)
 const final=others?native:[...native,guard(sql('NOT EXISTS(SELECT 1 FROM feedback_import_erasure_work WHERE operation_id=?)',operation))]
 await atomic(bounded,'erase',[...before,update,...(others?[]:[guard(sql('NOT EXISTS(SELECT 1 FROM feedback_import_erasure_work WHERE operation_id=? AND (complete=0 OR source_complete=0))',operation)),sql('DELETE FROM feedback_import_erasure_work WHERE operation_id=?',operation)]),{sql:'SELECT 1',finalChecks:final}])
 return !others
 })
}

export async function erasureWorkContext(db:D1Database,operation:string,work:{ordinal:number;target_kind:string;target_id:string;namespace:string;row_keys_json:string},authority?:DataAuthority):Promise<D1ImportContext&{nativeErasureGuards:D1Sql[]}>{
 const targets=await erasureTargets(db,operation,work),context:D1ImportContext={destination:'penny-feedback',namespace:work.namespace,mappingVersion:feedbackMappingVersion,maxBatchBytes:1024*1024,originalErasurePolicy:'withdraw-all-job-artifacts',storage:{database:db,targets},authorization:{principalId:authority?.operatorId??'local-data-maintenance',predicate:()=>({sql:`EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND lock_id=? AND phase='applying')${authority?" AND EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id WHERE s.id=? AND s.operator_id=? AND s.revoked_at IS NULL AND s.expires_at>unixepoch('subsec')*1000 AND o.status='active' AND o.version=s.operator_version AND o.version=?)":''}`,params:[operation,...(authority?[authority.id,authority.operatorId,authority.operator.version]:[])]})}}
 return {...context,nativeErasureGuards:targets.nativeErasureGuards}
}
