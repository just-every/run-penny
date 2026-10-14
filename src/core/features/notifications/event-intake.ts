// @ts-expect-error Retained Base implementation ships JavaScript without declarations.
import { verifyWebhook } from '../../../../base/modules/mail/src/events/verify.mjs'
import { NativeError } from '@/core/features/auth/native-tokens'

/** One provider event exactly as its signed batch carried it. A provider batch
 * holds every message the account sent, so events Penny did not send stay in
 * the batch and are acknowledged without effect, and SendGrid events without an
 * sg_message_id (delayed, asynchronous bounces) are kept for correlation by
 * Penny's own arguments or the recipient's address. */
export type MailStatus='accepted'|'deferred'|'delivered'|'bounced'|'failed'|'rejected'|'complained'
export interface MailEvent {
 provider:'sendgrid'|'resend';eventId:string;providerMessageId:string|null;type:string;status:MailStatus|null
 /** A hard bounce, complaint or provider suppression: the address takes no more mail. */
 hard:boolean;
 /** The recipient withdrew from all mail through the provider's own unsubscribe. */
 unsubscribe:boolean;occurredAt:number;recipient:string;attemptId:string|null;deliveryId:string|null;product:string|null;fingerprint:string
}
const sendgridStatus:Record<string,MailStatus|null>={processed:'accepted',deferred:'deferred',delivered:'delivered',bounce:'bounced',dropped:'rejected',spamreport:'complained',unsubscribe:null,group_unsubscribe:null,open:null,click:null,group_resubscribe:null}
const resendStatus:Record<string,MailStatus|null>={'email.sent':'accepted','email.delivery_delayed':'deferred','email.delivered':'delivered','email.bounced':'bounced','email.failed':'failed','email.suppressed':'rejected','email.complained':'complained','email.opened':null,'email.clicked':null}
// SendGrid drops a send to an address already on its bounce or spam-report list.
const droppedHard=new Set(['Bounced Address','Spam Reporting Address'])
const text=(value:unknown,max=512)=>typeof value==='string'&&value.length>0&&value.length<=max&&value.trim()===value&&!/[\x00-\x1f\x7f]/.test(value)?value:null
const address=(value:unknown)=>{const email=text(value,254);return email&&/^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]+$/.test(email)?email:null}
const fingerprint=async(slice:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(slice))),byte=>byte.toString(16).padStart(2,'0')).join('')

// Each top-level array member, byte-exact, so a fingerprint binds one event.
function slices(body:string):string[]{
 const found:string[]=[];let depth=0,start=0,quoted=false,escaped=false
 for(let i=0;i<body.length;i++){
  const c=body[i]
  if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue}
  if(c==='"')quoted=true
  else if(c==='{'||c==='['){if(depth===1)start=i;depth++}
  else if(c==='}'||c===']'){depth--;if(depth===1)found.push(body.slice(start,i+1))}
 }
 return found
}

async function sendgrid(slice:string,now:number):Promise<MailEvent|null>{
 const value=JSON.parse(slice) as Record<string,unknown>
 const eventId=text(value.sg_event_id),recipient=address(value.email)
 if(!eventId||!recipient||!Object.hasOwn(sendgridStatus,String(value.event))||!Number.isSafeInteger(value.timestamp)||(value.timestamp as number)*1000>now+300_000)return null
 return {provider:'sendgrid',eventId,providerMessageId:text(value.sg_message_id,1024),type:String(value.event),status:sendgridStatus[String(value.event)],
  hard:value.event==='spamreport'||(value.event==='bounce'&&value.type==='bounce')||(value.event==='dropped'&&droppedHard.has(String(value.reason))),
  unsubscribe:value.event==='unsubscribe'||value.event==='group_unsubscribe',occurredAt:(value.timestamp as number)*1000,recipient,attemptId:text(value.rer_penny_attempt),deliveryId:text(value.rer_delivery_id),product:text(value.rer_product),fingerprint:await fingerprint(slice)}
}
async function resend(body:string,headers:Headers,now:number):Promise<MailEvent[]>{
 const value=JSON.parse(body) as {type?:string;created_at?:string;data?:{email_id?:unknown;to?:unknown;bounce?:{type?:string}}}
 const eventId=text(headers.get('svix-id')),occurredAt=Date.parse(String(value.created_at))
 if(!eventId||!Object.hasOwn(resendStatus,String(value.type))||!Number.isFinite(occurredAt)||occurredAt>now+300_000||!Array.isArray(value.data?.to))return []
 const recipients=(value.data!.to as unknown[]).map(address)
 // Penny sends to exactly one recipient; anything else is not Penny's message.
 if(recipients.length!==1||!recipients[0])return []
 const type=String(value.type)
 return [{provider:'resend',eventId,providerMessageId:text(value.data!.email_id,1024),type,status:resendStatus[type],
  hard:type==='email.complained'||type==='email.suppressed'||(type==='email.bounced'&&value.data!.bounce?.type==='Permanent'),
  unsubscribe:false,occurredAt,recipient:recipients[0],attemptId:null,deliveryId:null,product:null,fingerprint:await fingerprint(body)}]
}

export async function signedEvents(provider:'sendgrid'|'resend',key:string,rawBody:Uint8Array,headers:Headers,now:number):Promise<MailEvent[]>{
 if(!await verifyWebhook({provider,rawBody,headers,key,now,toleranceSeconds:300}))throw new NativeError('invalid_mail_event',400)
 let body:string,parsed:unknown
 try{body=new TextDecoder('utf-8',{fatal:true}).decode(rawBody);parsed=JSON.parse(body)}catch{throw new NativeError('invalid_mail_event',400)}
 if(provider==='resend')return resend(body,headers,now)
 const members=slices(body)
 if(!Array.isArray(parsed)||!parsed.length||parsed.length>1000||members.length!==parsed.length)throw new NativeError('invalid_mail_event',400)
 return (await Promise.all(members.map(slice=>sendgrid(slice,now)))).filter((event):event is MailEvent=>event!==null)
}
