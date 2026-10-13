import type {PennyRuntime} from '@/core/app/runtime'
import {createUlid} from '@/core/shared/ulid'
import {NativeError} from '../auth/native-tokens'
import {integrationOperator} from './destinations'
import {managedKeys} from './keys'

/** Product actor custody supplements Base's feature/token event without changing
 * the adopted module. The injected prefix belongs to the same native batch. */
export async function revokeKey(runtime:PennyRuntime,request:Request,id:string){
 const {db,actor}=await integrationOperator(runtime,request),now=new Date().toISOString()
 // TokenService already commits its event and revocation in one batch. Interpose
 // an actor receipt only on that batch, not its earlier authority read.
 const binding=new Proxy(db,{get(target,key){
  if(key==='batch')return (statements:D1PreparedStatement[])=>target.batch([
   target.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at)
     SELECT ?,'operator',?,'integration.key_revoked','integration_key',id,?,?,? FROM integration_tokens WHERE namespace='penny-api' AND id=? AND revoked_at IS NULL`).bind(createUlid(),actor.id,now,now,now,id),...statements,
  ]).then(results=>results.slice(1))
  const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value
 }})
 const service=await managedKeys({...runtime,database:{binding}},request)
 await service.revoke(null,id)
}

export async function revokeConfiguration(runtime:PennyRuntime,request:Request,id:string,kind:'destination'|'tracker'){
 const {db,actor}=await integrationOperator(runtime,request),now=Date.now(),stamp=new Date(now).toISOString()
 const table=kind==='destination'?'penny_integration_destinations':'penny_tracker_connections'
 const results=await db.batch([
  db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at)
    SELECT ?,'operator',?,?,?,id,?,?,? FROM ${table} WHERE id=? AND revoked_at IS NULL`).bind(createUlid(),actor.id,'integration.'+kind+'_revoked','integration_'+kind,stamp,stamp,stamp,id),
  db.prepare(`UPDATE ${table} SET revoked_at=COALESCE(revoked_at,?) WHERE id=? RETURNING id`).bind(now,id),
 ])
 if(!results[1].results.length)throw new NativeError('not_found',404)
}
