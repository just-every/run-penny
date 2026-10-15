import {InventorySnapshot} from '../../../../base/modules/import-kit/src/d1/inventory-snapshot'
import {readErasureSnapshot} from '../../../../base/modules/import-kit/src/d1/erasure-snapshot'
import {erasureFragments} from '../../../../base/modules/import-kit/src/d1/erasure-fragments'
import {ExpectedState} from '../../../../base/modules/import-kit/src/d1/expected-state'
import {erasePlanRecords} from '../../../../base/modules/import-kit/src/d1/erased-plan'
import {loadPlans,encodePlan,storedPlanSnapshot} from '../../../../base/modules/import-kit/src/d1/plans'
import {originalVersions} from '../../../../base/modules/import-kit/src/d1/original-storage'
import {targetIdentity} from '../../../../base/modules/import-kit/src/d1/erasure-index'
import type {ImportPlan} from '../../../../base/modules/import-kit/src/types'
import type {D1ImportContext} from '../../../../base/modules/import-kit/src/d1/types'
import type {ErasurePage} from '../../../../base/modules/import-kit/src/d1/erasure-pages'

/** Read-only cost projection from Base's maintained transaction edits. This is
 * never a publication snapshot: current rows are reread on the owned resume.
 * Plans carry their exact future stored encoding (a chunk manifest beside its
 * chunks once a plan exceeds one chunk), so a large plan is never projected as
 * one oversized value; maximal revision scalars overestimate header guards. */
export async function projectedSourceSnapshot(id:string,kind:string,target:string,page:ErasurePage,context:D1ImportContext):Promise<InventorySnapshot>{
 const original=await readErasureSnapshot(page,context.storage.database,context.storage.targets.planCodec)
 if(!Object.hasOwn(original.plans.get(id)!.source,'options'))return original
 const matches=(entry:ImportPlan['entries'][number])=>entry.effects.some(effect=>effect.targetKind===kind&&effect.targetId===target)||entry.erasedTargetIdentity===targetIdentity(context.destination,kind,target)
 const affected=page.ids.filter(key=>original.plans.get(key)!.entries.some(matches)),identities=new Set(affected.flatMap(key=>original.plans.get(key)!.entries.filter(matches).map(entry=>entry.identity)))
 const reports=original.rows('ik_jobs','id',page.ids).filter(row=>row.reversal_policy==='preserve-conflicts'&&original.rows('ik_d1_reversal_reports','job_id',[row.id]).length).map(row=>row.id)
 const iterator=erasureFragments({ids:affected,reports,identities,kind,targetId:target},context,[page]),fragment=(await iterator.next()).value
 if(!fragment)throw new Error('FEEDBACK_ERASURE_ADMISSION_SNAPSHOT_MISSING')
 const seed={sql:'SELECT 1',expectedSnapshots:[...original.tables].map(([table,rows])=>({table,rows,columns:[...new Set(rows.flatMap(row=>Object.keys(row)))]}))}
 const expected=new ExpectedState([seed,...fragment.before,...fragment.writes,...fragment.post]),snapshot=new InventorySnapshot()
 for(const table of original.tables.keys())snapshot.tables.set(table,[...expected.rows(table).values()])
 const jobs=original.tables.get('ik_jobs')!.map(raw=>({...raw,...expected.rows('ik_jobs').get(JSON.stringify([raw.id])),custody_revision:Number.MAX_SAFE_INTEGER,state_revision:Number.MAX_SAFE_INTEGER}))
 const chunks=jobs.flatMap(raw=>{
  const previous=original.plans.get(raw.id)!,encoded=affected.includes(raw.id)?encodePlan(erasePlanRecords(previous,identities,context.originalErasurePolicy),raw.id):storedPlanSnapshot(previous,raw.id)
  raw.plan_json=encoded.body;return encoded.chunks
 })
 snapshot.tables.set('ik_jobs',jobs)
 // loadPlans registers its normal exact plan snapshot; its paged chunk reads
 // are answered from the projected chunks above, never from the database.
 const projected={prepare:(query:string)=>({bind:(ids:string)=>({all:async()=>{
  const rows=chunks.filter(row=>JSON.parse(ids).includes(row.job_id)).sort((a,b)=>String(a.job_id).localeCompare(String(b.job_id))||a.ordinal-b.ordinal),page=/LIMIT (\d+) OFFSET (\d+)/.exec(query)
  return {results:page?rows.slice(Number(page[2]),Number(page[2])+Number(page[1])):rows}
 }})})} as unknown as D1ImportContext['storage']['database']
 for(const [key,next]of await loadPlans(jobs,projected)){
  snapshot.plans.set(key,next);originalVersions.set(next,originalVersions.get(original.plans.get(key)!)!)
 }
 snapshot.tables.set('ik_d1_plan_chunks',chunks)
 snapshot.tables.set('ik_d1_creation_plans',[])
 snapshot.tables.set('ik_d1_reversal_reports',snapshot.tables.get('ik_d1_reversal_reports')!.map(row=>({...row,native_reversed:snapshot.tables.get('ik_provenance')!.find(p=>p.id===row.effect_id&&p.job_id===row.job_id)?.reversed??null})))
 return snapshot
}
