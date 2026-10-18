import {MutationError} from '@/core/app/operator-mutations'
import {createUlid} from '@/core/shared/ulid'
import {audit} from '../decisions/write-support'
import {markDependencyRisks} from './risk'
import type {Planning,PlanningItem,ReleasePlan} from './types'
export async function readPlanning(db:D1Database,today:string):Promise<Planning>{
 const result=await db.batch([
  db.prepare(`SELECT r.id,r.title,r.status,r.target_window AS targetWindow,p.public_eta AS publicEta FROM roadmap_items r LEFT JOIN roadmap_publications p ON p.roadmap_item_id=r.id AND p.approved_at IS NOT NULL AND p.withdrawn_at IS NULL ORDER BY r.title,r.id`),
  db.prepare('SELECT id,name,release_date AS releaseDate,revision FROM penny_release_plans ORDER BY release_date,name,id'),
  db.prepare('SELECT plan_id AS planId,roadmap_item_id AS itemId FROM penny_release_plan_items ORDER BY plan_id,roadmap_item_id'),
  db.prepare('SELECT blocker_id AS blockerId,dependent_id AS dependentId FROM penny_roadmap_dependencies ORDER BY blocker_id,dependent_id'),
 ])
 const links=result[2].results as {planId:string;itemId:string}[],edges=result[3].results as {blockerId:string;dependentId:string}[]
 const plans=(result[1].results as unknown as ReleasePlan[]).map(p=>({...p,itemIds:links.filter(l=>l.planId===p.id).map(l=>l.itemId)}))
 const items=(result[0].results as unknown as PlanningItem[]).map(item=>({...item,blockers:edges.filter(e=>e.dependentId===item.id).map(e=>e.blockerId),dependents:edges.filter(e=>e.blockerId===item.id).map(e=>e.dependentId),risks:[]}))
 markDependencyRisks(items,plans,today)
 return {items,plans,today}
}
export async function savePlan(db:D1Database,id:string|null,input:{name:string;releaseDate:string;itemIds:string[];revision?:number},actor:string,now:string){
 const key=id??createUlid(),ids=[...new Set(input.itemIds)]
 if(id){
  const current=await db.prepare('SELECT revision FROM penny_release_plans WHERE id=?').bind(id).first<{revision:number}>()
  if(!current)throw new MutationError(404,'Release plan not found.')
  if(current.revision!==input.revision)throw new MutationError(409,'The plan changed. Reload before saving.')
 }
 try{await db.batch([
  db.prepare(`SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM json_each(?) s WHERE NOT EXISTS(SELECT 1 FROM roadmap_items WHERE id=s.value)) THEN 1 ELSE json('planning_missing_item') END`).bind(JSON.stringify(ids)),
  ...(id?[db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM penny_release_plans WHERE id=? AND revision=?) THEN 1 ELSE json('planning_stale_revision') END").bind(id,input.revision??0)]:[]),
  id?db.prepare('UPDATE penny_release_plans SET name=?,release_date=?,revision=revision+1,updated_at=? WHERE id=?').bind(input.name,input.releaseDate,now,id):db.prepare('INSERT INTO penny_release_plans(id,name,release_date,created_at,updated_at) VALUES(?,?,?,?,?)').bind(key,input.name,input.releaseDate,now,now),
  db.prepare('DELETE FROM penny_release_plan_items WHERE plan_id=?').bind(key),
  ...ids.map(item=>db.prepare('INSERT INTO penny_release_plan_items(plan_id,roadmap_item_id) VALUES(?,?)').bind(key,item)),
  audit(db,actor,'release_plan',key,id?'release_plan.updated':'release_plan.created',now),
 ])}catch(error){if(String(error).includes('planning_stale_revision'))throw new MutationError(409,'The plan changed. Reload before saving.');if(String(error).includes('planning_missing_item'))throw new MutationError(404,'A selected roadmap item no longer exists.');throw error}
 return {id:key}
}
export async function setDependency(db:D1Database,blocker:string,dependent:string,linked:boolean,actor:string,now:string){
 if(blocker===dependent)throw new MutationError(422,'An item cannot block itself.')
 try{await db.batch([
  db.prepare("SELECT CASE WHEN (SELECT count(*) FROM roadmap_items WHERE id IN (?,?))=2 THEN 1 ELSE json('planning_missing_item') END").bind(blocker,dependent),
  linked?db.prepare('INSERT OR IGNORE INTO penny_roadmap_dependencies(blocker_id,dependent_id,created_at) VALUES(?,?,?)').bind(blocker,dependent,now):db.prepare('DELETE FROM penny_roadmap_dependencies WHERE blocker_id=? AND dependent_id=?').bind(blocker,dependent),
  audit(db,actor,'roadmap_item',dependent,linked?'roadmap_dependency.linked':'roadmap_dependency.unlinked',now),
 ])}catch(error){if(String(error).includes('planning_dependency_cycle'))throw new MutationError(409,'This dependency would create a cycle.');if(String(error).includes('planning_missing_item'))throw new MutationError(404,'Roadmap item not found.');throw error}
}
