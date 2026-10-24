import { NativeError } from '../auth/native-tokens'
import { Buffer } from 'node:buffer'
import type { D1ImportContext, ImportPlan, SourceArtifact } from '../../../../base/modules/import-kit/src/d1/index'
import { canonicalJson,sha256 } from '../../../../base/modules/import-kit/src/d1/index'
import { atomic } from '../../../../base/modules/import-kit/src/d1/database'
import type { FeedbackReceipt } from './receipt'
import {redactedArtifacts} from './redaction-policy'

export interface BundleRow {id:string;fingerprint:string;receipt_json:string;originals_json:string;sealed:number;originals_state?:'retained'|'withdrawn'}
const chunkSize=48*1024
export async function retainBundle(id:string,fingerprint:string,receipt:FeedbackReceipt,artifacts:SourceArtifact[],context:D1ImportContext):Promise<void>{
 const metadata=artifacts.map(({original,...artifact})=>({...artifact,chunks:original?.status==='available'?Math.ceil(original.base64.length/chunkSize):0,original:original?.status==='available'?{status:'retained'}:original}))
 const header={sql:'INSERT OR IGNORE INTO feedback_import_bundles(id,fingerprint,receipt_json,originals_json) VALUES(?,?,?,?)',params:[id,fingerprint,canonicalJson(receipt),canonicalJson(metadata)]}
 await atomic(context,'create',[header])
 const row=await context.storage.database.prepare('SELECT * FROM feedback_import_bundles WHERE id=?').bind(id).first<BundleRow>()
 if(!row||row.fingerprint!==fingerprint||row.receipt_json!==canonicalJson(receipt)||row.originals_json!==canonicalJson(metadata))throw new Error('FEEDBACK_BUNDLE_CHANGED')
 if(row.sealed){await bundleOriginals(id,context);return}
 let statements:{sql:string;params:unknown[]}[]=[]
 for(const [artifact,value] of artifacts.entries())if(value.original?.status==='available')for(let offset=0;offset<value.original.base64.length;offset+=chunkSize){
  statements.push({sql:'INSERT OR IGNORE INTO feedback_import_original_chunks(bundle_id,artifact,ordinal,bytes) VALUES(?,?,?,?)',params:[id,artifact,offset/chunkSize,value.original.base64.slice(offset,offset+chunkSize)]})
  if(statements.length===8){await atomic(context,'create',statements);statements=[]}
 }
 if(statements.length)await atomic(context,'create',statements)
 await bundleOriginals(id,context,false)
 await atomic(context,'create',[{sql:'UPDATE feedback_import_bundles SET sealed=1 WHERE id=? AND fingerprint=? AND sealed=0 AND (SELECT COUNT(*) FROM feedback_import_original_chunks WHERE bundle_id=?)=?',params:[id,fingerprint,id,metadata.reduce((sum,artifact)=>sum+artifact.chunks,0)]},{sql:"SELECT CASE WHEN EXISTS(SELECT 1 FROM feedback_import_bundles WHERE id=? AND sealed=1) THEN 1 ELSE json('FEEDBACK_BUNDLE_INCOMPLETE') END",params:[id]}])
}
export async function bundleOriginals(id:string,context:D1ImportContext,requireSealed=true){
 const db=context.storage.database,row=await db.prepare('SELECT * FROM feedback_import_bundles WHERE id=?').bind(id).first<BundleRow>()
 if(!row||requireSealed&&!row.sealed)throw new Error('FEEDBACK_BUNDLE_INCOMPLETE')
 if(row.originals_state==='withdrawn')throw new NativeError('Original files were withdrawn by privacy erasure.',409)
 const artifacts=JSON.parse(row.originals_json) as (SourceArtifact&{chunks:number})[]
 const {results}=await db.prepare('SELECT artifact,ordinal,bytes FROM feedback_import_original_chunks WHERE bundle_id=? ORDER BY artifact,ordinal').bind(id).all<{artifact:number;ordinal:number;bytes:string}>()
 let count=0
 const originals=artifacts.map((artifact,index)=>{
  const chunks=results.filter(row=>row.artifact===index);count+=chunks.length
  if(chunks.length!==artifact.chunks||chunks.some((row,i)=>row.ordinal!==i))throw new Error('FEEDBACK_ORIGINAL_CHANGED')
  if(artifact.original?.status==='unavailable'){
   if(chunks.length||!redactedArtifacts(artifacts)||artifact.original.reason!=='not-supplied')throw new Error('FEEDBACK_ORIGINAL_CHANGED')
   return {jobId:id,kind:'artifact',key:artifact.name,name:artifact.name,sha256:artifact.sha256,size:artifact.size,original:artifact.original}
  }
  const base64=chunks.map(row=>row.bytes).join(''),bytes=Buffer.from(base64,'base64')
  if(bytes.toString('base64')!==base64||bytes.length!==artifact.size||sha256(bytes)!==artifact.sha256)throw new Error('FEEDBACK_ORIGINAL_CHANGED')
  return {jobId:id,kind:'artifact',key:artifact.name,name:artifact.name,sha256:artifact.sha256,size:artifact.size,original:{status:'retained',base64}}
 })
 if(count!==results.length)throw new Error('FEEDBACK_ORIGINAL_CHANGED')
 return originals
}
export function planIterable(pages:string[]):Iterable<ImportPlan>{
 return {[Symbol.iterator]:function*(){for(const page of pages)yield expandCompressedPlan(page)}}
}
import { expandCompressedPlan } from '../../../../base/modules/import-kit/src/d1/compressed-plan'

export function sealedContext(context:D1ImportContext,id:string):D1ImportContext {
 const original=context.authorization.predicate
 return {...context,authorization:{...context.authorization,predicate(action,destination){const guard=original(action,destination);return {sql:`(${guard.sql}) AND EXISTS(SELECT 1 FROM feedback_import_bundles WHERE id=? AND sealed=1)`,params:[...guard.params??[],id]}}}}
}
