import { loopMutation } from '@/core/app/loop-mutation'
import { decisionDatabase } from '../decisions/authority'
import { reviewNotifications } from './decision-reviews'
import { takeRateLimit } from '@/core/features/auth/native-tokens'
import { ingestMailEvents } from './mail-events'
import type { Hono } from 'hono'
import { z } from 'zod'
import type { PennyRuntime } from '@/core/app/runtime'
import type { AppBindings } from '@/core/shared/bindings'
import { requireRequesterIdentity } from '@/core/features/auth/requester'
import { authenticateOperator } from '@/core/features/auth/operator'
import { parseInput } from '@/core/features/auth/native-routes'
import { requesterWrite } from '@/core/features/requests/write-admission'
import { applyUnsubscribe, globalMuteStatement, readUnsubscribe } from './unsubscribe'
import { preferencePage, unsubscribeEndpoint } from './unsubscribe-page'
type Environment={Bindings:AppBindings;Variables:{runtime:PennyRuntime}}
const endpoint=unsubscribeEndpoint
export function registerNotificationRoutes(app:Hono<Environment>){
 app.post('/api/public/mail/events',async c=>{await takeRateLimit(c.get('runtime').database.binding,'mail_events',c.req.header('CF-Connecting-IP')??'unknown',600,60000);await ingestMailEvents(c.get('runtime'),c.req.raw);return c.json({received:true})})
 app.get(endpoint,async c=>{
  const token=c.req.query('token')??'',claims=await readUnsubscribe(c.get('runtime'),token)
  const scope=claims.scope==='all'?'all requester email':'updates for this request'
  // GET is scanner-safe. Validated tokens contain only URL-safe characters.
  return preferencePage(`Stop ${scope}`,`<p>Your follows, votes and portal access stay available.</p><form method="post" action="${endpoint}?token=${token}"><button>Unsubscribe</button></form>`)
 })
 app.post(endpoint,async c=>{
  const scope=await applyUnsubscribe(c.get('runtime'),c.req.query('token')??'')
  return preferencePage('Unsubscribed',`<p>${scope==='all'?'All requester email is muted.':'Email updates for this request are muted.'} Your follows, votes and portal access are unchanged.</p><a href="/portal/feedback/activity">Manage your preferences</a>`)
 })
 app.get('/api/public/requester/notifications',async c=>{
  const runtime=c.get('runtime'),identity=await requireRequesterIdentity(runtime,c.req.raw)
  const row=await runtime.database.binding.prepare('SELECT muted_at FROM requester_notification_preferences WHERE requester_id=?').bind(identity.requesterId).first<{muted_at:string|null}>()
  return c.json({muted:Boolean(row?.muted_at)})
 })
 app.patch('/api/public/requester/notifications',async c=>{
  const runtime=c.get('runtime'),identity=await requireRequesterIdentity(runtime,c.req.raw)
  const input=await parseInput(c.req.raw,z.object({muted:z.boolean()}).strict())
  await requesterWrite(runtime.database,identity,[globalMuteStatement(runtime.database.binding,identity.requesterId,input.muted,new Date().toISOString())])
  return c.json({muted:input.muted})
 })
 app.post('/api/operator/notifications/:id/dismiss',c=>loopMutation(c,async(actor,now)=>{
  const db=await decisionDatabase(c.get('runtime'),c.req.raw)
  const result=await db.prepare('UPDATE decision_review_notifications SET dismissed_at=COALESCE(dismissed_at,?),updated_at=? WHERE id=? AND owner_operator_id=? RETURNING 1 AS affected').bind(now,now,c.req.param('id'),actor).all()
  return result.results.length?c.json({ok:true}):c.json({error:'not_found'},404)
 }))
 app.get('/api/operator/notifications',async c=>{
  const runtime=c.get('runtime')
  const operator=await authenticateOperator(runtime,c.req.raw)
  if(!operator)return c.json({error:'operator_session_required'},401)
  const rows=await runtime.database.binding.prepare(`SELECT id,'update' AS kind,request_id AS requestId,state,provider,provider_message_id AS providerMessageId,
   attempt_count AS attemptCount,failure_reason AS failureReason,window_start AS windowStart,window_end AS windowEnd,next_attempt_at AS nextAttemptAt,updated_at AS updatedAt
   FROM notification_batches ORDER BY created_at DESC,id DESC LIMIT 100`).all()
  const rejections=await runtime.database.binding.prepare(`SELECT id,'rejection' AS kind,subject_id AS subjectId,json_extract(payload_json,'$.requestId') AS requestId,
   CASE WHEN delivery_state='queued' AND claim_id IS NOT NULL THEN 'sending' ELSE delivery_state END AS state,provider,provider_message_id AS providerMessageId,
   attempt_count AS attemptCount,failure_reason AS failureReason,NULL AS windowStart,NULL AS windowEnd,
   CASE WHEN delivery_state='queued' AND claim_id IS NULL THEN available_at END AS nextAttemptAt,updated_at AS updatedAt
   FROM notification_outbox WHERE event_type='moderation_rejected' ORDER BY created_at DESC,id DESC LIMIT 100`).all()
  c.header('Cache-Control','no-store')
  return c.json({deliveries:[...rows.results,...rejections.results],reviews:await reviewNotifications(runtime.database.binding,operator.id)})
 })
}
