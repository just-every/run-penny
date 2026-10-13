import {jobPlans} from './receipt-read'
import type {Row} from '../data/archive'
import {NativeError} from '../auth/native-tokens'
import {targetIdentity} from '../../../../base/modules/import-kit/src/d1/erasure-index'
import {Buffer} from 'node:buffer'
/** Preserve the existing private-copy hold for excluded retained plan text.
 * Unrelated jobs return only keys; affected pages are inspected one at a time. */
export async function importCopyHolds(db:D1Database,records:Row[],literals:Set<string>):Promise<{table:string;key:string;columns:string[]}[]> {
 if(!literals.size)return []
 const targets=records.map(row=>targetIdentity('penny-feedback',String(row.target_kind),String(row.target_id))),jobs:string[]=[],identities=new Set<string>()
 for(let start=0;start<targets.length;start+=250){const result=await db.prepare('SELECT DISTINCT job_id,source_identity FROM ik_d1_plan_index WHERE target_identity IN (SELECT value FROM json_each(?))').bind(JSON.stringify(targets.slice(start,start+250))).all<{job_id:string;source_identity:string}>();jobs.push(...result.results.map(row=>row.job_id));for(const row of result.results)identities.add(row.source_identity)}
 const bundles=(await db.prepare('SELECT DISTINCT stream_id FROM ik_d1_stream_pages WHERE job_id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(jobs)).all<{stream_id:string}>()).results.map(row=>row.stream_id)
 // Legacy mapper inputs contain base64 copies. Test complete base64 quanta
 // for each possible source-byte alignment, including a chunk boundary. The
 // same literal-copy hold applies before either native or import deletion.
 const values=[...literals].flatMap(value=>[value,JSON.stringify(value).slice(1,-1)]),encoded=values.flatMap(value=>{
  const bytes=Buffer.from(value);if(bytes.length<12)return []
  return [0,1,2].map(offset=>bytes.subarray(offset,offset+Math.min(48,Math.floor((bytes.length-offset)/3)*3)).toString('base64'))
 }),blocked:{table:string;key:string;columns:string[]}[]=[]
 for(const [table,column,key] of [['ik_jobs','plan_json','id'],['ik_d1_plan_chunks','body','job_id'],['ik_d1_creation_plans','body','job_id'],['ik_provenance','record_json','job_id'],['ik_d1_history','record_json','job_id'],['ik_originals','name','job_id'],['feedback_import_bundles','receipt_json','id'],['feedback_import_bundles','originals_json','id']]){
  for(let start=0;start<values.length;start+=100){
   const rows=await db.prepare(`SELECT DISTINCT "${key}" id FROM "${table}" WHERE "${key}" NOT IN (SELECT value FROM json_each(?)) AND EXISTS(SELECT 1 FROM json_each(?) literals WHERE instr("${column}",literals.value)>0) LIMIT 101`).bind(JSON.stringify(table==='feedback_import_bundles'?bundles:jobs),JSON.stringify(values.slice(start,start+100))).all<{id:string}>()
   if(rows.results.length>100)throw new NativeError('Erasure has more than 100 retained-history copy holds; no records were removed.',413)
   for(const row of rows.results)if(!blocked.some(item=>item.table===table&&item.key===row.id))blocked.push({table,key:row.id,columns:[column]})
  }
 }
 for(const [table,column,key]of [['ik_jobs','plan_json','id'],['ik_d1_plan_chunks','body','job_id'],['ik_d1_creation_plans','body','job_id']]){
  for(let start=0;start<encoded.length;start+=100){
   const text=table==='ik_jobs'?`source."${column}"`:`source."${column}"||COALESCE((SELECT substr(next.body,1,64) FROM "${table}" next WHERE next.job_id=source.job_id AND next.ordinal=source.ordinal+1),'')`
   const rows=await db.prepare(`SELECT DISTINCT source."${key}" id FROM "${table}" source WHERE source."${key}" NOT IN (SELECT value FROM json_each(?)) AND EXISTS(SELECT 1 FROM json_each(?) literals WHERE instr(${text},literals.value)>0) LIMIT 101`).bind(JSON.stringify(jobs),JSON.stringify(encoded.slice(start,start+100))).all<{id:string}>()
   if(rows.results.length>100)throw new NativeError('Erasure has more than 100 retained-history copy holds; no records were removed.',413)
   for(const row of rows.results)if(!blocked.some(item=>item.table===table&&item.key===row.id))blocked.push({table,key:row.id,columns:[column]})
  }
 }
 // A large stored page is compressed, so the literal checks above cannot see
 // inside it: decode those too. Otherwise a person's unapplied entries in a paged
 // import that is still applying would not hold the erasure, and would fail later.
 const compressed=(await db.prepare(`SELECT j.id FROM ik_jobs j LEFT JOIN ik_d1_plan_chunks c ON c.job_id=j.id AND c.ordinal=0 WHERE j.destination='penny-feedback' AND instr(substr(CASE WHEN json_extract(j.plan_json,'$.d1Plan')=1 THEN c.body ELSE j.plan_json END,1,200),'"d1Plan":')>0`).all<{id:string}>()).results.map(row=>row.id)
 // A selected page may also hold unrelated source rows. They are not erased
 // by the target protocol, so preserve the copy hold at entry granularity.
 for(const job of new Set([...jobs,...compressed]))for await(const {plan} of jobPlans(job,db,false))for(const entry of plan.entries){
  if(identities.has(entry.identity))continue
  const body=JSON.stringify({sourceId:entry.source.sourceId,payload:entry.source.payload,effects:entry.effects,unmapped:entry.unmapped})
  if(values.some(value=>body.includes(value)))blocked.push({table:'ik_jobs',key:job+':'+entry.identity,columns:['retained source entry']})
 }
 return blocked
}
