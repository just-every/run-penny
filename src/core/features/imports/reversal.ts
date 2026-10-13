import type { D1Database as KitDatabase,D1ImportContext,D1Sql,TargetRow } from '../../../../base/modules/import-kit/src/d1/index'
import { atomic } from '../../../../base/modules/import-kit/src/d1/database'
import { canonicalJson,sha256 } from '../../../../base/modules/import-kit/src/d1/index'
import { jobPlans } from './receipt-read'
import { NativeError } from '../auth/native-tokens'
import { quote,rowKey } from './native-keys'
import type { NativeImportValue } from './types'
import type { NativeDependency } from './native-relations'
import { relationshipCheck } from './native-ownership'

const and=(parts:string[]):string=>parts.length===0?'1':parts.length===1?parts[0]:'('+and(parts.slice(0,Math.floor(parts.length/2)))+' AND '+and(parts.slice(Math.floor(parts.length/2)))+')'

function* boundedRows<T>(rows:T[]):Generator<T[]>{let group:T[]=[],bytes=2;for(const row of rows){const size=new TextEncoder().encode(canonicalJson(row)).length+1;if(group.length&&(group.length===250||bytes+size>256*1024)){yield group;group=[];bytes=2}group.push(row);bytes+=size}if(group.length)yield group}

/** Check complete value/relationship sets before reversal. A global native
 * revision prevents an edit after this scan from authorizing any deletion. */
