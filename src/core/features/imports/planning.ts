import { planD1Import,planD1ImportStream,canonicalJson,sha256 } from '../../../../base/modules/import-kit/src/d1/index'
import type { D1ImportContext,ImportPlan } from '../../../../base/modules/import-kit/src/d1/index'
import type { ImportStreamPlan } from '../../../../base/modules/import-kit/src/d1/streams'
import {planFingerprint} from '../../../../base/modules/import-kit/src/plan/index'
import { sourceIdentity } from '../../../../base/modules/import-kit/src/provenance/identity'
import { canonicalSize } from '../../../../base/modules/import-kit/src/provenance/canonical-stream'
import {importRoadmapRecord} from './status-roadmap'
import { feedbackMapping } from './mapping'
import { withoutLabelNamespace } from './mapping-support'
import { readSavedFeedback } from './source'
import { importBounds,type SavedFeedbackInput } from './types'
import { feedbackReceipt } from './receipt'
import { planIterable } from './bundle'
import { erasedPlanRecords } from './erasure-preview'
import { NativeError } from '../auth/native-tokens'

export async function prepareFeedback(input:SavedFeedbackInput,context:D1ImportContext,actor:string){
 const source=await readSavedFeedback(input)
 const roadmap=await importRoadmapRecord(source,context.storage.database as unknown as D1Database)
 if(roadmap)source.records.push(roadmap)
 const nativeMapping=feedbackMapping(source,actor)
 if(source.records.length>importBounds.records)throw new NativeError(`Saved history including derived contributors has ${source.records.length} records; the limit is ${importBounds.records}. No history was applied.`,413)
 const claims=new Map<string,{identity:string;source_hash:string;mapping_version:string;effects_hash:string}>()
 for(let start=0;start<source.records.length;start+=500){
  const ids=source.records.slice(start,start+500).map(row=>sourceIdentity(context.destination,context.namespace,row.kind,row.sourceId))
  const {results}=await context.storage.database.prepare('SELECT identity,source_hash,mapping_version,effects_hash FROM ik_sources WHERE identity IN (SELECT value FROM json_each(?))').bind(JSON.stringify(ids)).all<{identity:string;source_hash:string;mapping_version:string;effects_hash:string}>()
  for(const row of results)claims.set(row.identity,row)
 }
 const mapping={version:nativeMapping.version,map:(record:typeof source.records[number])=>{
  const mapped=nativeMapping.map(record),prior=claims.get(sourceIdentity(context.destination,context.namespace,record.kind,record.sourceId))
  if(!prior||prior.source_hash===record.payloadHash&&prior.mapping_version===nativeMapping.version&&prior.effects_hash===sha256(canonicalJson(mapped.effects)))return mapped
  // A job applied before the namespace joined the evidence label keeps the wording it was applied with.
  const earlier=withoutLabelNamespace(mapped.effects,context.namespace)
  if(prior.source_hash===record.payloadHash&&prior.mapping_version===nativeMapping.version&&prior.effects_hash===sha256(canonicalJson(earlier)))return {...mapped,effects:earlier}
  return {effects:[],rejection:'Previously imported source identity changed. Automatic updates are refused.'}
 }}
 let ordinary:ImportPlan|undefined,stream:ImportStreamPlan|undefined,legacyFingerprint:string|undefined
 // Mapping input belongs to the mapper only. Base persists the entire supplied
 // source object, including unknown properties, so construct its public shape.
 const retainedSource={records:source.records,artifacts:source.artifacts,diagnostics:source.diagnostics}
 const artifacts=source.artifacts,diagnostics=[...source.diagnostics]
 if(source.records.length<=200){
  ordinary=await planD1Import(retainedSource,mapping,context)
  legacyFingerprint=planFingerprint({...ordinary,source:{...ordinary.source,options:input} as typeof ordinary.source})
  // Base's stream partitioner bounds expanded pages at this working-set size.
  // Large files need that same bounded erasure path even below 200 records.
  if(canonicalSize(ordinary)>512*1024)ordinary=undefined
 }
 if(!ordinary){
  stream=await planD1ImportStream({...retainedSource,diagnostics:[],artifacts:artifacts.map(artifact=>({...artifact,original:{status:'unavailable' as const,reason:'not-supplied' as const}}))},mapping,context)
  if(stream.pages.some(page=>Number(JSON.parse(page).expandedSize??JSON.parse(page).size)>importBounds.planBytes))throw new NativeError(`Normalized import plan exceeds the ${importBounds.planBytes}-byte page limit. No history was applied.`,413)
 }
 const plans=ordinary?[ordinary]:planIterable(stream!.pages),receipt=feedbackReceipt(plans)
 if(stream)receipt.unresolved.push(...diagnostics.filter(d=>d.code==='UNRESOLVED_REFERENCE').map(d=>({kind:d.kind!,sourceId:d.sourceId!,field:d.field!,target:d.message})))
 const rows=[]
 for(const plan of ordinary?[ordinary]:planIterable(stream!.pages))for(const entry of plan.entries){if(rows.length<100)rows.push({kind:entry.source.kind,sourceId:entry.source.sourceId,applied:entry.effects.length,rejection:entry.rejection??null,omissions:entry.unmapped})}
 const metadata=ordinary??stream!.header
 const erasedRecords=await erasedPlanRecords(context.storage.database as unknown as D1Database,context.destination,ordinary?[ordinary]:planIterable(stream!.pages))
 return {erasedRecords,fingerprint:ordinary?.fingerprint??stream!.fingerprint,counts:metadata.counts,diagnostics:metadata.diagnostics.filter(d=>d.code!=='ORIGINAL_UNAVAILABLE').slice(0,100),rows,rowsTruncated:metadata.counts.unique>rows.length,receipt,ordinary,stream,artifacts,legacyFingerprint}
}
export type PreparedFeedback=Awaited<ReturnType<typeof prepareFeedback>>
export function previewResponse(value:PreparedFeedback){const {ordinary,stream,artifacts,legacyFingerprint,...response}=value;void ordinary;void stream;void artifacts;void legacyFingerprint;return response}
