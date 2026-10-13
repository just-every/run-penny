import { targetIdentity } from '../../../../base/modules/import-kit/src/d1/erasure-index'
import type { ImportPlan } from '../../../../base/modules/import-kit/src/d1/index'

/** How many records of a reviewed plan an earlier erasure fenced. Apply refuses such a plan
 * with IMPORT_SOURCE_ERASED, so the preview says so before the operator presses it. */
export async function erasedPlanRecords(db:D1Database,destination:string,plans:Iterable<ImportPlan>):Promise<number> {
 const erased=new Set<string>()
 const ask=async(table:'ik_d1_erased_sources'|'ik_d1_erased_targets',identities:string[])=>{
  for(let start=0;start<identities.length;start+=500){
   const {results}=await db.prepare(`SELECT identity FROM ${table} WHERE destination=? AND identity IN (SELECT value FROM json_each(?))`).bind(destination,JSON.stringify(identities.slice(start,start+500))).all<{identity:string}>()
   for(const row of results)erased.add(row.identity)
  }
 }
 let count=0
 for(const plan of plans){
  const live=plan.entries.filter(entry=>!entry.erased)
  const targets=new Map(live.map(entry=>[entry.identity,entry.effects.map(effect=>targetIdentity(destination,effect.targetKind,effect.targetId))]))
  await ask('ik_d1_erased_sources',live.map(entry=>entry.identity))
  await ask('ik_d1_erased_targets',[...new Set([...targets.values()].flat())])
  for(const [identity,identities] of targets)if(erased.has(identity)||identities.some(item=>erased.has(item)))count++
 }
 return count
}
