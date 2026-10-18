import type { PublicRelease } from '@/core/shared/api/public'
import type { DatabaseConnection } from '@/core/platform/database'
import type { ReleaseRichFields } from './rich-content'
import type { ReleaseFilters } from './rich-repository'

export type CurrentPublicRelease=PublicRelease & ReleaseRichFields & {versionNumber:number;isCurrent:true}
type ReleaseRow=Omit<CurrentPublicRelease,'isCurrent'|'labels'|'products'>&{labelsJson:string;productsJson:string}
const currentReleases=`SELECT r.slug AS slug,rv.version_number AS versionNumber,rv.title AS title,rv.release_type AS releaseType,rv.body AS body,
 rv.publication_date AS publicationDate,rv.setup_url AS setupUrl,rv.author_name AS authorName,
 rv.public_labels_json AS labelsJson,rv.public_products_json AS productsJson FROM releases r
 JOIN release_versions rv ON rv.id=r.current_version_id AND rv.is_portal_current=1
 WHERE r.state='published' AND r.published_at IS NOT NULL AND rv.publication_date IS NOT NULL`
function publicRelease({labelsJson,productsJson,...row}:ReleaseRow):CurrentPublicRelease{
 const publicNames=(value:string)=>(JSON.parse(value) as {id:string;name:string}[]).map(({id,name})=>({id,name}))
 return {...row,labels:publicNames(labelsJson),products:publicNames(productsJson),isCurrent:true}
}
export class PublicReleasesReadRepository {
 private readonly connection:DatabaseConnection
 constructor(connection:DatabaseConnection){this.connection=connection}
 async list(filters:ReleaseFilters={}):Promise<readonly CurrentPublicRelease[]>{
  const conditions:string[]=[],values:string[]=[]
  if(filters.label){conditions.push(`(rv.release_type=? OR EXISTS(SELECT 1 FROM json_each(rv.public_labels_json) label WHERE json_extract(label.value,'$.id')=?))`);values.push(filters.label,filters.label)}
  if(filters.product){conditions.push(`EXISTS(SELECT 1 FROM json_each(rv.public_products_json) product WHERE json_extract(product.value,'$.id')=?)`);values.push(filters.product)}
  const result=await this.connection.binding.prepare(`${currentReleases}${conditions.map(condition=>' AND '+condition).join('')} ORDER BY rv.publication_date DESC,r.slug ASC`).bind(...values).all<ReleaseRow>()
  return result.results.map(publicRelease)
 }
 async find(slug:string):Promise<CurrentPublicRelease|null>{
  const row=await this.connection.binding.prepare(`${currentReleases} AND r.slug=? LIMIT 1`).bind(slug).first<ReleaseRow>()
  return row?publicRelease(row):null
 }
}
