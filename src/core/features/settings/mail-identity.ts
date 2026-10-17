import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
const safeName=(value:string)=>![...value].some(character=>character.charCodeAt(0)<32||character.charCodeAt(0)===127||[0x2028,0x2029].includes(character.charCodeAt(0))||'<>"\\'.includes(character))
export const businessInput=z.object({companyName:z.string().trim().min(1).max(160).refine(safeName),postalAddress:z.string().trim().min(1).max(2000)}).strict()
const mailbox=z.email().trim().toLowerCase().max(254)
export const mailIdentityInput=businessInput.extend({senderName:z.string().trim().max(160).refine(safeName),fromAddress:mailbox,replyTo:mailbox.nullable()}).strict()
export type MailIdentityInput=z.infer<typeof mailIdentityInput>
export interface MailIdentity {companyName:string;senderName:string;fromAddress:string|null;replyTo:string|null;postalAddress:string}
export async function mailIdentity(runtime:PennyRuntime):Promise<MailIdentity|null>{
 return runtime.database.binding.prepare('SELECT company_name AS companyName,sender_name AS senderName,from_address AS fromAddress,reply_to AS replyTo,postal_address AS postalAddress FROM penny_mail_identity WHERE singleton=1').first<MailIdentity>()
}
export function identityHeaders(identity:MailIdentity|null,from:string){
 const name=identity?.senderName||identity?.companyName,address=identity?.fromAddress??from
 const mailbox=address.match(/<([^<>]+)>$/u)?.[1]??address
 return {from:name?`${name} <${mailbox}>`:address,...(identity?.replyTo?{replyTo:identity.replyTo}:{})}
}
export async function requesterMailFooter(runtime:PennyRuntime,requesterId:string,addressId:string,requestId?:string,requestSlugs:readonly string[]=[]){
 const identity=await mailIdentity(runtime)
 const permission=await runtime.database.binding.prepare(`SELECT p.grant_origin AS origin FROM requester_update_permissions p
 LEFT JOIN request_canonical_roots root ON root.origin_id=p.request_id WHERE p.requester_id=? AND p.requester_address_id=? AND p.revoked_at IS NULL AND p.suppressed_at IS NULL
 AND ((p.request_id IS NULL AND p.source='subscription' AND ? IS NULL AND json_array_length(?)=0) OR root.canonical_id=? OR root.canonical_id IN(SELECT id FROM requests WHERE slug IN(SELECT value FROM json_each(?))))
 ORDER BY CASE p.grant_origin WHEN 'author_subscription' THEN 0 WHEN 'vote_subscription' THEN 1 ELSE 2 END,p.granted_at LIMIT 1`)
 .bind(requesterId,addressId,requestId??null,JSON.stringify(requestSlugs),requestId??null,JSON.stringify(requestSlugs)).first<{origin:string}>()
 const reason=permission?.origin==='author_subscription'?'You posted a request and subscribed to its updates.':permission?.origin==='vote_subscription'?'You voted for a request and subscribed to its updates.':'You asked to receive these updates.'
 return `\n\n${reason}${identity?.postalAddress?`\n${identity.postalAddress}`:''}`
}
