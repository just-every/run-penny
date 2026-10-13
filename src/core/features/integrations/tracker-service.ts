import {z} from 'zod'
import {sha256} from '../../../../base/modules/integrations/core/crypto.ts'
import type {PennyRuntime} from '@/core/app/runtime'
import {integrationOperator} from './destinations'
import {trackerConnection} from './tracker-configuration'
import {createBody,issueUrl} from './tracker-protocol'
import {trackerDelivery,trackerNamespace,type TrackerCommand} from './tracker-delivery'
import {NativeError} from '../auth/native-tokens'
import {guardedDatabase} from './guarded-database'
import {sessionGuard} from './keys'
const subject={requestId:z.string().min(1).max(128).optional(),decisionId:z.string().min(1).max(128).optional()}
const exactlyOne=(input:{requestId?:string;decisionId?:string})=>Boolean(input.requestId)!==Boolean(input.decisionId)
export const trackerLinkInput=z.object({...subject,connectionId:z.uuid(),externalId:z.string().min(1).max(128),url:z.string().max(500)}).strict().refine(exactlyOne)
export const trackerCreateInput=z.object({...subject,connectionId:z.uuid(),title:z.string().trim().min(1).max(280),description:z.string().trim().min(1).max(20000),operationKey:z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)}).strict().refine(exactlyOne)
async function subjectExists(db:D1Database,input:{requestId?:string;decisionId?:string}) {
 if(!await db.prepare('SELECT 1 FROM '+(input.requestId?'requests':'decisions')+' WHERE id=?').bind(input.requestId??input.decisionId).first())throw new NativeError('not_found',404)
}
export async function linkTracker(runtime:PennyRuntime,request:Request,input:z.infer<typeof trackerLinkInput>,commandId?:string) {
 const {session}=await integrationOperator(runtime,request),connection=await trackerConnection(runtime,input.connectionId)
 const guard=sessionGuard(session)
 guard.sql+=` AND EXISTS(SELECT 1 FROM penny_tracker_connections c JOIN oa_operators o ON o.id=c.native_operator_id WHERE c.id=? AND c.revoked_at IS NULL AND o.status='active' AND o.version=c.operator_version)`;guard.params.push(connection.id)
 const db=guardedDatabase(runtime.database.binding,guard)
 await subjectExists(db,input)
 if(connection.provider==='linear'?!z.uuid().safeParse(input.externalId).success:!/^\d+$/.test(input.externalId))throw new NativeError('tracker_identity_refused',422)
 const url=issueUrl(connection.provider,input.url,connection.site_origin)
 const prior=await db.prepare('SELECT * FROM penny_tracker_links WHERE connection_id=? AND external_id=?').bind(connection.id,input.externalId).first<{id:string;request_id:string|null;decision_id:string|null;issue_url:string}>()
 if(prior&&(prior.request_id!==(input.requestId??null)||prior.decision_id!==(input.decisionId??null)||prior.issue_url!==url))throw new NativeError('tracker_link_conflict',409)
 if(prior&&!commandId)return {id:prior.id,repeat:true}
 const id=prior?.id??crypto.randomUUID()
 const statements=prior?[]:[db.prepare("INSERT INTO penny_tracker_links(id,request_id,decision_id,connection_id,provider,project_identity,external_id,issue_url,state,created_at) VALUES(?,?,?,?,?,?,?,?,'linked',?)").bind(id,input.requestId??null,input.decisionId??null,connection.id,connection.provider,connection.project_identity,input.externalId,url,Date.now())]
 if(commandId){
  const command=await db.prepare('SELECT * FROM penny_tracker_commands WHERE id=?').bind(commandId).first<TrackerCommand>()
  if(!command||command.connection_id!==connection.id||command.request_id!==(input.requestId??null)||command.decision_id!==(input.decisionId??null)||(command.link_id&&command.link_id!==id))throw new NativeError('tracker_command_conflict',409)
  statements.push(db.prepare('UPDATE penny_tracker_commands SET link_id=? WHERE id=? AND link_id IS NULL').bind(id,commandId))
  statements.push(db.prepare("INSERT INTO integration_resolutions(namespace,id,delivery_id,at,outcome) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM integration_deliveries WHERE namespace=? AND id=? AND state='uncertain')").bind(trackerNamespace,crypto.randomUUID(),commandId,Date.now(),JSON.stringify({kind:'accepted',code:'operator_known_issue'}),trackerNamespace,commandId))
  statements.push(db.prepare("UPDATE integration_deliveries SET state='accepted' WHERE namespace=? AND id=? AND state='uncertain'").bind(trackerNamespace,commandId))
 }
 await db.batch(statements)
 return {id}
}
export async function createTracker(runtime:PennyRuntime,request:Request,input:z.infer<typeof trackerCreateInput>) {
 const {session}=await integrationOperator(runtime,request),connection=await trackerConnection(runtime,input.connectionId)
 const guard=sessionGuard(session)
 guard.sql+=` AND EXISTS(SELECT 1 FROM penny_tracker_connections c JOIN oa_operators o ON o.id=c.native_operator_id WHERE c.id=? AND c.revoked_at IS NULL AND o.status='active' AND o.version=c.operator_version)`;guard.params.push(connection.id)
 const db=guardedDatabase(runtime.database.binding,guard)
 if(!connection.api_token||!runtime.bindings.PENNY_EGRESS)throw new NativeError('tracker_creation_unconfigured',503)
 await subjectExists(db,input)
 const body=createBody(connection,input.title,input.description),hash=await sha256(JSON.stringify([input.requestId??null,input.decisionId??null,input.connectionId,body]))
 const prior=await db.prepare('SELECT * FROM penny_tracker_commands WHERE operation_key=?').bind(input.operationKey).first<TrackerCommand>()
 if(prior){if(prior.body_hash!==hash)throw new NativeError('tracker_command_conflict',409);return {id:prior.id,linkId:prior.link_id,repeat:true}}
 const id=crypto.randomUUID()
 await db.prepare('INSERT INTO penny_tracker_commands(id,request_id,decision_id,connection_id,native_operator_id,operator_version,operation_key,body_hash,body_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,input.requestId??null,input.decisionId??null,input.connectionId,session.operatorId,session.operator.version,input.operationKey,hash,body,Date.now()).run()
 const delivery=trackerDelivery(runtime)
 await delivery.enqueue({id,tenant:trackerNamespace,destinationId:connection.id,event:'issue.create',protocol:'tracker.create.v1',body})
 return {id,state:'queued'}
}
