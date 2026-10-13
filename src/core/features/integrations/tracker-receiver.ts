import {sha256,equalSignature} from '../../../../base/modules/integrations/core/crypto.ts'
import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError} from '../auth/native-tokens'
import {boundedRawBody} from './raw-body'
import {trackerConnection,type TrackerConnection} from './tracker-configuration'
import {guardedDatabase} from './guarded-database'
interface StateReceipt {deliveryId:string;externalId:string;project:string;updated:number;state:string}
async function verify(request:Request,raw:Uint8Array,connection:TrackerConnection):Promise<unknown> {
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(connection.signing_key),{name:'HMAC',hash:'SHA-256'},false,['sign'])
 const digest=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,raw as Uint8Array<ArrayBuffer>)),byte=>byte.toString(16).padStart(2,'0')).join('')
 const signature=connection.provider==='linear'?request.headers.get('Linear-Signature')??'':(request.headers.get('X-Hub-Signature')??'').replace(/^sha256=/,'')
 if(connection.provider==='jira'&&!request.headers.get('X-Hub-Signature')?.startsWith('sha256='))throw new NativeError('tracker_signature_refused',401)
 if(!equalSignature(signature,digest))throw new NativeError('tracker_signature_refused',401)
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(raw))}catch{throw new NativeError('validation_failed',400)}
}
function shape(input:unknown,request:Request,connection:TrackerConnection):StateReceipt {
 const payload=input as Record<string,unknown>,data=payload.data as Record<string,unknown>,issue=payload.issue as Record<string,unknown>
 if(connection.provider==='linear'){
  if(payload.type!=='Issue'||request.headers.get('Linear-Event')!=='Issue'||!['create','update'].includes(String(payload.action))||payload.organizationId!==connection.organization_identity)throw new NativeError('tracker_event_refused',422)
  const stamp=payload.webhookTimestamp
  if(typeof stamp!=='number'||!Number.isSafeInteger(stamp)||Math.abs(Date.now()-stamp)>60000)throw new NativeError('tracker_timestamp_refused',401)
  const team=data?.team as Record<string,unknown>,state=data?.state as Record<string,unknown>
  return {deliveryId:request.headers.get('Linear-Delivery')??'',externalId:String(data?.id??''),project:String(team?.id??data?.teamId??''),updated:Date.parse(String(data?.updatedAt??'')),state:String(state?.name??'')}
 }
 if(!['jira:issue_created','jira:issue_updated'].includes(String(payload.webhookEvent)))throw new NativeError('tracker_event_refused',422)
 const fields=issue?.fields as Record<string,unknown>,project=fields?.project as Record<string,unknown>,status=fields?.status as Record<string,unknown>
 return {deliveryId:request.headers.get('X-Atlassian-Webhook-Identifier')??'',externalId:String(issue?.id??''),project:String(project?.id??''),updated:Date.parse(String(fields?.updated??'')),state:String(status?.name??'')}
}
export async function receiveTracker(runtime:PennyRuntime,request:Request,id:string) {
 const connection=await trackerConnection(runtime,id),raw=await boundedRawBody(request)
 let receipt:StateReceipt
 try{receipt=shape(await verify(request,raw,connection),request,connection)}catch(error){if(error instanceof NativeError)throw error;throw new NativeError('validation_failed',400)}
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(receipt.deliveryId)||!receipt.externalId||receipt.project!==connection.project_identity||!Number.isFinite(receipt.updated)||!receipt.state.trim()||receipt.state.length>160)throw new NativeError('tracker_event_refused',422)
 const fingerprint=await sha256(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(raw)),db=runtime.database.binding
 const previous=await db.prepare('SELECT fingerprint FROM penny_tracker_receipts WHERE connection_id=? AND (delivery_id=? OR fingerprint=?)').bind(id,receipt.deliveryId,fingerprint).first<{fingerprint:string}>()
 if(previous){if(previous.fingerprint!==fingerprint)throw new NativeError('tracker_replay_conflict',409);return {duplicate:true}}
 const link=await db.prepare('SELECT id,source_updated_at,state_fingerprint FROM penny_tracker_links WHERE connection_id=? AND external_id=? AND project_identity=?').bind(id,receipt.externalId,receipt.project).first<{id:string;source_updated_at:number;state_fingerprint:string}>()
 if(!link)throw new NativeError('tracker_link_unavailable',404)
 const stateHash=await sha256(JSON.stringify([receipt.externalId,receipt.project,receipt.updated,receipt.state]))
 if(receipt.updated===link.source_updated_at&&link.state_fingerprint&&stateHash!==link.state_fingerprint)throw new NativeError('tracker_source_conflict',409)
 const disposition=receipt.updated<link.source_updated_at?'older':receipt.updated===link.source_updated_at?'same':'applied'
 const guard={sql:`EXISTS(SELECT 1 FROM penny_tracker_connections c JOIN oa_operators o ON o.id=c.native_operator_id WHERE c.id=? AND c.revoked_at IS NULL AND o.status='active' AND o.version=c.operator_version) AND EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle') AND EXISTS(SELECT 1 FROM penny_tracker_links WHERE id=? AND source_updated_at=? AND state_fingerprint=?) AND NOT EXISTS(SELECT 1 FROM penny_tracker_receipts WHERE connection_id=? AND (delivery_id=? OR fingerprint=?))`,params:[id,link.id,link.source_updated_at,link.state_fingerprint,id,receipt.deliveryId,fingerprint]}
 try{await guardedDatabase(db,guard).batch([
  db.prepare('UPDATE penny_tracker_links SET state=?,source_updated_at=?,state_fingerprint=? WHERE id=? AND source_updated_at<?').bind(receipt.state,receipt.updated,stateHash,link.id,receipt.updated),
  db.prepare('INSERT INTO penny_tracker_receipts(connection_id,delivery_id,fingerprint,link_id,source_updated_at,disposition,received_at) VALUES(?,?,?,?,?,?,?)').bind(id,receipt.deliveryId,fingerprint,link.id,receipt.updated,disposition,Date.now()),
 ])}catch(error){
  const raced=await db.prepare('SELECT fingerprint FROM penny_tracker_receipts WHERE connection_id=? AND (delivery_id=? OR fingerprint=?)').bind(id,receipt.deliveryId,fingerprint).first<{fingerprint:string}>()
  if(raced?.fingerprint===fingerprint)return {duplicate:true}
  if(raced)throw new NativeError('tracker_replay_conflict',409)
  if(error instanceof NativeError&&error.code==='integration_authority_changed')throw new NativeError('tracker_receipt_conflict',409)
  throw error
 }
 return {processed:true,disposition}
}
