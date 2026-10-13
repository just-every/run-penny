import type { DatabaseConnection } from '@/core/platform/database'
import { entitySource, listPredicate } from './list-repository'
import { PAGE_SIZE, type ListEntity, type ListQuery, type OperatorPage } from './list-query'
export interface SearchResult { id: string; entity: ListEntity; title: string; snippet: string; href: string }
interface SearchRow { id: string; slug: string; title: string; snippet: string }
export function recordHref(entity: ListEntity, id: string, slug: string): string {
 const paths: Record<ListEntity,string>={requests:'/app/moderation',evidence:'/app/feedback',decisions:'/app/decisions',roadmap:'/app/roadmap',releases:'/app/releases',accounts:'/app/customers',requesters:'/app/customers'}
 if(['decisions','releases','accounts'].includes(entity))return `${paths[entity]}/${encodeURIComponent(slug)}`
 const hash=entity==='requests'?`request-${slug}`:`${entity}-${id}`
 return `${paths[entity]}?${entity==='requesters'?'directory=requesters&':''}item=${encodeURIComponent(id)}#${encodeURIComponent(hash)}`
}
export async function searchRecords(database: DatabaseConnection,query:ListQuery):Promise<OperatorPage<SearchResult>> {
 const page=query.page??1
 if(!query.q)return {items:[],total:0,page,pageSize:PAGE_SIZE}
 const sources=(Object.keys(entitySource) as ListEntity[]).sort().filter(entity=>!query.entity||query.entity===entity).map(entity=>({
  entity,source:entitySource[entity],predicate:listPredicate(entity,{q:query.q,tag:query.tag}),
 }))
 // D1 restricts compound SELECT terms. Count each entity in one batch, then
 // translate the global entity/title/id order into only this page's SQL ranges.
 const counts=await database.binding.batch<{total:number}>(sources.map(({source,predicate})=>
  database.binding.prepare(`SELECT COUNT(*) AS total FROM ${source.table} x${predicate.sql}`).bind(...predicate.values),
 ))
 let offset=(page-1)*PAGE_SIZE,remaining=PAGE_SIZE,total=0
 const ranges:{entity:ListEntity;statement:D1PreparedStatement}[]=[]
 for(const [index,{entity,source,predicate}] of sources.entries()) {
  const count=Number(counts[index].results[0].total)
  total+=count
  if(offset>=count){offset-=count;continue}
  if(remaining===0)continue
  const limit=Math.min(remaining,count-offset)
  const slug=['requests','decisions','roadmap','releases','accounts'].includes(entity)?'x.slug':'x.id'
  ranges.push({entity,statement:database.binding.prepare(`SELECT x.id,${slug} AS slug,${source.title} AS title,substr(${source.wording},1,240) AS snippet FROM ${source.table} x${predicate.sql} ORDER BY title COLLATE NOCASE,x.id LIMIT ? OFFSET ?`).bind(...predicate.values,limit,offset)})
  remaining-=limit
  offset=0
 }
 const rows=ranges.length?await database.binding.batch<SearchRow>(ranges.map(range=>range.statement)):[]
 return {items:rows.flatMap((result,index)=>result.results.map(row=>({
  ...row,entity:ranges[index].entity,href:recordHref(ranges[index].entity,row.id,row.slug),
 }))),total,page,pageSize:PAGE_SIZE}
}
