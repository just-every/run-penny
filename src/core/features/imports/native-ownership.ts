import {roadmapCustodyCheck} from './status-roadmap'
import type { D1Sql } from '../../../../base/modules/import-kit/src/d1/index'
import { quote } from './native-keys'
import type { NativeDependency } from './native-relations'

/** Materialize custody once, independently of the dependent native rows. The
 * decoded key columns retain composite/NULL identities for the anti-join,
 * rather than re-reading and decoding every receipt for every native row. */
export function relationshipCheck(table:string,parent:(column:string)=>string,scope:D1Sql,namespace:string,dependencies:NativeDependency[]):D1Sql&{ctes:string[]} {
 const roadmap=roadmapCustodyCheck(table,parent)
 const relations:string[]=roadmap?[roadmap]:[],tables=new Map<string,NativeDependency>()
 for(const dependency of dependencies){
  // The status clock is read-only derived state, cascaded with its request.
  // Native request values and mapping relationships retain the reversal fence.
  if(['request_votes','request_follows','penny_triage_status_clock'].includes(dependency.table))continue // derived projections; contributions own custody
  const groups=new Map<number,NativeDependency['foreign']>()
  for(const fk of dependency.foreign.filter(fk=>fk.table===table))groups.set(fk.id,[...(groups.get(fk.id)??[]),fk])
  for(const foreign of groups.values()){
   tables.set(dependency.table,dependency)
   const keys=dependencyKeys(dependency)
   relations.push(`NOT EXISTS(SELECT 1 FROM ${quote(dependency.table)} d LEFT JOIN ${quote('owned_'+dependency.table)} o ON ${keys.map((key,index)=>`o.k${index} IS d.${quote(key)}`).join(' AND ')} WHERE ${foreign.map(fk=>`d.${quote(fk.from)} IS ${parent(fk.to)}`).join(' AND ')} AND o.present IS NULL)`)
  }
 }
 if(!relations.length)return {sql:'1',params:[],ctes:[]}
 const custody=`owned_rows AS MATERIALIZED (SELECT json_extract(r.value,'$.table') native_table,json_extract(r.value,'$.keys') native_keys FROM (${scope.sql}) scope JOIN ik_provenance p ON p.job_id=scope.job_id AND p.reversed=0 JOIN feedback_import_records child ON child.target_kind=p.target_kind AND child.target_id=p.target_id AND child.namespace=? AND child.revision=json_extract(p.record_json,'$.appliedRevision') AND child.source_id=json_extract(p.record_json,'$.sourceId') AND child.artifact_hash=json_extract(p.record_json,'$.artifactHash') AND child.source_hash=json_extract(p.record_json,'$.sourceHash'),json_each(child.row_keys_json) r)`
 const indexes=[...tables.values()].map(dependency=>`${quote('owned_'+dependency.table)} AS MATERIALIZED (SELECT ${dependencyKeys(dependency).map((key,index)=>`json_extract(native_keys,'$.${key}') k${index}`).join(',')},1 present FROM owned_rows WHERE native_table='${dependency.table}')`)
 return {ctes:[custody,...indexes],sql:conjunction(relations),params:[...scope.params??[],namespace]}
}
function dependencyKeys(dependency:NativeDependency):string[]{
 if(dependency.keys.length)return dependency.keys
 if(dependency.table==='request_merge_comment_transfers')return ['merge_id','comment_id']
 return dependency.columns
}

function conjunction(parts:string[]):string {
 if(parts.length===1)return parts[0]
 const middle=Math.floor(parts.length/2)
 return `(${conjunction(parts.slice(0,middle))} AND ${conjunction(parts.slice(middle))})`
}
