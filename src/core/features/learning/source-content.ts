import {z} from 'zod'
import {digest,NativeError} from '../auth/native-tokens'
import {canonical} from '../data/archive'
import type {Observation,Source} from './schema'

export const ORBIT_CONTENT='penny.orbit-content/1'
export const ORBIT_REDACTED_CONTENT='penny.orbit-content/2'
export const NATIVE_REDACTED_CONTENT='penny.native-content/1'
export const orbitEnvelope=z.object({provider:z.literal('orbit'),installationId:z.string(),accountId:z.string(),principalId:z.string(),target:z.string().regex(/^(opportunities|contacts|companies|signals)\/[A-Za-z0-9_-]{1,100}$/),revision:z.string().regex(/^[a-f0-9]{64}$/),observedAt:z.iso.datetime(),audience:z.object({kind:z.literal('source-principals'),principalIds:z.array(z.string())}).passthrough(),title:z.string(),text:z.string().max(50000),canonicalUrl:z.string()}).passthrough()
export type OrbitEnvelope=z.infer<typeof orbitEnvelope>
export interface HumanField {path:string[];label:string;value:string}
export interface HumanRange {start:number;end:number;label:string}
const object=(value:unknown):Record<string,unknown>=>z.record(z.string(),z.unknown()).parse(value)
export function humanFields(target:string,raw:Record<string,unknown>):HumanField[]{
 const kind=target.split('/')[0],row=kind==='opportunities'?object(raw.opportunity):raw
 const fields=kind==='opportunities'?[['title','Opportunity title'],['close_reason','Opportunity closing reason']]:kind==='signals'?[['subject','Signal subject']]:[['name',kind==='contacts'?'Contact name':'Company name']]
 return fields.flatMap(([key,label])=>typeof row[key]==='string'&&row[key].trim()?[{path:kind==='opportunities'?['opportunity',key]:[key],label,value:row[key]}]:[])
}
export function humanContent(target:string,raw:Record<string,unknown>){
 let wording='';const ranges:HumanRange[]=[]
 for(const field of humanFields(target,raw)){wording+=(wording?'\n':'')+field.label+': ';const start=wording.length;wording+=field.value;ranges.push({start,end:wording.length,label:field.label})}
 return {wording,ranges}
}
export function sourceUrl(value:string,origin:string,target:string):string|null{
 try{const base=new URL(origin),url=new URL(value),path=target.startsWith('opportunities/')?'/app/opportunities/'+target.split('/')[1]:'/app/records'
 return base.protocol==='https:'&&base.pathname==='/'&&!base.search&&!base.hash&&!base.username&&!base.password&&url.protocol==='https:'&&url.origin===base.origin&&!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname===path?url.href:null
 }catch{return null}
}
export function rawPeople(target:string,raw:Record<string,unknown>):string[]{
 const people:string[]=target.startsWith('contacts/')?[target.slice(9)]:[]
 if(Array.isArray(raw.contacts))for(const person of raw.contacts)if(person&&typeof person==='object'&&typeof person.id==='string')people.push(person.id)
 if(typeof raw.contact_id==='string')people.push(raw.contact_id)
 return [...new Set(people)]
}
export function rawEvent(target:string,raw:Record<string,unknown>){
 const row=target.startsWith('opportunities/')?object(raw.opportunity):raw
 if(row.id!==target.split('/')[1])throw new NativeError('learning_source_target_invalid',409)
 const observedAt=row.occurred_at??row.updated_at??row.created_at
 if(typeof observedAt!=='string'||!Number.isFinite(Date.parse(observedAt)))throw new NativeError('learning_source_time_missing',409)
 return observedAt
}
export function normalizedOriginal(envelope:OrbitEnvelope,sourceOrigin:string){return {format:ORBIT_CONTENT,sourceOrigin:new URL(sourceOrigin).origin,envelope}}
export function decodeOriginal(original:unknown):{envelope:OrbitEnvelope;sourceOrigin:string|null;normalized:boolean;retainedRevision?:string;redactionRevision?:number}|null{
 const value=object(original)
 if('format' in value||'envelope' in value||'sourceOrigin' in value){
  if(![ORBIT_CONTENT,ORBIT_REDACTED_CONTENT].includes(String(value.format))||typeof value.sourceOrigin!=='string')throw new NativeError('learning_source_format_invalid',409)
  if(value.format===ORBIT_REDACTED_CONTENT){
   const retained=z.object({retainedRevision:z.string().regex(/^[a-f0-9]{64}$/),redactionRevision:z.number().int().nonnegative()}).parse(value)
   return {envelope:orbitEnvelope.parse(value.envelope),sourceOrigin:value.sourceOrigin,normalized:true,...retained}
  }
  return {envelope:orbitEnvelope.parse(value.envelope),sourceOrigin:value.sourceOrigin,normalized:true}
 }
 return value.provider==='orbit'?{envelope:orbitEnvelope.parse(value),sourceOrigin:null,normalized:false}:null
}
export function observationOriginal(o:Pick<Observation,'original_json'>){return decodeOriginal(JSON.parse(o.original_json))}
export async function contentIdentity(wording:string,original:unknown){
 const decoded=decodeOriginal(original)
 if(decoded?.retainedRevision)return digest(canonical([ORBIT_REDACTED_CONTENT,original,wording]))
 const value=object(original)
 if(value.pennyRetained)return digest(canonical([NATIVE_REDACTED_CONTENT,value,wording]))
 return digest(decoded?.normalized?JSON.stringify([ORBIT_CONTENT,decoded.envelope.revision,wording]):wording)
}
export function citationRanges(o:Pick<Observation,'original_json'|'wording'>):HumanRange[]{
 const decoded=observationOriginal(o)
 return decoded?.normalized?humanContent(decoded.envelope.target,object(JSON.parse(decoded.envelope.text))).ranges:o.wording?[{start:0,end:o.wording.length,label:'Original wording'}]:[]
}
/** Recompute tagged wording and retained integrity. Redacted representations
 * preserve the separately verified whole-source revision, without its bytes. */
