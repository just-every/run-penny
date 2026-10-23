import type {ListEntity} from './list-query'
export interface ListOption {id:string;name:string}
export interface ListFilterOptions {owners:ListOption[];customFields:ListOption[];products:ListOption[];components:ListOption[]}
/** Names come from the same admitted read transaction as the filtered list. */
export async function listFilterOptions(db:D1Database,entity:ListEntity):Promise<ListFilterOptions|undefined>{
 if(!['requests','evidence','roadmap'].includes(entity))return undefined
 const [owners,fields]=await db.batch<ListOption>([
  db.prepare("SELECT p.id,p.display_name AS name FROM operators p JOIN oa_operators n ON lower(n.email)=lower(p.email) WHERE n.status='active' ORDER BY p.display_name,p.id"),
  db.prepare('SELECT id,name FROM custom_field_definitions WHERE entity_type=? ORDER BY name,id').bind(entity==='requests'?'request':entity==='evidence'?'evidence':'roadmapItem'),
 ])
 if(entity!=='roadmap')return {owners:owners.results,customFields:fields.results,products:[],components:[]}
 const [products,components]=await db.batch<ListOption>([
  db.prepare('SELECT id,name FROM penny_products ORDER BY name,id'),
  db.prepare('SELECT c.id,p.name || \' / \' || c.name AS name FROM penny_components c JOIN penny_products p ON p.id=c.product_id ORDER BY p.name,c.name,c.id'),
 ])
 return {owners:owners.results,customFields:fields.results,products:products.results,components:components.results}
}
