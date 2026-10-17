import { nativeAdditiveDefaults } from './native-additions'
import {createUlid} from '@/core/shared/ulid'
import { canonicalJson,sha256 } from '../../../../base/modules/import-kit/src/d1/index.ts'
import type { D1Database as KitDatabase, D1TargetAdapter, D1Sql } from '../../../../base/modules/import-kit/src/d1/index.ts'
import type { Json, TargetRow } from '../../../../base/modules/import-kit/src/types.ts'
import type { NativeImportValue } from './types'
import { quote,rowKey,keyPredicate,type NativeKey } from './native-keys'
import { relationshipFence,voteProjection,type NativeDependency } from './native-relations'
import schema from './native-schema.json'
// This schema is the persisted mapping format, not the current SQL row shape.
// Keep its null fields in receipt hashes while omitting only later null columns.
const mappedColumns=new Map(Object.entries(schema).map(([table,definition])=>[table,new Set(definition.columns.map(c=>c.name))]))
interface RecordRow {target_kind:string;target_id:string;namespace:string;source_id:string;artifact_hash:string;source_hash:string;revision:string;row_keys_json:string;attribution:string}
// D1 has a shallower expression limit than desktop SQLite. Balance the same
// conjunction so a complete native row/relationship fence stays executable.
function conjunction(parts:string[]):string {
 if(parts.length===1)return parts[0]
 const middle=Math.floor(parts.length/2)
 return '('+conjunction(parts.slice(0,middle))+' AND '+conjunction(parts.slice(middle))+')'
}
export function feedbackTargets(namespace:string,dependencies:NativeDependency[],reversing:boolean,actorId:string):D1TargetAdapter {
 const records='feedback_import_records'
 const removal=new Map<string,NativeKey[]>()
 const columns=new Map(dependencies.map(dependency=>[dependency.table,dependency.columns]))
 async function read(db:KitDatabase,destination:string,kind:string,id:string):Promise<TargetRow|undefined> {
  const meta=await db.prepare(`SELECT * FROM ${records} WHERE target_kind=? AND target_id=?`).bind(kind,id).first<RecordRow>()
  if(!meta)return undefined
  const keys=JSON.parse(meta.row_keys_json) as NativeKey[], rows:NativeImportValue['rows']=[]
  removal.set(kind+':'+id,keys)
  for(const key of keys){
   const where=keyPredicate(key),values=await db.prepare(`SELECT * FROM ${quote(key.table)} WHERE ${where.sql}`).bind(...where.params).first<Record<string,Json>>()
   rows.push({table:key.table,values:Object.fromEntries(Object.entries(values??{}).filter(([column,value])=>mappedColumns.get(key.table)!.has(column)||(value!==null&&nativeAdditiveDefaults[key.table]?.[column]!==value)))})
  }
  return {destination,targetKind:kind,targetId:id,revision:meta.revision,value:{rows,provenance:{sourceId:meta.source_id,artifactHash:meta.artifact_hash,payloadHash:meta.source_hash}} as unknown as Json}
 }
 function matches(row:TargetRow|null,_destination:string,kind:string,id:string):D1Sql {
  if(!row){
   const keys=removal.get(kind+':'+id)??[], parts=keys.map(key=>{const where=keyPredicate(key);return {sql:`NOT EXISTS(SELECT 1 FROM ${quote(key.table)} WHERE ${where.sql})`,params:where.params}})
   return {sql:`NOT EXISTS(SELECT 1 FROM ${records} WHERE target_kind=? AND target_id=?) AND NOT EXISTS(SELECT 1 FROM feedback_import_tombstones WHERE target_kind=? AND target_id=?)`+parts.map(p=>' AND ('+p.sql+')').join(''),params:[kind,id,kind,id,...parts.flatMap(p=>p.params)]}
  }
  removal.set(kind+':'+id,(row.value as unknown as NativeImportValue).rows.map(rowKey))
  const value=row.value as unknown as NativeImportValue
  const predicates:D1Sql[]=[{sql:`EXISTS(SELECT 1 FROM ${records} WHERE target_kind=? AND target_id=? AND revision=? AND namespace=? AND source_id=? AND artifact_hash=? AND source_hash=? AND row_keys_json=? AND attribution='historical-unverified')`,params:[kind,id,row.revision,namespace,value.provenance.sourceId,value.provenance.artifactHash,value.provenance.payloadHash,canonicalJson(value.rows.map(rowKey))]}]
  for(const part of (row.value as unknown as NativeImportValue).rows) {
   const key=rowKey(part)
   const currentColumns=columns.get(part.table)
   if(!currentColumns?.length)throw new Error('IMPORT_NATIVE_SCHEMA')
   // A single JSON bind covers all native fields without exceeding D1's bound
   // parameter count. SQL NULL is compared with IS, never coerced to a value.
   // Omitted additive columns must still equal their SQL defaults inside the
   // transaction; native work cannot disappear from the receipt fence.
   predicates.push({sql:`(SELECT COUNT(*) FROM ${quote(part.table)} n,(SELECT json(?) value) expected WHERE ${conjunction([...new Set([...currentColumns,...Object.keys(part.values)])].map(column=>`n.${quote(column)} IS json_extract(expected.value,'$.${column}')`))})=1`,params:[canonicalJson({...nativeAdditiveDefaults[part.table],...part.values})]})
   // Keyless transfer identities can otherwise match multiple different full
   // rows. Removal must consume exactly the one row whose value was checked.
   predicates.push({sql:`(SELECT COUNT(*) FROM ${quote(part.table)} n,(SELECT json(?) value) expected WHERE ${conjunction(Object.keys(key.keys).map(column=>`n.${quote(column)} IS json_extract(expected.value,'$.${column}')`))})=1`,params:[canonicalJson(key.keys)]})
   if(reversing)predicates.push(relationshipFence({table:part.table,keys:part.values},row.revision,namespace,kind,id,dependencies))
  }
  // Scalar reads keep custody CTEs independent of native dependent rows. A
  // correlated outer binding would rematerialize ownership for each child.
  let index=0
  const sql=conjunction(predicates.map(p=>'('+p.sql.replace(/\?/g,()=>`(SELECT json_extract(data,'$[${index++}]') FROM import_values)`)+')'))
  return {sql:`WITH import_values AS (SELECT json(?) data) SELECT (${sql})`,params:[canonicalJson(predicates.flatMap(p=>p.params??[]))]}
 }
 return {read,matches,
  async list(db,destination){const {results}=await db.prepare(`SELECT target_kind,target_id FROM ${records} WHERE namespace=? ORDER BY target_kind,target_id`).bind(namespace).all<{target_kind:string;target_id:string}>();return await Promise.all(results.map(r=>read(db,destination,r.target_kind,r.target_id))).then(rows=>rows.filter((r):r is TargetRow=>Boolean(r)))},
  matchesCount(count){return {sql:`(SELECT COUNT(*) FROM ${records} WHERE namespace=?)=?`,params:[namespace,count]}},
  write(row){
   const value=row.value as unknown as NativeImportValue, keys=value.rows.map(rowKey), origin=value.provenance
   if(!origin)throw new Error('IMPORT_SOURCE_MAPPING_MISSING')
   const statements:D1Sql[]=value.rows.map(part=>({sql:`INSERT INTO ${quote(part.table)}(${Object.keys(part.values).map(quote).join(',')}) VALUES(${Object.keys(part.values).map(()=>'?').join(',')})`,params:Object.values(part.values)}))
   statements.push({sql:`INSERT INTO ${records}(target_kind,target_id,namespace,source_id,artifact_hash,source_hash,revision,row_keys_json,attribution) VALUES(?,?,?,?,?,?,?,?,'historical-unverified')`,params:[row.targetKind,row.targetId,namespace,origin.sourceId,origin.artifactHash,origin.payloadHash,row.revision,canonicalJson(keys)]})
   for(const part of value.rows.filter(p=>p.table==='request_vote_contributions'))statements.push(...voteProjection(String(part.values.request_id)))
   return statements
  },
  remove(_destination,kind,id){
   // The kit reads and checks the immutable native row before removal. Custody
   // keys are scoped to this adapter invocation, never to a Worker global.
   const keys=removal.get(kind+':'+id);if(!keys)throw new Error('IMPORT_REMOVAL_SNAPSHOT_MISSING')
   const statements:D1Sql[]=keys.toReversed().map(key=>{const where=keyPredicate(key);return {sql:`DELETE FROM ${quote(key.table)} WHERE ${where.sql}`,params:where.params}})
   statements.push({sql:`DELETE FROM ${records} WHERE target_kind=? AND target_id=?`,params:[kind,id]})
   const now=new Date().toISOString()
   statements.push({sql:`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) VALUES(?,'operator',?,?,'import_target',?,?,?,?)`,params:[createUlid(),actorId,reversing?'import.target_reversed':'import.target_replaced',sha256(canonicalJson([namespace,kind,id])),now,now,now]})
   for(const key of keys.filter(k=>k.table==='request_vote_contributions'))statements.push(...voteProjection(String(key.keys.request_id)))
   return statements
  },
 }
}
