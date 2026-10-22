import PostalMime from 'postal-mime'
import seed from '../../../../seed.json'
import type {AppBindings} from '@/core/shared/bindings'
import {createPennyRuntime} from '@/core/app/runtime'
import {guardedDatabase} from '../integrations/guarded-database'
import {digest} from '../auth/native-tokens'
import {recordEvidence} from './write-service'
import {uploadEvidenceAttachment} from './attachments'
import {alignedFrom,captureSettings,mailbox,originalSender,ownMailboxes} from './email-admission'
const maxMessageBytes=seed.limits.uploadBytesPerRequest+65536
export async function captureEmail(message:ForwardableEmailMessage,bindings:AppBindings):Promise<void>{
 const runtime=createPennyRuntime(bindings),raw=runtime.database.binding
 const refuse=async(reason:string)=>{await raw.prepare('INSERT INTO penny_email_capture_refusals(reason,count) VALUES(?,1) ON CONFLICT(reason) DO UPDATE SET count=count+1').bind(reason).run()}
 try{
  const settings=await captureSettings(runtime)
  if(!settings.captureAddress||mailbox(message.to)!==settings.captureAddress)return await refuse('capture_address_unconfigured_or_mismatched')
  if(!Number.isSafeInteger(message.rawSize)||message.rawSize<=0||message.rawSize>maxMessageBytes)return await refuse('message_size_limit')
  const own=await ownMailboxes(runtime),from=mailbox(message.headers.get('from')),envelope=mailbox(message.from)
  if(!from||!envelope)return await refuse('invalid_sender')
  if(own.includes(from)||own.includes(envelope))return await refuse('penny_sender_or_reply_to')
  if(message.headers.has('auto-submitted')&&message.headers.get('auto-submitted')?.toLowerCase()!=='no')return await refuse('notification_or_automated_reply')
  const aligned=alignedFrom(message.headers)
  if(!aligned)return await refuse('dmarc_not_aligned')
  const domain=aligned.split('@')[1],operator=await raw.prepare("SELECT 1 FROM oa_operators WHERE email=? AND status='active'").bind(aligned).first()
  if(!operator&&!settings.domains.includes(domain))return await refuse('sender_not_allowed')
  const messageId=message.headers.get('message-id')?.trim()
  if(!messageId||!/^<[^<>\s]{1,900}@[^<>\s]{1,100}>$/.test(messageId))return await refuse('message_id_required')
  const messageDigest=await digest(messageId)
  if(await raw.prepare('SELECT 1 FROM penny_email_capture_messages WHERE message_digest=?').bind(messageDigest).first())return await refuse('duplicate_message')
  const reader=message.raw.getReader(),chunks:Uint8Array[]= [];let size=0
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxMessageBytes){await reader.cancel();return await refuse('message_size_limit')}chunks.push(value)}}finally{reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  const parsed=await PostalMime.parse(bytes,{maxNestingDepth:20,maxHeadersSize:65536}),wording=parsed.text?.trim()
  if(!wording||wording.length>20000)return await refuse('excerpt_size_or_plain_text_required')
  const recovered=originalSender(wording),notes:string[]=[],files:File[]=[];let total=0
  // Mail clients retain threading headers when forwarding. Admit an explicit
  // forward, while ordinary threaded replies and forwarded Penny mail stay out.
  if((message.headers.has('in-reply-to')||message.headers.has('references'))&&!recovered.forwarded||recovered.address&&own.includes(recovered.address))return await refuse('notification_or_automated_reply')
  for(const attachment of parsed.attachments){
   const content=attachment.content
   if(typeof content==='string'){notes.push('attachment encoding');continue}
   const length=content.byteLength
   if(!seed.limits.uploadTypes.includes(attachment.mimeType)){notes.push('allowed types');continue}
   if(!length||length>seed.limits.uploadBytesPerFile){notes.push('per-file size');continue}
   if(total+length>seed.limits.uploadBytesPerRequest||files.length>=100){notes.push('per-message total');continue}
   if(!attachment.filename||attachment.filename.length>255){notes.push('filename length');continue}
   total+=length;files.push(new File([Uint8Array.from(content instanceof ArrayBuffer?new Uint8Array(content):content)],attachment.filename,{type:attachment.mimeType}))
  }
  const label=[recovered.forwarded?'Forwarded email':'Email — not forwarded',`Forwarded by ${aligned}`,...(notes.length?['Attachment omitted: '+[...new Set(notes)].join(', ')]:[])].join('. ')
  const state=await raw.prepare("SELECT epoch FROM data_state WHERE singleton=1 AND phase='idle'").first<{epoch:number}>()
  if(!state)return await refuse('maintenance_in_progress')
  const db=guardedDatabase(raw,{sql:`EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle' AND epoch=?) AND EXISTS(SELECT 1 FROM penny_email_capture_settings WHERE singleton=1 AND capture_address=?) AND (EXISTS(SELECT 1 FROM oa_operators WHERE email=? AND status='active') OR EXISTS(SELECT 1 FROM penny_email_capture_domains WHERE domain=?)) AND NOT EXISTS(SELECT 1 FROM penny_mail_identity WHERE from_address IN(?,?) OR reply_to IN(?,?))`,params:[state.epoch,settings.captureAddress,aligned,domain,from,envelope,from,envelope]})
  const now=new Date().toISOString(),item=await recordEvidence(db,{sourceType:'email',sourceLabel:label,wording,namedSpeaker:recovered.address??aligned,observedAt:now},null,now,messageDigest)
  for(const file of files)await uploadEvidenceAttachment(db,raw,runtime.blobs,item.id,file,now)
 }catch(error){
  // No raw message, sender, subject or exception is logged or retained. Never
  // call setReject, reply or forward: refusal cannot generate another email.
  const reason=String(error).includes('penny_email_capture_messages.message_digest')?'duplicate_message':'capture_failed'
  try{await refuse(reason)}catch{console.error('Email capture unavailable')}
 }finally{try{await message.raw.cancel()}catch{/* A consumed stream is already closed. */}}
}
