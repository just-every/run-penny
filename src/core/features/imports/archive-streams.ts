import { Buffer } from 'node:buffer'
import type { Row } from '../data/archive'
import { canonicalJson,sha256 } from '../../../../base/modules/import-kit/src/d1/index'
import { layoutHash } from '../../../../base/modules/import-kit/src/d1/stream-snapshot'
import {redactedArtifacts} from './redaction-policy'
const refuse=():never=>{throw new Error('FEEDBACK_STREAM_ARCHIVE_CHANGED')}
export function validateStreamArchive(data:Record<string,Row[]>):void{
 const streams=data.ik_d1_streams??[],bundles=data.feedback_import_bundles??[],pages=data.ik_d1_stream_pages??[],origins=data.ik_d1_stream_origins??[]
 for(const bundle of bundles){
  const stream=streams.find(row=>row.id===bundle.id);if(!stream||bundle.fingerprint!==stream.fingerprint||bundle.sealed!==1)refuse()
  if(bundle.originals_state==='withdrawn'){if(bundle.originals_json!=='[]'||bundle.receipt_json!=='{}'||(data.feedback_import_original_chunks??[]).some(row=>row.bundle_id===bundle.id))refuse();continue}
  const artifacts=JSON.parse(String(bundle.originals_json)) as {name:string;size:number;sha256:string;chunks:number;original?:{status:string;reason?:string}}[]
  let count=0
  for(const [index,artifact]of artifacts.entries()){
   const chunks=(data.feedback_import_original_chunks??[]).filter(row=>row.bundle_id===bundle.id&&row.artifact===index).sort((a,b)=>Number(a.ordinal)-Number(b.ordinal));count+=chunks.length
   if(artifact.original?.status==='unavailable'){if(chunks.length||artifact.chunks!==0||!redactedArtifacts(artifacts)||artifact.original.reason!=='not-supplied')refuse();continue}
   const base64=chunks.map(row=>row.bytes).join(''),bytes=Buffer.from(base64,'base64')
   if(chunks.length!==artifact.chunks||chunks.some((row,index)=>row.ordinal!==index)||bytes.toString('base64')!==base64||bytes.length!==artifact.size||sha256(bytes)!==artifact.sha256)refuse()
  }
  if(count!==(data.feedback_import_original_chunks??[]).filter(row=>row.bundle_id===bundle.id).length)refuse()
 }
 for(const stream of streams){
  if(!bundles.some(row=>row.id===stream.id))refuse()
  const owned=pages.filter(row=>row.stream_id===stream.id).sort((a,b)=>Number(a.ordinal)-Number(b.ordinal))
  if(!owned.length||layoutHash(owned)!==stream.layout_hash||owned.some((row,index)=>row.ordinal!==index)||owned.reduce((n,row)=>n+Number(row.total),0)!==stream.total)refuse()
  for(const page of owned){const job=data.ik_jobs.find(row=>row.id===page.job_id);if(!job||job.namespace!==stream.namespace||job.principal_id!==stream.principal_id||job.mapping_version!==stream.mapping_version||job.destination!==stream.destination||job.total!==page.total||!origins.some(row=>row.job_id===page.job_id&&row.stream_id===stream.id))refuse()}
  const revision=(data.ik_d1_stream_revisions??[]).find(row=>row.stream_id===stream.id)
  if(!revision||['destination','namespace','mapping_version','principal_id','fingerprint','operation_key','total','layout_hash'].some(field=>revision[field]!==stream[field]))refuse()
  for(const page of owned){const origin=origins.find(row=>row.job_id===page.job_id)!,job=data.ik_jobs.find(row=>row.id===page.job_id)!;if(origin.ordinal!==page.ordinal||origin.page_total!==page.total||origin.job_operation_key!==job.operation_key||['destination','namespace','mapping_version','principal_id','fingerprint','operation_key','total','layout_hash'].some(field=>origin['parent_'+field]!==stream[field]))refuse()}
 }
 for(const page of pages)if(!streams.some(row=>row.id===page.stream_id))refuse()
 for(const origin of origins)if(!pages.some(page=>page.job_id===origin.job_id&&page.stream_id===origin.stream_id))refuse()
 for(const chunk of data.feedback_import_original_chunks??[])if(!bundles.some(row=>row.id===chunk.bundle_id))refuse()
 // Reject a receipt with executable/non-JSON payload before restoration.
 for(const bundle of bundles)if(canonicalJson(JSON.parse(String(bundle.receipt_json)))!==bundle.receipt_json)refuse()
}
