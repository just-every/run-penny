import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {mailIdentity} from '../settings/mail-identity'
export const captureInput=z.object({captureAddress:z.email().trim().toLowerCase().max(254),domains:z.array(z.string().trim().toLowerCase().max(253).regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/)).max(100)}).strict()
export function mailbox(value:string|null|undefined):string|null{
 if(!value)return null
 const match=value.trim().match(/^(?:[^<>\r\n]*<([^<>]+)>|([^<>\s]+))$/u),address=(match?.[1]??match?.[2])?.toLowerCase()
 return address&&z.email().safeParse(address).success?address:null
}
export async function captureSettings(runtime:PennyRuntime){
 const db=runtime.database.binding
 const [settings,domains,refusals]=await Promise.all([
  db.prepare('SELECT capture_address AS captureAddress FROM penny_email_capture_settings WHERE singleton=1').first<{captureAddress:string}>(),
  db.prepare('SELECT domain FROM penny_email_capture_domains ORDER BY domain').all<{domain:string}>(),
  db.prepare('SELECT reason,count FROM penny_email_capture_refusals ORDER BY reason').all<{reason:string;count:number}>(),
 ])
 return {captureAddress:settings?.captureAddress??'',domains:domains.results.map(row=>row.domain),refusals:refusals.results}
}
export async function ownMailboxes(runtime:PennyRuntime){
 const identity=await mailIdentity(runtime)
 return [mailbox(runtime.configuration.mailFrom),mailbox(identity?.fromAddress),mailbox(identity?.replyTo)].filter((value):value is string=>!!value)
}
/** Only the receiving platform's single Authentication-Results field is used.
 * Body/forwarded headers and ARC results cannot admit a message. Duplicate or
 * malformed results fail closed, including a sender-supplied duplicate. */
export function alignedFrom(headers:Headers):string|null{
 const from=mailbox(headers.get('from')),authentication=headers.get('authentication-results')
 if(!from||!authentication||!/^mx\.cloudflare\.net\s*;/i.test(authentication)||authentication.includes(',')||/\r|\n/.test(authentication))return null
 const clauses=authentication.split(';').slice(1).map(value=>value.trim()),dmarc=clauses.filter(value=>/^dmarc=/i.test(value))
 if(dmarc.length!==1)return null
 const result=/^dmarc=pass(?:\s+\([^()]*\))?\s+header\.from=([a-z0-9.-]+)(?:\s|$)/i.exec(dmarc[0])
 return result&&result[1].toLowerCase()===from.split('@')[1]?from:null
}
export function originalSender(text:string):{address:string|null;forwarded:boolean}{
 const lines=text.replace(/\r\n/g,'\n').split('\n')
 for(let i=0;i<lines.length;i++){
  const marker=/^\s*(?:-{5,}\s*(?:Forwarded message|Original Message)\s*-{5,})\s*$/i.test(lines[i])
  const outlook=/^From:\s*/i.test(lines[i])&&/^Sent:\s*.+/i.test(lines[i+1]??'')&&/^To:\s*.+/i.test(lines[i+2]??'')&&/^Subject:\s*.+/i.test(lines[i+3]??'')
  if(!marker&&!outlook)continue
  const header=lines.slice(i+(marker?1:0),i+8).find(line=>/^From:\s*/i.test(line.trim()))
  const value=header?.trim().replace(/^From:\s*/i,'').replace(/\s*\[mailto:[^\]]+\]\s*$/i,'')
  const address=mailbox(value)
  if(address)return {address,forwarded:true}
 }
 return {address:null,forwarded:false}
}
