import {D1SqlDatabase} from '../../../../base/modules/integrations/core/database.ts'
import {IntegrationsRepository} from '../../../../base/modules/integrations/core/repository.ts'
import {TokenService} from '../../../../base/modules/integrations/core/tokens.ts'
import {sha256} from '../../../../base/modules/integrations/core/crypto.ts'
import type {Session} from '../../../../base/modules/operator-auth/index.mjs'
import type {PennyRuntime} from '@/core/app/runtime'
import {operatorAuth,authenticateOperator} from '../auth/operator'
import {NativeError} from '../auth/native-tokens'
import {devAdmitted} from '../auth/dev-admission'
import {guardedDatabase,type AuthorityGuard} from './guarded-database'
import {createUlid} from '@/core/shared/ulid'

export const apiScopes=['requests:read','requests:write','comments:read','comments:write','status:read','status:write','releases:read','releases:write','votes:write'] as const
const namespace='penny-api'
export function sessionReadGuard(session:Session):AuthorityGuard {
 return {sql:`EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id WHERE s.id=? AND s.operator_id=? AND s.revoked_at IS NULL AND s.expires_at>unixepoch('subsec')*1000 AND o.status='active' AND o.version=s.operator_version AND o.version=?)`,params:[session.id,session.operatorId,session.operator.version]}
}
export function sessionGuard(session:Session):AuthorityGuard {
 const guard=sessionReadGuard(session)
 return {...guard,sql:`${guard.sql} AND EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle')`}
}
export async function managedKeys(runtime:PennyRuntime,request:Request,issuing=false) {
 if(request.method!=='GET'&&request.headers.get('Origin')!==runtime.configuration.appOrigin)throw new NativeError('forbidden_origin',403)
 const session=await operatorAuth(runtime).getSession(request)
 if(!session)throw new NativeError('unauthenticated',401)
 const actor=await authenticateOperator(runtime,request);if(!actor)throw new NativeError('unauthenticated',401)
 const guard=sessionGuard(session),db=runtime.database.binding
 const connection=guardedDatabase(db,guard,()=>issuing?[
  // A token minted in a local dev session is recorded as dev-minted (migration 0029).
  db.prepare('INSERT INTO penny_api_issuance(singleton,native_operator_id,operator_version,actor_id,dev) VALUES (1,?,?,?,?)').bind(session.operatorId,session.operator.version,actor.id,session.kind==='dev'?1:0),
 ]:[])
 const sql=new D1SqlDatabase(connection)
 const guarded={batch:async(input:Parameters<typeof sql.batch>[0])=>{
  if(!issuing)return sql.batch(input)
  // Base's issuing batch inserts the token first; its audit row is written only
  // when that guarded insert produced the token, attributed to the issuing operator.
  // A dev-session key never leaves the checkout, so no audit row names it.
  const token=input.find(statement=>statement.sql.startsWith('INSERT INTO integration_tokens'))?.params?.[1]
  if(typeof token!=='string')throw new Error('PENNY_KEY_ISSUANCE_UNRECOGNIZED')
  const now=new Date().toISOString(),audit={sql:"INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) SELECT ?,'operator',i.actor_id,'integration.key_issued','integration_key',t.id,?,?,? FROM integration_tokens t JOIN penny_api_issuance i ON i.singleton=1 WHERE i.dev=0 AND t.namespace=? AND t.id=?",params:[createUlid(),now,now,now,namespace,token]}
  const result=await sql.batch([...input,audit,{sql:'DELETE FROM penny_api_issuance WHERE singleton=1'}]);return result.slice(0,-2)
 }}
 return new TokenService(new IntegrationsRepository(guarded,namespace),{
  grant:async()=>({scopes:apiScopes,commitGuard:{sql:`SELECT 1 WHERE ${guard.sql}`,params:guard.params}}),
  administer:async()=>{if(!(await db.prepare(`SELECT (${guard.sql}) allowed`).bind(...guard.params).first<number>('allowed')))throw new NativeError('unauthenticated',401)},
 })
}
export async function apiAuthority(runtime:PennyRuntime,request:Request,scope:typeof apiScopes[number],resource:string) {
 const header=request.headers.get('Authorization')??''
 if(!/^Bearer int_[a-f0-9]{64}$/.test(header))throw new NativeError('integration_token_required',401)
 const token=header.slice(7),hash=await sha256(token),db=runtime.database.binding
 const service=new TokenService(new IntegrationsRepository(new D1SqlDatabase(db),namespace),{
  grant:async()=>{throw new NativeError('integration_namespace_denied',403)},administer:async()=>{throw new NativeError('integration_namespace_denied',403)},
 })
 const metadata=await service.authorize(token,[scope],{requestId:crypto.randomUUID(),resource})
 if(!metadata)throw new NativeError('integration_token_denied',401)
 // A dev-minted token counts only on a request that passes the local key gate;
 // a deployed Worker never registers that gate, so there it is always refused.
 const dev=await db.prepare("SELECT 1 FROM oa_dev_credentials WHERE credential='integration_tokens' AND id=?").bind(metadata.id).first()
 if(dev&&!await devAdmitted(request))throw new NativeError('integration_token_denied',401)
 const guard:AuthorityGuard={sql:`EXISTS(SELECT 1 FROM integration_tokens t JOIN penny_api_issuers i ON i.token_id=t.id JOIN oa_operators o ON o.id=i.native_operator_id WHERE t.namespace=? AND t.id=? AND t.token_hash=? AND t.revoked_at IS NULL AND (t.expires_at IS NULL OR t.expires_at>unixepoch('subsec')*1000) AND ? IN(SELECT value FROM json_each(t.scopes)) AND o.status='active' AND o.version=i.operator_version AND EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle'))`,params:[namespace,metadata.id,hash,scope]}
 const actor=await db.prepare(`SELECT p.id,p.display_name AS displayName FROM penny_api_issuers i JOIN operators p ON p.id=i.actor_id WHERE i.token_id=? AND (${guard.sql})`).bind(metadata.id,...guard.params).first<{id:string;displayName:string}>()
 if(!actor)throw new NativeError('integration_token_denied',401)
 return {actor,database:{binding:guardedDatabase(db,guard)}}
}
