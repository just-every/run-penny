import {credentialInput} from './credential-schema'
import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError} from '../auth/native-tokens'
export const sites=['g2','capterra','trustradius','trustpilot','producthunt','appstore','googleplay'] as const
export const site=z.enum(sites)
export type Site=z.infer<typeof site>
export const listing=z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/)
export const connectionInput=z.object({site,listing,publicUrl:z.string().url().max(1000).nullable().default(null),termsAccepted:z.boolean().default(false),intervalHours:z.number().int().min(1).max(168).default(24),purgeDays:z.number().int().min(0).max(365).default(0),extract:z.boolean().default(true),token:z.string().min(1).max(8192).optional(),credential:credentialInput.optional()}).strict()
export interface Connection {id:string;site:Site;listing:string;public_url:string|null;terms_accepted:number;interval_hours:number;purge_days:number;extract:number;owner_id:string;owner_version:number;actor_id:string;revision:number;state:string;cursor:string|null;claim:string|null;started_at:string|null;next_due:string;last_success:string|null;failure:string|null;captured:number;attempts:number;updated_at:string}
export interface ReviewEgress {send(request:{url:string;method:'GET'|'POST';headers:Record<string,string>;body:string}):Promise<{status:number;headers:Record<string,string>;body:string}>}
export function publicListing(s:Site,value:string|null){
 if(!value)throw new NativeError('reviews_public_listing_required',400)
 const u=new URL(value),hosts=s==='capterra'?['www.capterra.com','www.capterra.co.uk']:['www.trustradius.com']
 if(u.protocol!=='https:'||u.username||u.password||u.port||!hosts.includes(u.hostname)||u.search||u.hash)throw new NativeError('reviews_public_listing_invalid',400)
 return u.href
}
export async function wire(runtime:PennyRuntime,url:string,token?:string,body='',headers:Record<string,string>={}){
 const port=runtime.bindings.PENNY_REVIEWS_EGRESS
 if(!port)throw new NativeError('reviews_transport_unconfigured',503)
 const response=await port.send({url,method:body?'POST':'GET',headers:{Accept:'application/json, text/html',...(token?{Authorization:`Bearer ${token}`} :{}),...(body?{'Content-Type':'application/json'}:{}),...headers},body})
 if(!response||!Number.isInteger(response.status)||response.status<100||response.status>599||typeof response.body!=='string'||new TextEncoder().encode(response.body).length>512*1024)throw new NativeError('reviews_response_invalid',503)
 if(response.status>=300&&response.status<400)throw new NativeError('reviews_redirect_refused',503)
 return response
}
export const connection=(db:D1Database,id:string)=>db.prepare('SELECT * FROM penny_review_connections WHERE id=?').bind(id).first<Connection>()
export function workGuard(c:Connection,epoch:number){return {sql:`EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle' AND epoch=?) AND EXISTS(SELECT 1 FROM penny_review_connections c JOIN oa_operators o ON o.id=c.owner_id WHERE c.id=? AND c.revision=? AND c.state='running' AND c.claim=? AND o.status='active' AND o.role='owner' AND o.version=c.owner_version)`,params:[epoch,c.id,c.revision,c.claim] as (string|number|null)[]}}
