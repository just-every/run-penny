import {token} from './secrets'
import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError} from '../auth/native-tokens'
import {wire,publicListing,type Connection} from './configuration'
import {reviewLink} from './review-link'
import {sourcePresent} from './source-check'
import {validObservedTime} from '../decisions/write-support'
export {sourcePresent}
const review=z.object({id:z.string().min(1).max(300),author:z.string().max(200).nullable(),rating:z.number().min(0).max(100).nullable(),title:z.string().max(1000).nullable(),text:z.string().min(1).max(20000),date:z.string().datetime({offset:true}),version:z.string().max(100).nullable(),country:z.string().max(100).nullable(),url:z.string().url().max(2000)})
export type Review=z.infer<typeof review>
const nullable=(v:unknown)=>typeof v==='string'&&v.trim()?v:null
const numeric=(v:unknown)=>v===null||v===undefined?null:Number(v)
function date(v:unknown){if(typeof v!=='string'||!validObservedTime(v))throw new NativeError('reviews_date_invalid',503);return v}
function googleDate(v:{seconds:unknown;nanos?:unknown}){
 const seconds=Number(v.seconds),nanos=v.nanos
 if(!Number.isSafeInteger(seconds)||nanos!==undefined&&(!Number.isInteger(nanos)||Number(nanos)<0||Number(nanos)>999999999))throw new NativeError('reviews_date_invalid',503)
 const whole=new Date(seconds*1000).toISOString().replace(/\.000Z$/,'')
 return date(whole+(nanos===undefined?'':'.'+String(nanos).padStart(9,'0'))+'Z')
}
export function validateReview(c:Connection,value:unknown):Review{
 let r:Review;try{r=review.parse(value)}catch{throw new NativeError('reviews_payload_invalid',503)}
 reviewLink(c,r.id,r.url)
 return r
}
function json(text:string):any {try{return JSON.parse(text)}catch{throw new NativeError('reviews_payload_invalid',503)}}
export function pageCursor(c:Connection,url:string|null):string|null {
 if(!url)return null
 const parsed=new URL(url),base=new URL(endpoint(c))
 if(parsed.origin!==base.origin||parsed.pathname!==base.pathname||parsed.username||parsed.password||parsed.hash||url.length>2000)throw new NativeError('reviews_cursor_invalid',503)
 const pagination:Record<string,string[]>={g2:['page[number]'],trustpilot:['page'],appstore:['cursor','offset'],googleplay:['pageToken'],capterra:['page'],trustradius:['page'],producthunt:[]}
 const allowed=pagination[c.site]
 for(const k of parsed.searchParams.keys())if(parsed.searchParams.getAll(k).length!==1||!base.searchParams.has(k)&&!allowed.includes(k))throw new NativeError('reviews_cursor_scope_invalid',503)
 // Only pagination fields may change. A provider cannot move the configured scope.
 for(const [k,v] of base.searchParams)if(!allowed.includes(k)&&parsed.searchParams.get(k)!==v)throw new NativeError('reviews_cursor_scope_invalid',503)
 for(const k of allowed){const v=parsed.searchParams.get(k);if(v!==null&&(!/^[A-Za-z0-9_+/=-]{1,1000}$/.test(v)||['page','page[number]','offset'].includes(k)&&(!/^\d+$/.test(v)||!Number.isSafeInteger(Number(v))||Number(v)<(k==='offset'?0:1))))throw new NativeError('reviews_cursor_invalid',503)}
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
const phQuery=`query Reviews($id: ID!, $after: String) { post(id: $id) { id url comments(first: 50, after: $after) { edges { node { id body createdAt url user { name } } } pageInfo { hasNextPage endCursor } } } }`
export async function readPage(runtime:PennyRuntime,c:Connection):Promise<{reviews:Review[];next:string|null}>{
 const publicPage=['capterra','trustradius'].includes(c.site),key=publicPage?undefined:await token(runtime,c)
 if(c.site==='producthunt'&&c.cursor&&!/^[A-Za-z0-9_+/=-]{1,1000}$/.test(c.cursor))throw new NativeError('reviews_cursor_invalid',503)
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
 case 'googleplay':values=z.array(z.any()).parse(data.reviews??[]);cursor=data.tokenPagination?.nextPageToken?endpoint(c)+'&pageToken='+encodeURIComponent(data.tokenPagination.nextPageToken):null;return {reviews:values.map(v=>{const a=v.comments?.find((x:any)=>x.userComment)?.userComment;if(!a)throw new NativeError('reviews_payload_invalid',503);return validateReview(c,{id:v.reviewId,author:nullable(v.authorName),rating:numeric(a.starRating),title:null,text:a.text,date:googleDate(a.lastModified),version:nullable(a.appVersionName),country:nullable(a.country),url:`https://play.google.com/store/apps/details?id=${encodeURIComponent(c.listing)}&reviewId=${encodeURIComponent(v.reviewId)}`})}),next:cursor}
 case 'trustpilot':values=z.array(z.any()).parse(data.reviews);cursor=values.length===50?(()=>{const u=new URL(c.cursor??endpoint(c));u.searchParams.set('page',String(Number(u.searchParams.get('page')??1)+1));return u.href})():null;return {reviews:values.map(v=>validateReview(c,{id:v.id,author:nullable(v.consumer?.displayName),rating:numeric(v.stars),title:nullable(v.title),text:v.text,date:date(v.createdAt),version:null,country:nullable(v.consumer?.country),url:`https://www.trustpilot.com/reviews/${encodeURIComponent(v.id)}`})),next:cursor}
 case 'g2':values=z.array(z.any()).parse(data.data);cursor=pageCursor(c,data.links?.next??null);return {reviews:values.map(v=>{const a=v.attributes;return validateReview(c,{id:v.id,author:nullable(a.reviewer?.name),rating:numeric(a.star_rating),title:nullable(a.title),text:a.comment_answers?Object.values(a.comment_answers).filter(x=>typeof x==='string').join('\n\n'):a.body,date:date(a.submitted_at),version:nullable(a.product_version),country:nullable(a.country),url:a.url})}),next:cursor}
 case 'producthunt':if(data.errors?.length||!data.data?.post||String(data.data.post.id)!==c.listing||data.data.post.url!==c.public_url)throw new NativeError('reviews_listing_unavailable',503);values=z.array(z.any()).parse(data.data.post.comments.edges);cursor=data.data.post.comments.pageInfo.hasNextPage?z.string().regex(/^[A-Za-z0-9_+/=-]{1,1000}$/).parse(data.data.post.comments.pageInfo.endCursor):null;return {reviews:values.map(({node:v})=>validateReview(c,{id:v.id,author:nullable(v.user?.name),rating:null,title:null,text:v.body,date:date(v.createdAt),version:null,country:null,url:v.url})),next:cursor}
 }
 throw new NativeError('reviews_site_invalid',503)
}
