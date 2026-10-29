import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError} from '../auth/native-tokens'
import {wire,type Connection} from './configuration'
import {reviewLink} from './review-link'
import {token} from './secrets'
/** Source probes use the saved individual permalink, never absence from a feed. */
export async function sourcePresent(runtime:PennyRuntime,c:Connection,id:string,url:string){
 reviewLink(c,id,url)
 const i=encodeURIComponent(id)
 let target=url,body=''
 if(c.site==='appstore')target=`https://api.appstoreconnect.apple.com/v1/customerReviews/${i}`
 if(c.site==='googleplay')target=`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(c.listing)}/reviews/${i}`
 if(c.site==='trustpilot')target=`https://api.trustpilot.com/v1/reviews/${i}`
 if(c.site==='g2')target=`https://data.g2.com/api/v1/survey-responses/${i}`
 if(c.site==='producthunt'){target='https://api.producthunt.com/v2/api/graphql';body=JSON.stringify({query:'query ReviewSource($id: ID!) { comment(id: $id) { id url } }',variables:{id}})}
 const r=await wire(runtime,target,target===url?undefined:await token(runtime,c),body)
 if([401,403,404,410].includes(r.status))return false
 if(r.status!==200)throw new NativeError(r.status===429?'reviews_rate_limited':'reviews_source_check_failed',503)
 if(c.site==='producthunt'){
  let v:any;try{v=JSON.parse(r.body)}catch{throw new NativeError('reviews_payload_invalid',503)}
  if(v.errors?.length||!v.data||!Object.hasOwn(v.data,'comment'))throw new NativeError('reviews_source_check_failed',503)
  if(v.data.comment===null)return false
  if(String(v.data.comment.id)!==id||v.data.comment.url!==url)throw new NativeError('reviews_source_check_scope_invalid',503)
 }
 if(['capterra','trustradius'].includes(c.site)){
  const scripts=[...r.body.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  let selected=false,present=false
  function visit(v:any,inScope=false){
   if(Array.isArray(v)){v.forEach(x=>visit(x,inScope));return}
   if(!v||typeof v!=='object')return
   const types=Array.isArray(v['@type'])?v['@type']:[v['@type']]
   const scope=inScope||[v.url,v['@id'],v.itemReviewed?.url,v.itemReviewed?.['@id']].includes(c.public_url)
   if(scope)selected=true
   if(scope&&types.includes('Review')&&String(v.identifier??v['@id']??v.url)===id&&v.url===url)present=true
   if(v.review)visit(v.review,scope)
   if(v['@graph'])visit(v['@graph'])
  }
  try{scripts.forEach(s=>visit(JSON.parse(s[1])))}catch{throw new NativeError('reviews_public_markup_unavailable',503)}
  if(!selected)throw new NativeError('reviews_public_markup_unavailable',503)
  // Hash links share a rolling listing response. Its omission cannot prove
  // deletion; require an individual resource for authoritative absence.
  if(!present&&new URL(url).hash)throw new NativeError('reviews_source_identity_unconfirmed',503)
  return present
 }
 return true
}
