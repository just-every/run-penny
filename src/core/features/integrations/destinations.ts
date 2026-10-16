import {integrationAvailable} from './transport'
import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {operatorAuth,operatorSession,authenticateOperator} from '../auth/operator'
import {NativeError} from '../auth/native-tokens'
import {guardedDatabase} from './guarded-database'
import {sessionGuard} from './keys'
import {validateDestination} from '../../../../base/modules/integrations/core/destination.ts'
import {integrationEvents} from './event-policy'
export {integrationEvents}
export const destinationInput=z.object({name:z.string().trim().min(1).max(100),kind:z.enum(['webhook','slack','receiver']),endpoint:z.string().max(4096),events:z.array(z.enum(integrationEvents)).max(4)}).strict()
export interface Destination {id:string;name:string;kind:'webhook'|'slack'|'receiver';events_json:string;native_operator_id:string;operator_version:number;actor_id:string;created_at:number;revoked_at:number|null}
export async function integrationOperator(runtime:PennyRuntime,request:Request) {
 if(request.method!=='GET'&&request.headers.get('Origin')!==runtime.configuration.appOrigin)throw new NativeError('forbidden_origin',403)
 const session=await (request.method==='GET'?operatorSession(runtime,request):operatorAuth(runtime).getSession(request)),actor=await authenticateOperator(runtime,request)
 if(!session||!actor)throw new NativeError('unauthenticated',401)
 return {session,actor,db:guardedDatabase(runtime.database.binding,sessionGuard(session))}
}
export async function createDestination(runtime:PennyRuntime,request:Request,input:z.infer<typeof destinationInput>) {
 const {db,session,actor}=await integrationOperator(runtime,request)
 let endpoint=''
 if(input.kind!=='receiver'){
  try{endpoint=validateDestination(input.endpoint).href}catch{throw new NativeError('integration_destination_refused',422)}
  const url=new URL(endpoint)
  if(input.kind==='slack'&&(url.hostname!=='hooks.slack.com'||url.search||!/^\/services\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(url.pathname)))throw new NativeError('integration_destination_refused',422)
  if(!input.events.length)throw new NativeError('integration_events_required',422)
 }else if(input.endpoint||input.events.length)throw new NativeError('integration_receiver_configuration_refused',422)
 const id=crypto.randomUUID(),key=input.kind==='slack'?null:Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('')
 await db.batch([
  db.prepare('INSERT INTO penny_integration_destinations(id,name,kind,events_json,native_operator_id,operator_version,actor_id,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,input.name,input.kind,JSON.stringify([...new Set(input.events)]),session.operatorId,session.operator.version,actor.id,Date.now()),
  db.prepare('INSERT INTO penny_integration_credentials(id,endpoint,signing_key) VALUES(?,?,?)').bind(id,endpoint,key),
 ])
 return {id,...(key?{signingKey:key}:{}),transport:integrationAvailable(runtime)?'configured':'configuration-disabled',...(input.kind==='receiver'?{path:'/api/integrations/webhooks/'+id}:{})}
}
export async function destination(runtime:PennyRuntime,id:string,kind?:Destination['kind']) {
 const row=await runtime.database.binding.prepare(`SELECT d.*,c.endpoint,c.signing_key FROM penny_integration_destinations d JOIN penny_integration_credentials c ON c.id=d.id JOIN oa_operators o ON o.id=d.native_operator_id WHERE d.id=? AND d.revoked_at IS NULL AND o.status='active' AND o.version=d.operator_version`).bind(id).first<Destination&{endpoint:string;signing_key:string|null}>()
 if(!row||(kind&&row.kind!==kind))throw new NativeError('integration_destination_unavailable',409)
 return row
}
export const keyBytes=(key:string)=>Uint8Array.from(key.match(/../g)!,value=>parseInt(value,16))
