import {token} from './secrets'
import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError} from '../auth/native-tokens'
import {wire,publicListing,type Connection} from './configuration'
const review=z.object({id:z.string().min(1).max(300),author:z.string().max(200).nullable(),rating:z.number().min(0).max(100).nullable(),title:z.string().max(1000).nullable(),text:z.string().min(1).max(20000),date:z.string().datetime({offset:true}),version:z.string().max(100).nullable(),country:z.string().max(100).nullable(),url:z.string().url().max(2000)})
export type Review=z.infer<typeof review>
const nullable=(v:unknown)=>typeof v==='string'&&v.trim()?v:null
const numeric=(v:unknown)=>v===null||v===undefined?null:Number(v)
function date(v:unknown){const d=new Date(typeof v==='number'?v:String(v));if(!Number.isFinite(d.getTime()))throw new NativeError('reviews_date_invalid',503);return d.toISOString()}
export function validateReview(c:Connection,value:unknown):Review{
 let r:Review;try{r=review.parse(value)}catch{throw new NativeError('reviews_payload_invalid',503)}
 const u=new URL(r.url),allowed:Record<string,string[]>= {g2:['www.g2.com'],capterra:['www.capterra.com','www.capterra.co.uk'],trustradius:['www.trustradius.com'],trustpilot:['www.trustpilot.com'],producthunt:['www.producthunt.com'],appstore:['apps.apple.com'],googleplay:['play.google.com']}
 if(u.protocol!=='https:'||u.username||u.password||u.port||!allowed[c.site].includes(u.hostname))throw new NativeError('reviews_link_invalid',503)
 return r
}
function json(text:string):any {try{return JSON.parse(text)}catch{throw new NativeError('reviews_payload_invalid',503)}}
export function pageCursor(c:Connection,url:string|null):string|null {
 if(!url)return null
 const parsed=new URL(url),base=new URL(endpoint(c))
 if(parsed.origin!==base.origin||parsed.pathname!==base.pathname||parsed.username||parsed.password||parsed.hash||url.length>2000)throw new NativeError('reviews_cursor_invalid',503)
 const pagination=['page','page[number]','pageToken','cursor','after']
 for(const k of parsed.searchParams.keys())if(parsed.searchParams.getAll(k).length!==1||!base.searchParams.has(k)&&!pagination.includes(k))throw new NativeError('reviews_cursor_scope_invalid',503)
 // Only pagination fields may change. A provider cannot move the configured scope.
 for(const [k,v] of base.searchParams)if(!['page','page[number]','pageToken','cursor','after'].includes(k)&&parsed.searchParams.get(k)!==v)throw new NativeError('reviews_cursor_scope_invalid',503)
 return parsed.href
}
export function endpoint(c:Connection){const id=encodeURIComponent(c.listing)
 switch(c.site){
 case 'g2':return `https://data.g2.com/api/v1/survey-responses?filter[product_id]=${id}&page[size]=50`
 case 'trustpilot':return `https://api.trustpilot.com/v1/private/business-units/${id}/reviews?perPage=50&page=1`
 case 'appstore':return `https://api.appstoreconnect.apple.com/v1/apps/${id}/customerReviews?limit=50`
 case 'googleplay':return `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${id}/reviews?maxResults=50`
 case 'producthunt':return 'https://api.producthunt.com/v2/api/graphql'
 default:return publicListing(c.site,c.public_url)
 }
}
const phQuery=`query Reviews($id: ID!, $after: String) { post(id: $id) { id comments(first: 50, after: $after) { edges { node { id body createdAt url user { name } } } pageInfo { hasNextPage endCursor } } } }`
export async function readPage(runtime:PennyRuntime,c:Connection):Promise<{reviews:Review[];next:string|null}>{
 const publicPage=['capterra','trustradius'].includes(c.site),key=publicPage?undefined:await token(runtime,c)
 if(!publicPage&&!key)throw new NativeError('reviews_credentials_missing',503)
 const response=await wire(runtime,c.site==='producthunt'?endpoint(c):(c.cursor?pageCursor(c,c.cursor)!:endpoint(c)),key,c.site==='producthunt'?JSON.stringify({query:phQuery,variables:{id:c.listing,after:c.cursor}}):'')
 if(response.status!==200)throw new NativeError(response.status===429?'reviews_rate_limited':response.status===401||response.status===403?'reviews_access_revoked':[404,410].includes(response.status)?'reviews_listing_removed':'reviews_provider_failed',503)
 if(publicPage){
  if(!c.terms_accepted)throw new NativeError('reviews_terms_required',409)
  const scripts=[...response.body.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  if(!scripts.length)throw new NativeError('reviews_public_markup_unavailable',503)
  const nodes:any[]=[];let selected=false
  function visit(v:any){
   if(Array.isArray(v))v.forEach(visit)
   else if(v&&typeof v==='object'){
    const types=Array.isArray(v['@type'])?v['@type']:[v['@type']]
    if(types.some((t:string)=>['Product','SoftwareApplication'].includes(t))&&[v.url,v['@id']].includes(c.public_url)){selected=true;for(const r of Array.isArray(v.review)?v.review:v.review?[v.review]:[])if(r['@type']==='Review')nodes.push(r)}
    if(v['@graph'])visit(v['@graph'])
   }
  }
  scripts.forEach(s=>visit(json(s[1])))
  if(!selected)throw new NativeError('reviews_public_listing_mismatch',503)
  const nextTag=[...response.body.matchAll(/<link\b[^>]*>/gi)].find(m=>/rel=["']next["']/i.test(m[0]))?.[0],href=nextTag?.match(/href=["']([^"']+)["']/i)?.[1]
  let cursor:string|null=null
  if(href){const u=new URL(href.replaceAll('&amp;','&'),c.public_url!);if([...u.searchParams.keys()].some(k=>k!=='page'))throw new NativeError('reviews_cursor_invalid',503);cursor=pageCursor(c,u.href)}
  // Store selected review fields only, never the page or neighboring products.
  return {reviews:nodes.map(v=>validateReview(c,{id:v.identifier??v['@id']??v.url,author:nullable(v.author?.name),rating:numeric(v.reviewRating?.ratingValue),title:nullable(v.name),text:v.reviewBody,date:date(v.datePublished),version:nullable(v.softwareVersion),country:nullable(v.contentLocation?.name),url:v.url??v['@id']})),next:cursor}
 }
 const data=json(response.body)
 let values:any[],cursor:string|null=null
 switch(c.site){
 case 'appstore':values=z.array(z.any()).parse(data.data);cursor=pageCursor(c,data.links?.next??null);return {reviews:values.map(v=>{if(v.type!=='customerReviews')throw new NativeError('reviews_payload_invalid',503);const a=v.attributes;return validateReview(c,{id:v.id,author:nullable(a.reviewerNickname),rating:numeric(a.rating),title:nullable(a.title),text:a.body,date:date(a.createdDate),version:nullable(a.appVersionString),country:nullable(a.territory),url:`https://apps.apple.com/app/id${c.listing}?see-all=reviews&reviewId=${encodeURIComponent(v.id)}`})}),next:cursor}
 case 'googleplay':values=z.array(z.any()).parse(data.reviews??[]);cursor=data.tokenPagination?.nextPageToken?endpoint(c)+'&pageToken='+encodeURIComponent(data.tokenPagination.nextPageToken):null;return {reviews:values.map(v=>{const a=v.comments?.find((x:any)=>x.userComment)?.userComment;if(!a)throw new NativeError('reviews_payload_invalid',503);return validateReview(c,{id:v.reviewId,author:nullable(v.authorName),rating:numeric(a.starRating),title:null,text:a.text,date:date(Number(a.lastModified.seconds)*1000),version:nullable(a.appVersionName),country:nullable(a.country),url:`https://play.google.com/store/apps/details?id=${encodeURIComponent(c.listing)}&reviewId=${encodeURIComponent(v.reviewId)}`})}),next:cursor}
 case 'trustpilot':values=z.array(z.any()).parse(data.reviews);cursor=values.length===50?(()=>{const u=new URL(c.cursor??endpoint(c));u.searchParams.set('page',String(Number(u.searchParams.get('page')??1)+1));return u.href})():null;return {reviews:values.map(v=>validateReview(c,{id:v.id,author:nullable(v.consumer?.displayName),rating:numeric(v.stars),title:nullable(v.title),text:v.text,date:date(v.createdAt),version:null,country:nullable(v.consumer?.country),url:`https://www.trustpilot.com/reviews/${encodeURIComponent(v.id)}`})),next:cursor}
 case 'g2':values=z.array(z.any()).parse(data.data);cursor=pageCursor(c,data.links?.next??null);return {reviews:values.map(v=>{const a=v.attributes;return validateReview(c,{id:v.id,author:nullable(a.reviewer?.name),rating:numeric(a.star_rating),title:nullable(a.title),text:a.comment_answers?Object.values(a.comment_answers).filter(x=>typeof x==='string').join('\n\n'):a.body,date:date(a.submitted_at),version:nullable(a.product_version),country:nullable(a.country),url:a.url})}),next:cursor}
 case 'producthunt':if(data.errors?.length||!data.data?.post||String(data.data.post.id)!==c.listing)throw new NativeError('reviews_listing_unavailable',503);values=z.array(z.any()).parse(data.data.post.comments.edges);cursor=data.data.post.comments.pageInfo.hasNextPage?z.string().min(1).max(1000).parse(data.data.post.comments.pageInfo.endCursor):null;return {reviews:values.map(({node:v})=>validateReview(c,{id:v.id,author:nullable(v.user?.name),rating:null,title:null,text:v.body,date:date(v.createdAt),version:null,country:null,url:v.url})),next:cursor}
 }
 throw new NativeError('reviews_site_invalid',503)
}
export async function sourcePresent(runtime:PennyRuntime,c:Connection,id:string,url:string){
 const i=encodeURIComponent(id)
 let target=url
 if(c.site==='appstore')target=`https://api.appstoreconnect.apple.com/v1/customerReviews/${i}`
 if(c.site==='googleplay')target=`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(c.listing)}/reviews/${i}`
 if(c.site==='trustpilot')target=`https://api.trustpilot.com/v1/reviews/${i}`
 if(c.site==='g2')target=`https://data.g2.com/api/v1/survey-responses/${i}`
 // Public page checks carry no credential. A successful page alone is not deletion evidence.
 const r=await wire(runtime,target,target===url?undefined:await token(runtime,c))
 if([401,403,404,410].includes(r.status))return false
 if(r.status!==200)throw new NativeError(r.status===429?'reviews_rate_limited':'reviews_source_check_failed',503)
 return true
}