export async function prepareReversal(id:string,context:D1ImportContext,stream:boolean,dependencies:NativeDependency[],intent:'undo'|'rollback',resuming:boolean):Promise<boolean>{
 const db=context.storage.database,revision=await db.prepare('SELECT revision FROM feedback_import_native_revision WHERE singleton=1').first<{revision:number}>()
 if(!revision)throw new Error('FEEDBACK_REVISION_MISSING')
 const saved=await db.prepare('SELECT revision,ordinal,intent FROM feedback_import_reversal_scans WHERE job_id=?').bind(id).first<{revision:number;ordinal:number;intent:'undo'|'rollback'}>()
 // Direction must survive an early conflict and a restart between a successful
 // preflight and Base committing its reversal state.
 if(!saved)await atomic(context,'undo',[{sql:'INSERT OR IGNORE INTO feedback_import_reversal_scans(job_id,revision,intent,ordinal) VALUES(?,?,?,-1)',params:[id,revision.revision,intent]},{sql:"SELECT CASE WHEN EXISTS(SELECT 1 FROM feedback_import_reversal_scans WHERE job_id=? AND intent=?) THEN 1 ELSE json('feedback_reversal_intent_changed') END",params:[id,intent]}])
 if(saved&&saved.revision!==revision.revision){
  await atomic(context,'undo',[{sql:'UPDATE feedback_import_reversal_scans SET revision=?,ordinal=-1 WHERE job_id=?',params:[revision.revision,id]},{sql:'INSERT OR REPLACE INTO feedback_import_receipt_notes(job_id,kind,source_id,reason) VALUES(?,?,?,?)',params:[id,'native history',id,'Native work changed during the complete undo check. All remaining owned effects are retained.']}])
  if(resuming)throw new NativeError('feedback_native_work_conflict',409)
 }
 // An explicit reversal request restarts its check; a resume first reports the
 // invalidated scan. Both retain the already chosen direction.
 let last=saved?.revision===revision.revision?saved.ordinal:-1
 for await(const {ordinal,jobId,plan} of jobPlans(id,db,stream,last,8)){
  if(plan.principalId!==context.authorization.principalId)throw new NativeError('feedback_import_actor_changed',403)
  const effects=new Map<string,TargetRow>()
  const {results:provenance}=await db.prepare('SELECT target_kind,target_id,record_json FROM ik_provenance WHERE reversed=0 AND job_id=?').bind(jobId).all<{target_kind:string;target_id:string;record_json:string}>()
  const owned=new Map(provenance.map(row=>[row.target_kind+':'+row.target_id,JSON.parse(row.record_json) as {appliedRevision:string;valueHash:string}]))
  for(const entry of plan.entries)for(const effect of entry.effects){const p=owned.get(effect.targetKind+':'+effect.targetId);if(!p)continue;if(sha256(canonicalJson(effect.value))!==p.valueHash)throw new Error('PROVENANCE_CHANGED');effects.set(effect.targetKind+':'+effect.targetId,{destination:context.destination,targetKind:effect.targetKind,targetId:effect.targetId,value:effect.value,revision:p.appliedRevision})}
 const byTable=new Map<string,NativeImportValue['rows'][number]['values'][]>()
 for(const row of effects.values())for(const part of (row.value as unknown as NativeImportValue).rows){const rows=byTable.get(part.table)??[];rows.push(part.values);byTable.set(part.table,rows)}
 const checks:(D1Sql&{table?:string})[]=[]
 const jobScope="SELECT job_id FROM ik_d1_stream_pages WHERE stream_id=? UNION SELECT ?"
 for(const [table,rows] of byTable){const definition=dependencies.find(item=>item.table===table)!;if(!definition)throw new Error('FEEDBACK_REVERSAL_KEYS')
  const relations=relationshipCheck(table,column=>`json_extract(e.value,'$.${column}')`,{sql:jobScope,params:[id,id]},context.namespace,dependencies)
  for(const values of boundedRows(rows)){
   const keys=Object.keys(rowKey({table,values:values[0]}).keys)
   const unique=`(SELECT COUNT(*) FROM ${quote(table)} n WHERE ${and(keys.map(column=>`n.${quote(column)} IS json_extract(e.value,'$.${column}')`))})=1`
   const same=and(definition.columns.map(column=>`n.${quote(column)} IS json_extract(e.value,'$.${column}')`))
   checks.push({table,sql:`${relations.ctes.length?'WITH '+relations.ctes.join(',')+' ':''}SELECT NOT EXISTS(SELECT 1 FROM json_each(?) e WHERE NOT (${and([`(SELECT COUNT(*) FROM ${quote(table)} n WHERE ${same})=1`,unique,`(${relations.sql})`])})) allowed`,params:[...relations.params??[],canonicalJson(values)]})
  }
 }
 const metadata=[...effects.values()].map(row=>{const value=row.value as unknown as NativeImportValue;return {target_kind:row.targetKind,target_id:row.targetId,namespace:context.namespace,source_id:value.provenance.sourceId,artifact_hash:value.provenance.artifactHash,source_hash:value.provenance.payloadHash,revision:row.revision,row_keys_json:canonicalJson(value.rows.map(rowKey)),attribution:'historical-unverified'}})
 for(const values of boundedRows(metadata)){checks.push({table:'feedback_import_records',sql:`SELECT NOT EXISTS(SELECT 1 FROM json_each(?) e WHERE NOT EXISTS(SELECT 1 FROM feedback_import_records n WHERE ${Object.keys(values[0]).map(column=>`n.${quote(column)} IS json_extract(e.value,'$.${column}')`).join(' AND ')})) allowed`,params:[canonicalJson(values)]})}
 for(let start=0;start<checks.length;start+=8){
  const result=await db.batch(checks.slice(start,start+8).map(check=>db.prepare(check.sql).bind(...check.params??[]))) as {results:{allowed:number}[]}[]
  const conflict=result.findIndex(value=>value.results[0]?.allowed!==1)
  if(conflict>=0){const table=checks[start+conflict].table??'native history';await atomic(context,'undo',[{sql:'INSERT OR REPLACE INTO feedback_import_receipt_notes(job_id,kind,source_id,reason) VALUES(?,?,?,?)',params:[id,table,id,'Native '+table+' values or relationships changed. All remaining owned effects are retained.']}]);throw new NativeError('feedback_native_work_conflict',409)}
 }
  last=ordinal
 }
 const more=stream?await db.prepare('SELECT 1 FROM ik_d1_stream_pages WHERE stream_id=? AND ordinal>? LIMIT 1').bind(id,last).first():null
 if(more){
  await atomic(context,'undo',[{sql:"SELECT CASE WHEN (SELECT revision FROM feedback_import_native_revision WHERE singleton=1)=? THEN 1 ELSE json('feedback_native_work_conflict') END",params:[revision.revision]},{sql:'UPDATE feedback_import_reversal_scans SET ordinal=? WHERE job_id=? AND revision=?',params:[last,id,revision.revision]}])
  return false
 }
 await atomic(context,'undo',[{sql:'DELETE FROM feedback_import_receipt_notes WHERE job_id=?',params:[id]},{sql:'INSERT OR REPLACE INTO feedback_import_reversals(job_id,revision) SELECT ?,revision FROM feedback_import_native_revision WHERE singleton=1 AND revision=?',params:[id,revision.revision]},{sql:"SELECT CASE WHEN EXISTS(SELECT 1 FROM feedback_import_reversals WHERE job_id=? AND revision=(SELECT revision FROM feedback_import_native_revision WHERE singleton=1)) THEN 1 ELSE json('feedback_native_work_conflict') END",params:[id]}])
 return true
}
/** Every Base publication batch checks the scan revision and advances its own
 * approval in that same transaction. Concurrent native work cannot be adopted. */
export function reversalDatabase(database:KitDatabase,id:string):KitDatabase{
 return {prepare:sql=>database.prepare(sql),async batch(statements){
  const result=await database.batch([
   database.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM feedback_import_reversals WHERE job_id=? AND revision=(SELECT revision FROM feedback_import_native_revision WHERE singleton=1)) THEN 1 ELSE json('feedback_native_work_conflict') END").bind(id),
   ...statements,
   database.prepare('UPDATE feedback_import_reversals SET revision=(SELECT revision FROM feedback_import_native_revision WHERE singleton=1) WHERE job_id=?').bind(id),
  ]);return result.slice(1,-1)
 }}
}
