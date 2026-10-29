import {NativeError} from '../auth/native-tokens'
import type {Connection,Site} from './configuration'
const hosts:Record<Site,string[]>={g2:['www.g2.com'],capterra:['www.capterra.com','www.capterra.co.uk'],trustradius:['www.trustradius.com'],trustpilot:['www.trustpilot.com'],producthunt:['www.producthunt.com'],appstore:['apps.apple.com'],googleplay:['play.google.com']}
export function listingLink(site:Site,value:string){
 const u=new URL(value)
 if(u.protocol!=='https:'||u.username||u.password||u.port||!hosts[site].includes(u.hostname)||u.search||u.hash)throw new NativeError('reviews_public_listing_invalid',400)
 if(site==='g2'&&!/^\/products\/[^/]+\/reviews\/?$/.test(u.pathname)||site==='producthunt'&&!/^\/posts\/[^/]+$/.test(u.pathname))throw new NativeError('reviews_public_listing_invalid',400)
 return u.href
}
/** Bind provider permalinks to the selected listing and the returned review ID.
 * G2 and Product Hunt use public slugs distinct from their API IDs; the owner
 * supplies that public listing alongside the scoped vendor ID. */
export function reviewLink(c:Connection,id:string,value:string){
 const u=new URL(value),i=encodeURIComponent(id)
 if(u.protocol!=='https:'||u.username||u.password||u.port||!hosts[c.site].includes(u.hostname))throw new NativeError('reviews_link_invalid',503)
 let valid=false
 switch(c.site){
 case 'g2':{const base=new URL(c.public_url??`https://www.g2.com/products/${encodeURIComponent(c.listing)}/reviews`);valid=u.origin===base.origin&&u.pathname.startsWith(base.pathname.replace(/\/$/,'')+'/')&&u.pathname.split('/').pop()!==''&&!u.search&&!u.hash;break}
 case 'producthunt':valid=!!c.public_url&&u.origin+u.pathname===c.public_url&&u.hash==='#comment-'+i&&!u.search;break
 case 'capterra':case 'trustradius':{const base=new URL(c.public_url!);valid=u.origin===base.origin&&!u.search&&(u.pathname===base.pathname&&u.hash==='#'+i||u.pathname===base.pathname.replace(/\/$/,'')+'/'+i&&!u.hash||c.site==='trustradius'&&u.pathname==='/reviews/'+i&&!u.hash);break}
 case 'trustpilot':valid=u.pathname==='/reviews/'+i&&!u.search&&!u.hash;break
 case 'appstore':valid=u.pathname==='/app/id'+c.listing&&u.searchParams.get('reviewId')===id&&u.searchParams.get('see-all')==='reviews'&&[...u.searchParams.keys()].every(k=>['reviewId','see-all'].includes(k))&&!u.hash;break
 case 'googleplay':valid=u.pathname==='/store/apps/details'&&u.searchParams.get('id')===c.listing&&u.searchParams.get('reviewId')===id&&[...u.searchParams.keys()].every(k=>['id','reviewId'].includes(k))&&!u.hash;break
 }
 if(!valid)throw new NativeError('reviews_link_scope_invalid',503)
 return u
}
