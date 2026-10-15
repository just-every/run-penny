import type {PennyRuntime} from '@/core/app/runtime'
import {D1SqlDatabase} from '../../../../base/modules/integrations/core/database.ts'
import {IntegrationsRepository} from '../../../../base/modules/integrations/core/repository.ts'
import {DeliveryService} from '../../../../base/modules/integrations/core/delivery.ts'
import {trackerConnection} from './tracker-configuration'
import {trackerProtocol,knownIssue} from './tracker-protocol'
import {integrationTransport,integrationAvailable} from './transport'
import {guardedDatabase,type AuthorityGuard} from './guarded-database'
import {NativeError} from '../auth/native-tokens'
export const trackerNamespace='penny-trackers'
export interface TrackerCommand {id:string;request_id:string|null;decision_id:string|null;connection_id:string;native_operator_id:string;operator_version:number;operation_key:string;body_hash:string;body_json:string;link_id:string|null;created_at:number;held:number}
export function commandGuard(command:TrackerCommand):AuthorityGuard {
 return {sql:`EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND version=?) AND EXISTS(SELECT 1 FROM penny_tracker_connections c JOIN oa_operators o ON o.id=c.native_operator_id WHERE c.id=? AND c.revoked_at IS NULL AND o.status='active' AND o.version=c.operator_version) AND EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle') AND (EXISTS(SELECT 1 FROM requests WHERE id=?) OR EXISTS(SELECT 1 FROM decisions WHERE id=?)) AND EXISTS(SELECT 1 FROM penny_tracker_commands WHERE id=? AND held=0)`,params:[command.native_operator_id,command.operator_version,command.connection_id,command.request_id,command.decision_id,command.id]}
}
export function trackerDelivery(runtime:PennyRuntime,now:()=>number=Date.now) {
 const transport=integrationTransport(runtime),db=runtime.database.binding
 const repository=new IntegrationsRepository(new D1SqlDatabase(guardedDatabase(db,{sql:"EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle')",params:[]})),trackerNamespace)
 return new DeliveryService({repository,now,protocols:[trackerProtocol(id=>trackerConnection(runtime,id))],transport:{send:async wire=>{
  const command=await db.prepare('SELECT * FROM penny_tracker_commands WHERE id=?').bind(wire.headers['penny-delivery-id']).first<TrackerCommand>()
  if(!command)throw new NativeError('tracker_command_unavailable',409)
  const guard=commandGuard(command)
  if(!await db.prepare(`SELECT (${guard.sql}) allowed`).bind(...guard.params).first<number>('allowed'))throw new NativeError('tracker_command_unavailable',409)
  const connection=await trackerConnection(runtime,command.connection_id),response=await transport.send(wire)
  if(response.status>=200&&response.status<300){
   const issue=knownIssue(connection,response),linkId=crypto.randomUUID()
   // A storage failure after an accepted provider response is uncertain. It
   // cannot cause another create; operators reconcile the known issue explicitly.
   await guardedDatabase(db,guard).batch([
    db.prepare("INSERT INTO penny_tracker_links(id,request_id,decision_id,connection_id,provider,project_identity,external_id,issue_url,state,created_at) SELECT ?,?,?,?,?,?,?,?,'created',? WHERE EXISTS(SELECT 1 FROM penny_tracker_commands WHERE id=? AND link_id IS NULL)").bind(linkId,command.request_id,command.decision_id,connection.id,connection.provider,connection.project_identity,issue.externalId,issue.url,now(),command.id),
    db.prepare('UPDATE penny_tracker_commands SET link_id=? WHERE id=? AND link_id IS NULL').bind(linkId,command.id),
   ])
  }
  return response
 }}})
}
export async function drainTrackers(runtime:PennyRuntime,now:()=>number=Date.now) {
 if(!integrationAvailable(runtime))return {state:'configuration-disabled'}
 const delivery=trackerDelivery(runtime,now)
 const {results}=await runtime.database.binding.prepare("SELECT c.* FROM penny_tracker_commands c WHERE NOT EXISTS(SELECT 1 FROM integration_deliveries d WHERE d.namespace=? AND d.id=c.id) ORDER BY c.created_at,c.id LIMIT 100").bind(trackerNamespace).all<TrackerCommand>()
 for(const command of results){
  const guard=commandGuard(command)
  if(!await runtime.database.binding.prepare(`SELECT (${guard.sql}) allowed`).bind(...guard.params).first<number>('allowed'))continue
  await delivery.enqueue({id:command.id,tenant:trackerNamespace,destinationId:command.connection_id,event:'issue.create',protocol:'tracker.create.v1',body:command.body_json})
 }
 await delivery.dispatchDue(100)
 return {state:'configured'}
}
