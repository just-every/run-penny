import {MutationError} from '@/core/app/operator-mutations'
import {createUlid} from '@/core/shared/ulid'
import {audit} from '../decisions/write-support'
import type {Hierarchy,Feature} from './types'

export async function readHierarchy(db:D1Database):Promise<Hierarchy>{
 const results=await db.batch([
  db.prepare('SELECT id,name FROM penny_products ORDER BY name,id'),
  db.prepare('SELECT id,name,product_id AS productId FROM penny_components ORDER BY name,id'),
  db.prepare('SELECT id,name,component_id AS componentId FROM penny_features ORDER BY name,id'),
  db.prepare('SELECT r.id,r.slug,r.title,l.feature_id AS featureId FROM requests r LEFT JOIN penny_feature_requests l ON l.request_id=r.id WHERE r.merged_into_request_id IS NULL AND r.withdrawn_at IS NULL ORDER BY r.title,r.id'),
  db.prepare('SELECT r.id,r.title,l.feature_id AS featureId FROM roadmap_items r LEFT JOIN penny_feature_roadmap l ON l.roadmap_item_id=r.id ORDER BY r.title,r.id'),
  db.prepare(`WITH feature_people AS (
   SELECT DISTINCT l.feature_id,v.requester_id FROM penny_feature_requests l JOIN requests r ON r.id=l.request_id JOIN request_votes v ON v.request_id=r.id JOIN requesters p ON p.id=v.requester_id
   WHERE r.merged_into_request_id IS NULL AND r.withdrawn_at IS NULL AND p.blocked_at IS NULL
  ), feature_evidence AS (
   SELECT DISTINCT l.feature_id,e.id,e.account_id FROM penny_feature_requests l JOIN requests r ON r.id=l.request_id JOIN request_evidence_links link ON link.request_id=r.id JOIN evidence_items e ON e.id=link.evidence_id WHERE r.merged_into_request_id IS NULL AND r.withdrawn_at IS NULL
  ), feature_accounts AS (
   SELECT p.feature_id,a.account_id FROM feature_people p JOIN requester_account_links a ON a.requester_id=p.requester_id
   UNION SELECT feature_id,account_id FROM feature_evidence WHERE account_id IS NOT NULL
  ) SELECT f.id,
   (SELECT count(*) FROM feature_people WHERE feature_id=f.id) AS voters,
   (SELECT count(*) FROM feature_evidence WHERE feature_id=f.id) AS evidence,
   (SELECT count(*) FROM feature_accounts WHERE feature_id=f.id) AS accounts,
   (SELECT sum(a.revenue_cents) FROM feature_accounts fa JOIN accounts a ON a.id=fa.account_id WHERE fa.feature_id=f.id) AS revenueCents FROM penny_features f`),
 ])
 const [products,components,features,requests,roadmap,demands]=results.map(r=>r.results) as unknown as [Hierarchy['products'],Hierarchy['components'],{id:string;name:string;componentId:string}[],(Hierarchy['requests'][number]&{featureId:string|null})[],(Hierarchy['roadmap'][number]&{featureId:string|null})[],(Feature['demand']&{id:string})[]]
 return {products,components,requests,roadmap,features:features.map(f=>({...f,requests:requests.filter(r=>r.featureId===f.id).map(({id,slug,title})=>({id,slug,title})),roadmap:roadmap.filter(r=>r.featureId===f.id).map(({id,title})=>({id,title})),demand:demands.find(d=>d.id===f.id)!}))}
}
const tables={product:'penny_products',component:'penny_components',feature:'penny_features'} as const
export type Kind=keyof typeof tables
export async function saveHierarchy(db:D1Database,kind:Kind,id:string|null,input:{name:string;parentId?:string},actor:string,now:string){
 const table=tables[kind],parent=kind==='component'?'product_id':kind==='feature'?'component_id':null
 if(parent&&!input.parentId)throw new MutationError(400,'Choose a parent.')
 if(parent&&!await db.prepare(`SELECT id FROM ${kind==='component'?tables.product:tables.component} WHERE id=?`).bind(input.parentId!).first())throw new MutationError(404,'Parent not found.')
 if(id&&!await db.prepare(`SELECT id FROM ${table} WHERE id=?`).bind(id).first())throw new MutationError(404,'Record not found.')
 const key=id??createUlid()
 const statement=id?db.prepare(`UPDATE ${table} SET name=?,${parent?`${parent}=?,`:''}updated_at=? WHERE id=?`).bind(input.name,...(parent?[input.parentId!]:[]),now,key):db.prepare(`INSERT INTO ${table}(id,name,${parent?`${parent},`:''}created_at,updated_at) VALUES(?,?,${parent?'?,':''}?,?)`).bind(key,input.name,...(parent?[input.parentId!]:[]),now,now)
 await db.batch([statement,audit(db,actor,kind,key,`${kind}.${id?'updated':'created'}`,now)])
 return {id:key}
}
export async function linkFeature(db:D1Database,id:string,kind:'request'|'roadmap',targetId:string,linked:boolean,actor:string,now:string){
 if(!await db.prepare('SELECT id FROM penny_features WHERE id=?').bind(id).first())throw new MutationError(404,'Feature not found.')
 const table=kind==='request'?'penny_feature_requests':'penny_feature_roadmap',column=kind==='request'?'request_id':'roadmap_item_id',target=kind==='request'?'requests':'roadmap_items'
 if(!await db.prepare(`SELECT id FROM ${target} WHERE id=?`).bind(targetId).first())throw new MutationError(404,'Target not found.')
 await db.batch([
  linked?db.prepare(`INSERT INTO ${table}(${column},feature_id,created_at) VALUES(?,?,?) ON CONFLICT(${column}) DO UPDATE SET feature_id=excluded.feature_id`).bind(targetId,id,now):db.prepare(`DELETE FROM ${table} WHERE ${column}=? AND feature_id=?`).bind(targetId,id),
  audit(db,actor,'feature',id,`feature.${kind}.${linked?'linked':'unlinked'}`,now),
 ])
}
