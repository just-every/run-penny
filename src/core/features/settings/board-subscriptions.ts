import {z} from 'zod'
import type {Hono} from 'hono'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {integrationOperator} from '../integrations/destinations'
import {sessionGuard} from '../integrations/keys'
import {guardedDatabase} from '../integrations/guarded-database'
import {parseInput} from '../auth/native-routes'
import {NativeError} from '../auth/native-tokens'
import {createUlid} from '@/core/shared/ulid'
import {projectContributions} from '../requests/contributions'
export function registerBoardSubscriptionRoutes(app:Hono<OperatorMutationEnvironment>){
 app.put('/api/operator/boards/:slug/vote-subscriptions',async c=>{
  const runtime=c.get('runtime'),input=await parseInput(c.req.raw,z.object({enabled:z.boolean(),version:z.number().int().positive(),withdrawExisting:z.boolean().optional(),reason:z.string().trim().min(1).max(2000).optional()}).strict()),{session,actor}=await integrationOperator(runtime,c.req.raw)
  if(session.operator.role!=='owner')throw new NativeError('owner_required',403)
  if(input.withdrawExisting&&!input.reason)throw new NativeError('withdrawal_reason_required',400)
  const board=await runtime.database.binding.prepare('SELECT id FROM boards WHERE slug=? AND vote_subscription_version=?').bind(c.req.param('slug'),input.version).first<{id:string}>()
  if(!board)throw new NativeError('board_setting_changed',409)
  if(input.enabled&&!await runtime.database.binding.prepare("SELECT 1 FROM penny_mail_identity WHERE singleton=1 AND trim(postal_address)!=''").first())throw new NativeError('postal_address_required',409,'Record and confirm the business postal address in email settings before enabling vote subscriptions.')
  const guard=sessionGuard(session)
  guard.sql+=` AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner') AND EXISTS(SELECT 1 FROM boards WHERE id=? AND vote_subscription_version=?) AND (?=0 OR EXISTS(SELECT 1 FROM penny_mail_identity WHERE singleton=1 AND trim(postal_address)!=''))`
  guard.params.push(session.operatorId,board.id,input.version,Number(input.enabled))
  const db=guardedDatabase(runtime.database.binding,guard),now=new Date().toISOString()
  const roots=input.withdrawExisting?(await db.prepare("SELECT DISTINCT request_id AS id FROM requester_update_permissions WHERE board_id=? AND grant_origin='vote_subscription' AND revoked_at IS NULL").bind(board.id).all<{id:string}>()).results:[]
  await db.batch([
   db.prepare('UPDATE boards SET vote_subscriptions=?,vote_subscription_version=vote_subscription_version+1,updated_at=? WHERE id=?').bind(Number(input.enabled),now,board.id),
   ...(input.withdrawExisting?[db.prepare("UPDATE requester_update_permissions SET revoked_at=?,updated_at=? WHERE board_id=? AND grant_origin='vote_subscription' AND revoked_at IS NULL").bind(now,now,board.id),...roots.flatMap(root=>projectContributions({binding:db},[root.id]))]:[]),
   db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,details_json,occurred_at,created_at,updated_at) VALUES(?,'operator',?,'board.vote_subscriptions_changed','board',?,?,?,?,?)`).bind(createUlid(),actor.id,board.id,JSON.stringify(input),now,now,now),
  ])
  return c.json({saved:true,version:input.version+1})
 })
}