export async function validateObservation(o:Observation,source:Source){
 const decoded=observationOriginal(o)
 if(o.event_key.startsWith('orbit:')&&!decoded)throw new NativeError('learning_source_original_invalid',409)
 if(decoded&&(decoded.envelope.installationId!==source.installation_id||source.provider!=='orbit'||!(JSON.parse(source.resource_ids_json) as string[]).includes(decoded.envelope.target)||o.event_key!==`orbit:${decoded.envelope.installationId}:${decoded.envelope.target}`))throw new NativeError('learning_source_original_invalid',409)
 if(decoded&&!decoded.normalized&&(o.wording!==decoded.envelope.text||await digest(decoded.envelope.text)!==decoded.envelope.revision))throw new NativeError('learning_source_original_invalid',409)
 if(decoded?.normalized){
  const {envelope:e,sourceOrigin}=decoded,raw=object(JSON.parse(e.text)),content=humanContent(e.target,raw)
  if(await digest(e.text)!==(decoded.retainedRevision??e.revision)||!sourceOrigin||!sourceUrl(e.canonicalUrl,sourceOrigin,e.target)||o.observed_at!==rawEvent(e.target,raw)||o.wording!==content.wording)throw new NativeError('learning_source_original_invalid',409)
 }
 const original=object(JSON.parse(o.original_json))
 if(original.pennyRetained){
  const metadata=z.object({format:z.literal(NATIVE_REDACTED_CONTENT),sourceRevision:z.string().regex(/^[a-f0-9]{64}$/),retainedRevision:z.string().regex(/^[a-f0-9]{64}$/),redactionRevision:z.number().int().nonnegative()}).parse(original.pennyRetained)
  delete original.pennyRetained
  if(decoded||!o.event_key.startsWith('native:')||await digest(canonical(original))!==metadata.retainedRevision)throw new NativeError('learning_source_original_invalid',409)
 }
 if(await contentIdentity(o.wording,JSON.parse(o.original_json))!==o.content_hash)throw new NativeError('learning_source_identity_invalid',409)
 return decoded?rawPeople(decoded.envelope.target,object(JSON.parse(decoded.envelope.text))):[]
}
/** All retained formats expose the retained provider text to the privacy closure.
 * Untagged historical rows keep their original wording compatibility path. */
export const rawSourceSql=`CASE WHEN json_valid(o.original_json) THEN COALESCE(json_extract(o.original_json,'$.envelope.text'),json_extract(o.original_json,'$.text'),o.wording) ELSE o.wording END`
export const rawSourceObjectSql=`CASE WHEN json_valid(${rawSourceSql}) THEN (${rawSourceSql}) ELSE '{}' END`
