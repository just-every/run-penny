import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError,digest} from '../auth/native-tokens'
import {redactCaptured,redactionFence} from '../redaction/settings'
import {createUlid} from '@/core/shared/ulid'
import {sourceId,provider,providerFailure,type Connection} from './configuration'
const customer=z.object({id:sourceId,email:z.email().max(254).nullable().optional(),firstName:z.string().max(160).optional(),lastName:z.string().max(160).optional()})
export const conversation=z.object({id:sourceId,mailboxId:sourceId,tags:z.array(z.object({tag:z.string().max(100)})).max(100),primaryCustomer:customer})
const thread=z.object({id:sourceId,type:z.string(),body:z.string().max(20000).optional(),createdAt:z.iso.datetime({offset:true})})
export async function readSource(runtime:PennyRuntime,c:Connection,id:number,requireTag=true){
 const r=await provider(runtime,c,`/conversations/${id}`)
 if([403,404,410].includes(r.status))return null
 if(r.status!==200)providerFailure(r.status)
 const source=conversation.parse(JSON.parse(r.body))
 if(source.id!==id||source.mailboxId!==c.mailbox_id||(requireTag&&!source.tags.some(t=>t.tag===c.tag)))return null
 const threads=await provider(runtime,c,`/conversations/${id}/threads`)
 if(threads.status!==200)providerFailure(threads.status)
 const parsed=z.object({_embedded:z.object({threads:z.array(thread).max(100)})}).parse(JSON.parse(threads.body))
 const selected=parsed._embedded.threads.find(t=>t.type==='customer'&&t.body?.trim())
 if(!selected?.body)throw new NativeError('helpscout_excerpt_unavailable',503)
 // Store only one customer excerpt. Markup is inert plain text, never rendered
 // as HTML; attachments, private notes and surrounding threads are discarded.
 const wording=selected.body.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').trim()
 if(!wording)throw new NativeError('helpscout_excerpt_unavailable',503)
 return {source,wording,observedAt:selected.createdAt,hash:await digest(JSON.stringify({thread:selected.id,body:selected.body,createdAt:selected.createdAt}))}
}
/** Identity mapping is attribution only: no verification, session or consent. */
export async function mapCustomer(runtime:PennyRuntime,c:Connection,db:D1Database,person:z.infer<typeof customer>,now:string){
 const r=await provider(runtime,c,`/customers/${person.id}`)
 if(r.status!==200)providerFailure(r.status)
 const full=customer.extend({organizationId:sourceId.nullable().optional(),emails:z.array(z.object({value:z.email()})).max(50).optional()}).parse(JSON.parse(r.body))
 if(full.id!==person.id)throw new NativeError('helpscout_customer_mismatch',503)
 const email=(person.email??full.emails?.[0]?.value)?.toLowerCase()??null
 const safe=await redactCaptured(db,{name:[full.firstName,full.lastName].filter(Boolean).join(' ')||'Help Scout customer'},['name']),fence=redactionFence(db,safe.revision)
 let requesterId=email?await db.prepare('SELECT requester_id FROM requester_addresses WHERE lower(email)=?').bind(email).first<string>('requester_id'):null
 if(requesterId){if(!await db.prepare('SELECT id FROM requesters WHERE id=? AND blocked_at IS NULL AND NOT EXISTS(SELECT 1 FROM requester_identity_merges WHERE source_requester_id=?)').bind(requesterId,requesterId).first())requesterId=null}
 else if(email){
  requesterId=createUlid()
  await db.batch([fence.before,fence.after,db.prepare('INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES(?,?,?,?)').bind(requesterId,safe.input.name,now,now),db.prepare('INSERT INTO requester_addresses(id,requester_id,email,created_at,updated_at) VALUES(?,?,?,?,?)').bind(createUlid(),requesterId,email,now,now)])
 }
 let accountId:string|null=null
 if(full.organizationId){
  accountId=await db.prepare('SELECT account_id FROM penny_helpscout_companies WHERE connection_id=? AND organization_id=?').bind(c.id,full.organizationId).first<string>('account_id')
  if(!accountId){
   const orgResponse=await provider(runtime,c,`/organizations/${full.organizationId}`)
   if(orgResponse.status!==200)providerFailure(orgResponse.status)
   const org=z.object({id:sourceId,name:z.string().trim().min(1).max(160)}).parse(JSON.parse(orgResponse.body))
   if(org.id!==full.organizationId)throw new NativeError('helpscout_company_mismatch',503)
   const redacted=await redactCaptured(db,{name:org.name},['name']),orgFence=redactionFence(db,redacted.revision)
   accountId=createUlid()
   await db.batch([orgFence.before,orgFence.after,db.prepare('INSERT INTO accounts(id,slug,name,created_at,updated_at) VALUES(?,?,?,?,?)').bind(accountId,'helpscout-'+accountId.toLowerCase(),redacted.input.name,now,now),db.prepare('INSERT INTO penny_helpscout_companies(connection_id,organization_id,account_id) VALUES(?,?,?)').bind(c.id,org.id,accountId)])
  }
 }
 return {requesterId,accountId,name:safe.input.name}
}
