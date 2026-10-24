import {NativeError,digest} from '../auth/native-tokens'
import {canonical} from '../data/archive'
import {redact,type Rules} from '../redaction/engine'
import {redactionSettings} from '../redaction/settings'
import {decodeOriginal,humanContent,ORBIT_REDACTED_CONTENT,NATIVE_REDACTED_CONTENT} from './source-content'
import type {Captured} from './acquisition'

export type CaptureRules=Awaited<ReturnType<typeof redactionSettings>>
// These values carry relationships, replay identity and validated provenance,
// rather than human wording. Preserve them while redacting nested free text.
const structural=(key:string)=>['id','slug','source_type'].includes(key)||/_id$|Id$|Ids$/.test(key)
const sourceKeys=new Set(['opportunity','title','close_reason','subject','name','contacts','text','audience','principalIds','installationId','accountId','principalId','observedAt','provider','target','revision','canonicalUrl','kind'])
export function redactLearningValue<T>(value:T,rules:Rules,sourceKeysOnly=false):T{
 if(!rules.enabled)return value
 function visit(item:unknown,key=''):unknown{
  if(typeof item==='string'){
   if(structural(key)||(/_at$|At$/.test(key)&&Number.isFinite(Date.parse(item)))){if(redact(item,rules)!==item)throw new NativeError('learning_redaction_structural_value',422,'A source identity or timestamp matches a redaction rule. Remove the sensitive structural value in the source before capture.');return item}
   return redact(item,rules)
  }
  if(Array.isArray(item))return item.map(child=>visit(child,key))
  if(item&&typeof item==='object'){
   const entries=Object.entries(item).map(([name,child])=>[sourceKeysOnly&&!structural(name)&&!/_at$|At$/.test(name)&&!sourceKeys.has(name)?redact(name,rules):name,visit(child,name)] as const)
   if(new Set(entries.map(([name])=>name)).size!==entries.length)throw new Error('redaction_key_collision')
   return Object.fromEntries(entries)
  }
  return item
 }
 try{return visit(value) as T}catch(error){if(error instanceof NativeError)throw error;throw new NativeError('redaction_limit',413)}
}
/** Provider integrity is checked by readOrbit before this function. The provider
 * revision remains a whole-source digest; retained text has its own digest. */
export async function redactLearningCapture(record:Captured,rules:CaptureRules):Promise<Captured>{
 if(!rules.enabled)return {...record,redactionRevision:rules.revision}
 const decoded=decodeOriginal(record.original)
 if(decoded){
  const raw=redactLearningValue(JSON.parse(decoded.envelope.text),rules,true),text=canonical(raw)
  const sanitized=redactLearningValue(decoded.envelope,rules,true)
  const envelope={...sanitized,provider:decoded.envelope.provider,target:decoded.envelope.target,revision:decoded.envelope.revision,canonicalUrl:decoded.envelope.canonicalUrl,audience:{...sanitized.audience,kind:decoded.envelope.audience.kind},text}
  const original={format:ORBIT_REDACTED_CONTENT,sourceOrigin:decoded.sourceOrigin,envelope,retainedRevision:await digest(text),redactionRevision:rules.revision}
  return {...record,wording:humanContent(envelope.target,raw).wording,original,redactionRevision:rules.revision}
 }
 const retained=redactLearningValue(record.original,rules) as Record<string,unknown>
 const original={...retained,pennyRetained:{format:NATIVE_REDACTED_CONTENT,sourceRevision:await digest(canonical(record.original)),retainedRevision:await digest(canonical(retained)),redactionRevision:rules.revision}}
 return {...record,wording:redactLearningValue({wording:record.wording},rules).wording,original,redactionRevision:rules.revision}
}
