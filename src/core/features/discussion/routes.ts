import type { Hono } from 'hono'
import { z } from 'zod'
import { loopMutation } from '@/core/app/loop-mutation'
import { parseMutationBody,type OperatorMutationEnvironment } from '@/core/app/operator-mutations'
import { decisionDatabase } from '../decisions/authority'
import { addInternalNote,activeOperators,mentionNotices } from './service'
const input=z.object({body:z.string().trim().min(1).max(20000),parentNoteId:z.string().min(1).nullable().optional(),mentionOperatorIds:z.array(z.string().min(1).max(200)).max(50).optional(),idempotencyKey:z.string().uuid().optional()}).strict()
export function registerDiscussionRoutes(app:Hono<OperatorMutationEnvironment>){
 app.get('/api/operator/discussion/operators',c=>loopMutation(c,async()=>c.json({operators:(await (await decisionDatabase(c.get('runtime'),c.req.raw)).prepare(activeOperators).all()).results})))
 app.post('/api/operator/discussion/requests/:slug/notes',c=>loopMutation(c,async(actor,now)=>{
  const value=await parseMutationBody(c,input);if(!value)return c.json({error:'validation_failed'},400)
  return c.json(await addInternalNote(c.get('runtime').database.binding,c.req.param('slug'),actor,value,now),201)
 }))
 app.get('/api/operator/discussion/mentions',c=>loopMutation(c,async actor=>c.json({mentions:await mentionNotices(await decisionDatabase(c.get('runtime'),c.req.raw),actor)})))
 app.post('/api/operator/discussion/mentions/:id/dismiss',c=>loopMutation(c,async(actor,now)=>{
  const db=c.get('runtime').database.binding
  await db.batch([
   db.prepare('UPDATE penny_note_mentions SET dismissed_at=COALESCE(dismissed_at,?) WHERE note_id=? AND operator_id=?').bind(now,c.req.param('id'),actor),
   db.prepare("UPDATE penny_publication_schedules SET dismissed_at=COALESCE(dismissed_at,?) WHERE id=? AND author_operator_id=? AND state='failed'").bind(now,c.req.param('id'),actor),
  ])
  return c.json({ok:true})
 }))
}
