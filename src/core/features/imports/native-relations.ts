import type { D1Sql } from '../../../../base/modules/import-kit/src/d1/index.ts'
import type { NativeKey } from './native-keys'
import inventory from '../data/schema-inventory.json'
import { relationshipCheck } from './native-ownership'
type ForeignKey={table:string;from:string;to:string;id:number;seq:number}
export interface NativeDependency {table:string;columns:string[];keys:string[];foreign:ForeignKey[]}
export async function nativeDependencies(db:D1Database):Promise<NativeDependency[]> {
 const tables=Object.entries(inventory).filter(([,v])=>v.classification==='product' ).map(([table])=>table)
 const result=await db.batch([db.prepare('SELECT names.value native_table,p.* FROM json_each(?) names,pragma_table_info(names.value) p').bind(JSON.stringify(tables)),db.prepare('SELECT names.value native_table,p.* FROM json_each(?) names,pragma_foreign_key_list(names.value) p').bind(JSON.stringify(tables))])
 const value=tables.map(table=>{const columns=(result[0].results as {native_table:string;name:string;pk:number}[]).filter(row=>row.native_table===table);return {table,columns:columns.map(c=>c.name),keys:columns.filter(c=>c.pk).sort((a,b)=>a.pk-b.pk).map(c=>c.name),foreign:(result[1].results as (ForeignKey&{native_table:string})[]).filter(row=>row.native_table===table)}})
 return value
}
// Imported relations in the same job are reversed together. Every other native
// dependency, including later follows/publications, fences removal of its parent.
export function relationshipFence(key:NativeKey,revision:string,namespace:string,kind:string,id:string,dependencies:NativeDependency[]):D1Sql {
 const scope:D1Sql={sql:`WITH parent AS MATERIALIZED (SELECT p.job_id FROM ik_provenance p JOIN feedback_import_records r ON r.target_kind=p.target_kind AND r.target_id=p.target_id WHERE p.target_kind=? AND p.target_id=? AND p.reversed=0 AND json_extract(p.record_json,'$.appliedRevision')=? AND r.revision=? AND r.namespace=?) SELECT job_id FROM parent UNION SELECT sibling.job_id FROM parent JOIN ik_d1_stream_pages own ON own.job_id=parent.job_id JOIN ik_d1_stream_pages sibling ON sibling.stream_id=own.stream_id`,params:[kind,id,revision,revision,namespace]}
 const values:string[]=[]
 const check=relationshipCheck(key.table,column=>{if(!(column in key.keys))throw new Error('IMPORT_NATIVE_RELATION_KEY');values.push(column);return '?'},scope,namespace,dependencies)
 return {sql:check.ctes.length?`WITH ${check.ctes.join(',')} SELECT ${check.sql}`:check.sql,params:[...check.params??[],...values.map(column=>key.keys[column])]}
}
export function voteProjection(root:string):D1Sql[] {
 const roots='SELECT origin_id FROM request_canonical_roots WHERE canonical_id=(SELECT canonical_id FROM request_canonical_roots WHERE origin_id=?)'
 return [
  {sql:`DELETE FROM request_votes WHERE request_id IN (${roots})`,params:[root]},
  {sql:`INSERT INTO request_votes(request_id,requester_id,created_at,updated_at) SELECT r.canonical_id,c.requester_id,MIN(c.created_at),MAX(c.updated_at) FROM request_vote_contributions c JOIN requests origin ON origin.id=c.request_id AND origin.withdrawn_at IS NULL JOIN request_canonical_roots r ON r.origin_id=c.request_id WHERE c.request_id IN (${roots}) GROUP BY r.canonical_id,c.requester_id`,params:[root]},
 ]
}
