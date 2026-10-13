import type { D1TargetAdapter,D1Sql } from '../../../../base/modules/import-kit/src/d1/index'
import type { Row } from '../data/archive'
import { keyPredicate,quote,type NativeKey } from './native-keys'
/** Native privacy closure committed before this work item. An import target
 * can also contain independent native members outside that closure. Fence their
 * complete current values, and the absence of erased members, while Base removes
 * the target's normalized source copies. Maintenance keeps both states stable. */
export async function erasureTargets(db:D1Database,operation:string,work:{ordinal:number;target_kind:string;target_id:string;namespace:string;row_keys_json:string}):Promise<D1TargetAdapter&{nativeErasureGuards:D1Sql[]}>{
 const revision=await db.prepare('SELECT revision FROM feedback_import_native_revision WHERE singleton=1').first<number>('revision')
 if(revision===null)throw new Error('FEEDBACK_REVISION_MISSING')
 const keys=JSON.parse(work.row_keys_json) as NativeKey[]
 const nativeErasureGuards:D1Sql[]=[{sql:'EXISTS(SELECT 1 FROM feedback_import_native_revision WHERE singleton=1 AND revision=?)',params:[revision]},{sql:'NOT EXISTS(SELECT 1 FROM feedback_import_records WHERE target_kind=? AND target_id=?)',params:[work.target_kind,work.target_id]}]
 for(const key of keys){
  const where=keyPredicate(key),row=await db.prepare(`SELECT * FROM ${quote(key.table)} WHERE ${where.sql}`).bind(...where.params).first<Row>()
  if(!row){nativeErasureGuards.push({sql:`NOT EXISTS(SELECT 1 FROM ${quote(key.table)} WHERE ${where.sql})`,params:where.params});continue}
  // Include additive columns and SQL NULLs, and require exactly one matching
  // member. The revision guard also fences later relationships to these rows.
  nativeErasureGuards.push({sql:`(SELECT COUNT(*) FROM ${quote(key.table)} WHERE ${where.sql})=1`,params:where.params})
  nativeErasureGuards.push({sql:`(SELECT COUNT(*) FROM ${quote(key.table)} n,(SELECT json(?) value) expected WHERE ${Object.keys(row).map(column=>`n.${quote(column)} IS json_extract(expected.value,'$.${column}')`).join(' AND ')})=1`,params:[JSON.stringify(row)]})
 }
 // Source completion is written only by the final publication, after this
 // guard is read; any earlier change to it would let a resume report done.
 const exact=[{sql:'EXISTS(SELECT 1 FROM feedback_import_erasure_work WHERE operation_id=? AND ordinal=? AND target_kind=? AND target_id=? AND namespace IS ? AND row_keys_json=? AND source_complete=0)',params:[operation,work.ordinal,work.target_kind,work.target_id,work.namespace,work.row_keys_json]},...nativeErasureGuards]
 const matches=()=>({sql:exact.map(value=>'('+value.sql+')').join(' AND '),params:exact.flatMap(value=>value.params??[])})
 return {nativeErasureGuards,read:async(_db,_destination,kind,id)=>{if(kind!==work.target_kind||id!==work.target_id)throw new Error('FEEDBACK_ERASURE_TARGET_CHANGED');return undefined},matches,stagingRead:async()=>({row:undefined,guards:exact}),stagingPublication:()=>({protect:[],seal:[],release:[],final:exact}),write:()=>{throw new Error('FEEDBACK_ERASURE_WRITE_REFUSED')},remove:()=>{throw new Error('FEEDBACK_ERASURE_WRITE_REFUSED')},list:async()=>[],matchesCount:count=>({sql:'?=0',params:[count]})}
}
