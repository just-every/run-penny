export class ListQueryError extends Error {}
export const PAGE_SIZE = 25
export type ListEntity = 'requests' | 'evidence' | 'decisions' | 'roadmap' | 'releases' | 'accounts' | 'requesters'
export interface ListQuery { updatesQ?:string; updatesTag?:string; updatesSort?:string; updatesPage?:number; entity?: ListEntity; q?: string; tag?: string; sort?: string; page?: number; moderation?: string; board?: string; status?: string; decision?: string; account?: string; item?: string; unreviewed?: true; attention?: true; active?: true }
export interface OperatorPage<T> { items: readonly T[]; total: number; page: number; pageSize: number }
const enums: Record<string, readonly string[]> = { moderation: ['awaiting_review','approved','rejected'], status: ['unpublished','open','under_review','planned','in_progress','shipped','declined','withdrawn','exploring','dropped','draft','published','ready','committed','review_due','unreviewed','reviewed','pending'], sort: ['name','recent','age','votes','observed'] }
export function validateListSearch(input: Record<string, unknown>): ListQuery {
 if(input.entity!==undefined && !['requests','evidence','decisions','roadmap','releases','accounts','requesters'].includes(String(input.entity)))throw new ListQueryError('Invalid entity')
 const result: Record<string, string | number | true> = {}
 if(input.entity)result.entity=String(input.entity)
 for(const key of ['updatesQ','updatesTag','updatesSort']) {const value=input[key];if(value===undefined||value==='')continue;if(typeof value!=='string'||value.length>(key==='updatesQ'?200:160)||key==='updatesSort'&&!['name','recent','age'].includes(value))throw new ListQueryError('Invalid status update filter');result[key]=value}
 if(input.updatesPage!==undefined){const page=Number(input.updatesPage);if(!Number.isSafeInteger(page)||page<1||page>10000)throw new ListQueryError('Invalid status update page');result.updatesPage=page}
 for (const key of ['q','tag','sort','moderation','board','status','decision','account','item']) {
  const value = input[key]
  if(value === undefined || value === '') continue
  if(typeof value !== 'string' || value.length > (key === 'q' ? 200 : 160) || (enums[key] && !enums[key].includes(value))) throw new ListQueryError(`Invalid ${key} filter`)
  result[key] = value.trim()
 }
 if(input.page !== undefined) { const page = Number(input.page); if(!Number.isSafeInteger(page) || page < 1 || page > 10000) throw new ListQueryError('Invalid page'); result.page=page }
 for(const key of ['unreviewed','attention','active']) if(input[key] === true || input[key] === 'true') result[key]=true
 return result as ListQuery
}
/** Whether a list address's own query is one validateListSearch refuses. */
export function invalidListQuery(search: Record<string, unknown>): boolean {
 try { validateListSearch(search); return false } catch(error) { if(error instanceof ListQueryError)return true; throw error }
}
export function queryString(query: ListQuery): string { const params=new URLSearchParams(); for(const [key,value] of Object.entries(query)) if(value !== undefined && value !== '') params.set(key,String(value)); return params.size ? `?${params}` : '' }
export function boundedIds(alias: string, ids?: readonly string[]): string { return ids ? ` WHERE ${alias}.id IN (${ids.length ? ids.map(()=>'?').join(',') : 'NULL'})` : '' }
