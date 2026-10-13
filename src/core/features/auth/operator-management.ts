import type { PennyRuntime } from '@/core/app/runtime'
import type { Session, MailSender } from '../../../../base/modules/operator-auth/index.mjs'
import { createOperatorAuth } from '../../../../base/modules/operator-auth/index.mjs'
import { authConfig, authenticateOperator, operatorAuth } from './operator'
import { authMail } from './mail'
import { NativeError } from './native-tokens'
import { sessionGuard } from '../integrations/keys'
import { guardedDatabase } from '../integrations/guarded-database'
import { invitationDatabase } from './invitation-database'

export interface ManagedOperator { id: string; email: string; displayName: string; status: 'active'|'invited'|'inactive'; initialOwner: boolean; self: boolean; installationOwner: boolean; canSucceed: boolean }
export async function managementActor(runtime: PennyRuntime, request: Request) {
  if (request.method !== 'GET' && request.headers.get('Origin') !== runtime.configuration.appOrigin) throw new NativeError('forbidden_origin',403)
  const session = await operatorAuth(runtime).getSession(request)
  if (!session) throw new NativeError('unauthenticated',401)
  const actor = await authenticateOperator(runtime,request)
  if (!actor) throw new NativeError('unauthenticated',401)
  if ((await runtime.database.binding.prepare('SELECT phase FROM data_state WHERE singleton=1').first<{phase:string}>())?.phase !== 'idle') throw new NativeError('data_maintenance',409)
  return {session,actor}
}
function managementGuard(session:Session) {
  const guard=sessionGuard(session)
  guard.sql+=` AND EXISTS(SELECT 1 FROM oa_sessions ms WHERE ms.id=? AND (ms.kind!='oidc' OR EXISTS(
    SELECT 1 FROM oa_provider_sessions ps JOIN oa_auth_settings a ON a.singleton=1
    WHERE ps.session_id=ms.id AND a.idp_sign_in=1 AND a.generation=ps.generation)))`
  guard.params.push(session.id)
  const pin=(session as Session & {providerPin?:{id:string;issuer:string;clientId:string;linkedAt:number}}).providerPin
  if(pin){guard.sql+=" AND EXISTS(SELECT 1 FROM oa_identity_providers WHERE provider_id=? AND status='linked' AND issuer=? AND client_id=? AND linked_at=?)";guard.params.push(pin.id,pin.issuer,pin.clientId,pin.linkedAt)}
  return guard
}
export async function listManagedOperators(runtime: PennyRuntime, session: Session) {
  const rows = await guardedDatabase(runtime.database.binding,managementGuard(session)).prepare(`SELECT o.id,o.email,o.display_name AS displayName,o.status,
    EXISTS(SELECT 1 FROM oa_bootstrap b WHERE b.claim_id=o.id) AS initialOwner,
    o.id=? AS self,o.role='owner' AS installationOwner,
    EXISTS(SELECT 1 FROM oa_sessions s WHERE s.operator_id=o.id AND s.kind IN ('native','oidc','password')) AS canSucceed FROM oa_operators o ORDER BY o.created_at,o.id`).bind(session.operatorId).all<Omit<ManagedOperator,'initialOwner'|'self'|'installationOwner'|'canSucceed'>&{initialOwner:number;self:number;installationOwner:number;canSucceed:number}>()
  return rows.results.map(row=>({...row,initialOwner:Boolean(row.initialOwner),self:Boolean(row.self),installationOwner:Boolean(row.installationOwner),canSucceed:Boolean(row.canSucceed)}))
}
function audit(db:D1Database,actor:string,action:string,target:string,details:Record<string,unknown>={}) {
  const now=new Date().toISOString()
  return db.prepare('INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,details_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),'operator',actor,action,'operator',target,now,JSON.stringify(details),now,now)
}
export async function inviteOperator(runtime:PennyRuntime, request:Request, input:{email:string}, session:Session) {
  const db=runtime.database.binding, sender=authMail(runtime)
  if (!sender) throw new NativeError('mail_unavailable',503)
  const guarded=invitationDatabase(guardedDatabase(db,managementGuard(session)))
  // Base owns issuance, dev provenance, confirmation and token/issuer races.
  // Record the transport result independently of raw mail/credential content.
  const mailSender:MailSender={send:async message=>{
    let result:Awaited<ReturnType<MailSender['send']>>
    try { result=await sender.send(message) } catch { result={status:'uncertain',provider:'mail',providerMessageId:null} }
    const token=await db.prepare('SELECT operator_id AS target,issuer_id AS actor FROM oa_tokens WHERE id=?').bind(message.deliveryId).first<{target:string;actor:string}>()
    if(token) await audit(db,token.actor,'operator.invitation_delivery',token.target,{deliveryId:message.deliveryId,outcome:result.status}).run()
    return result
  }}
  const auth=createOperatorAuth({db:guarded,config:authConfig(runtime),mailSender,
    clientIp:r=>r.headers.get('CF-Connecting-IP')??(['local','test'].includes(runtime.configuration.environment)?'local':''),rolePolicy:()=>true})
  // Presentation has Base's shorter name limit; never truncate the address
  // used for identity and delivery to satisfy that independent constraint.
  return auth.invite(request,{email:input.email,displayName:input.email.split('@')[0].slice(0,120),role:'member',returnTo:'/app'})
}
export async function removeOperator(runtime:PennyRuntime, session:Session, targetId:string) {
  const db=runtime.database.binding
  const target=await db.prepare(`SELECT o.id,o.version,o.status,o.role,EXISTS(SELECT 1 FROM oa_bootstrap b WHERE b.claim_id=o.id) AS initialOwner FROM oa_operators o WHERE o.id=?`).bind(targetId).first<{id:string;version:number;status:string;role:string;initialOwner:number}>()
  if(!target)throw new NativeError('operator_not_found',404)
  if(target.initialOwner && target.id!==session.operatorId)throw new NativeError('initial_owner_self_removal_only',403)
  if(target.status==='inactive')throw new NativeError('operator_already_removed',409)
  const successor=target.role==='owner' ? await db.prepare(`SELECT id,version FROM oa_operators WHERE id!=? AND status='active'
    AND EXISTS(SELECT 1 FROM oa_sessions s WHERE s.operator_id=oa_operators.id AND s.kind IN ('native','oidc','password')) ORDER BY created_at,id LIMIT 1`).bind(targetId).first<{id:string;version:number}>():null
  if(target.role==='owner' && !successor)throw new NativeError('another_verified_operator_required',409)
  const guard=managementGuard(session)
  guard.sql+=' AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND version=? AND status=?) AND NOT EXISTS(SELECT 1 FROM oa_bootstrap WHERE claim_id=? AND claim_id!=?)'
  guard.params.push(target.id,target.version,target.status,target.id,session.operatorId)
  if(successor){guard.sql+=" AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND version=? AND status='active')";guard.params.push(successor.id,successor.version)}
  const safe=guardedDatabase(db,guard),now=Date.now(),statements:D1PreparedStatement[]=[]
  if(successor){
    statements.push(audit(db,session.operatorId,'operator.installation_owner_transferred',successor.id,{previousOwner:target.id}))
    statements.push(db.prepare("UPDATE oa_operators SET role='owner' WHERE id=?").bind(successor.id))
  }
  statements.push(audit(db,session.operatorId,'operator.removed',target.id))
  statements.push(db.prepare("UPDATE oa_operators SET status='inactive' WHERE id=?").bind(target.id))
  // Preserve the inactive identity and bootstrap claim. Only a new explicit
  // invitation may restore a former member; stale cookies/links stay revoked.
  statements.push(db.prepare('INSERT INTO oa_invitation_cancellations(operator_id,operator_version) SELECT id,version FROM oa_operators WHERE id=? ON CONFLICT(operator_id) DO UPDATE SET operator_version=excluded.operator_version').bind(target.id))
  statements.push(db.prepare('UPDATE oa_sessions SET revoked_at=COALESCE(revoked_at,?) WHERE operator_id=?').bind(now,target.id))
  statements.push(db.prepare('UPDATE oa_tokens SET revoked_at=COALESCE(revoked_at,?) WHERE operator_id=? OR issuer_id=?').bind(now,target.id,target.id))
  statements.push(db.prepare('UPDATE oa_credentials SET revoked_at=COALESCE(revoked_at,?) WHERE operator_id=?').bind(now,target.id))
  statements.push(db.prepare('UPDATE integration_tokens SET revoked_at=COALESCE(revoked_at,?) WHERE id IN(SELECT token_id FROM penny_api_issuers WHERE native_operator_id=?)').bind(now,target.id))
  await safe.batch(statements)
  return {removed:true,self:target.id===session.operatorId}
}
