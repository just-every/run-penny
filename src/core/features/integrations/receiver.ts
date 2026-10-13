import {z} from 'zod'
import {verifyWebhook} from '../../../../base/modules/integrations/core/webhook.ts'
import type {PennyRuntime} from '@/core/app/runtime'
import {destination,keyBytes} from './destinations'
import {guardedDatabase} from './guarded-database'
import {NativeError} from '../auth/native-tokens'
import {boundedRawBody} from './raw-body'
const note=z.object({requestId:z.string().min(1).max(128),note:z.string().trim().min(1).max(20000)}).strict()
export async function receiveWebhook(runtime:PennyRuntime,request:Request,id:string) {
 const target=await destination(runtime,id,'receiver'),raw=await boundedRawBody(request)
 let verified
 try{verified=await verifyWebhook({body:raw,headers:request.headers,key:keyBytes(target.signing_key!),tenant:'penny-inbound',destinationId:id})}catch{throw new NativeError('integration_signature_refused',401)}
 if(verified.envelope.event!=='request.note')throw new NativeError('integration_event_refused',422)
 let input:z.infer<typeof note>
 try{input=note.parse(JSON.parse(verified.envelope.body))}catch{throw new NativeError('validation_failed',400)}
 const namespace='penny-inbound:'+id,db=runtime.database.binding
 const prior=await db.prepare('SELECT fingerprint FROM penny_integration_receipts WHERE namespace=? AND id=?').bind(namespace,verified.envelope.id).first<{fingerprint:string}>()
 if(prior){if(prior.fingerprint!==verified.fingerprint)throw new NativeError('integration_replay_conflict',409);return {duplicate:true}}
 if(!await db.prepare('SELECT id FROM requests WHERE id=?').bind(input.requestId).first())throw new NativeError('not_found',404)
 const now=new Date().toISOString(),noteId=crypto.randomUUID()
 const guard={sql:`EXISTS(SELECT 1 FROM penny_integration_destinations d JOIN oa_operators o ON o.id=d.native_operator_id WHERE d.id=? AND d.revoked_at IS NULL AND d.kind='receiver' AND o.status='active' AND o.version=d.operator_version AND EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle')) AND NOT EXISTS(SELECT 1 FROM penny_integration_receipts WHERE namespace=? AND id=?)`,params:[id,namespace,verified.envelope.id]}
 try{await guardedDatabase(db,guard).batch([
  db.prepare('INSERT INTO request_notes(id,request_id,operator_id,body,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(noteId,input.requestId,target.actor_id,input.note,now,now),
  db.prepare('INSERT INTO integration_replays(namespace,id,fingerprint,envelope,received_at) VALUES(?,?,?,?,?)').bind(namespace,verified.envelope.id,verified.fingerprint,JSON.stringify(verified.envelope),verified.receivedAt),
  db.prepare('INSERT INTO penny_integration_receipts(namespace,id,fingerprint,request_id,note_id,received_at) VALUES(?,?,?,?,?,?)').bind(namespace,verified.envelope.id,verified.fingerprint,input.requestId,noteId,verified.receivedAt),
 ])}catch(error){
  const raced=await db.prepare('SELECT fingerprint FROM penny_integration_receipts WHERE namespace=? AND id=?').bind(namespace,verified.envelope.id).first<{fingerprint:string}>()
  if(raced?.fingerprint===verified.fingerprint)return {duplicate:true}
  if(raced)throw new NativeError('integration_replay_conflict',409)
  throw error
 }
 return {processed:true}
}
