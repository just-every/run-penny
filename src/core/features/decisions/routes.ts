import { loopMutation } from '@/core/app/loop-mutation'
import type { Hono } from 'hono'
import { z } from 'zod'
import { parseMutationBody,type OperatorMutationEnvironment } from '@/core/app/operator-mutations'
import { createDecision,editDecision,saveBet } from './write-service'
import { commitDecision } from './commit'
import { decisionDatabase } from './authority'
import { decisionHistory,decisionPostRelease } from './history'
import { reviewDecision } from './reviews'
const optionalText=z.string().max(20000).nullable().optional()
const confidence=z.enum(['low','medium','high']).nullable().optional()
const decisionInput=z.object({question:z.string().max(1000),ownerOperatorId:optionalText,confidence,reviewAt:optionalText}).strict()
const betInput=z.object({title:z.string().trim().min(1).max(280),summary:z.string().trim().min(1).max(20000),urgency:optionalText,deliveryShape:optionalText,successMeasure:optionalText}).strict()
const commitInput=z.object({selectedCandidateBetId:optionalText,rationale:optionalText,ownerOperatorId:optionalText,confidence,reviewAt:optionalText,noViableAlternativeReason:optionalText}).strict()
export function registerDecisionRoutes(app:Hono<OperatorMutationEnvironment>){
 app.post('/api/operator/decisions',c=>loopMutation(c,async(actor,now)=>{const input=await parseMutationBody(c,decisionInput);if(!input)return c.json({error:'validation_failed'},400);return c.json(await createDecision(c.get('runtime').database.binding,input,actor,now),201)}))
 app.patch('/api/operator/decisions/:id',c=>loopMutation(c,async(actor,now)=>{const input=await parseMutationBody(c,decisionInput);if(!input)return c.json({error:'validation_failed'},400);await editDecision(c.get('runtime').database.binding,c.req.param('id'),input,actor,now);return c.json({ok:true})}))
 app.post('/api/operator/decisions/:id/bets',c=>loopMutation(c,async(actor,now)=>{const input=await parseMutationBody(c,betInput);if(!input)return c.json({error:'validation_failed'},400);return c.json(await saveBet(c.get('runtime').database.binding,c.req.param('id'),null,input,actor,now),201)}))
 app.patch('/api/operator/decisions/:id/bets/:bet',c=>loopMutation(c,async(actor,now)=>{const input=await parseMutationBody(c,betInput);if(!input)return c.json({error:'validation_failed'},400);return c.json(await saveBet(c.get('runtime').database.binding,c.req.param('id'),c.req.param('bet'),input,actor,now))}))
 app.post('/api/operator/decisions/:id/commit',c=>loopMutation(c,async(actor,now)=>{const input=await parseMutationBody(c,commitInput);if(!input)return c.json({error:'validation_failed'},400);return c.json(await commitDecision(c.get('runtime').database.binding,c.req.param('id'),input,actor,now))}))
 const revisionInput=commitInput.extend({expectedRevision:z.number().int().positive()}).strict()
 app.post('/api/operator/decisions/:id/revisions',c=>loopMutation(c,async(actor,now)=>{
  const input=await parseMutationBody(c,revisionInput);if(!input)return c.json({error:'validation_failed'},400)
  return c.json(await commitDecision(await decisionDatabase(c.get('runtime'),c.req.raw),c.req.param('id'),input,actor,now,{expectedRevision:input.expectedRevision}),201)
 }))
 app.post('/api/operator/decisions/:id/reviews',c=>loopMutation(c,async(actor,now)=>{
  const input=await parseMutationBody(c,z.object({note:z.string().trim().min(1).max(20000),reviewAt:z.string().optional(),revision:revisionInput.optional()}).strict().refine(value=>Boolean(value.reviewAt)!==Boolean(value.revision)))
  if(!input)return c.json({error:'validation_failed'},400)
  return c.json(await reviewDecision(await decisionDatabase(c.get('runtime'),c.req.raw),c.req.param('id'),input,actor,now),201)
 }))
 app.get('/api/operator/decisions/:id/history',c=>loopMutation(c,async()=>c.json(await decisionHistory(c.get('runtime').database.binding,c.req.param('id')))))
 app.get('/api/operator/decisions/:id/post-release',c=>loopMutation(c,async()=>c.json(await decisionPostRelease(c.get('runtime').database.binding,c.req.param('id')))))
 app.get('/api/operator/loop/options',c=>loopMutation(c,async()=>{
 const db=c.get('runtime').database.binding
 const [operators,accounts,boards,requests,bets,decisions]=await Promise.all([
 db.prepare('SELECT id,display_name AS label FROM operators ORDER BY display_name').all(),db.prepare('SELECT id,name AS label FROM accounts ORDER BY name').all(),db.prepare('SELECT slug AS id,name AS label,visibility FROM boards WHERE archived_at IS NULL ORDER BY position,name').all(),db.prepare(`SELECT r.id,r.title AS label,r.slug,r.published_at AS publishedAt,(r.moderation_state='approved' AND r.published_at IS NOT NULL AND r.withdrawn_at IS NULL AND b.visibility='public' AND (a.id IS NULL OR a.blocked_at IS NULL)) AS publiclyVisible FROM requests r JOIN boards b ON b.id=r.board_id LEFT JOIN requesters a ON a.id=r.author_requester_id WHERE r.merged_into_request_id IS NULL ORDER BY r.title`).all(),db.prepare('SELECT b.id,d.title||\' — \'||b.title AS label FROM candidate_bets b JOIN decisions d ON d.id=b.decision_id ORDER BY d.title,b.title').all(),db.prepare('SELECT id,title AS label FROM decisions ORDER BY title').all()])
 return c.json({operators:operators.results,accounts:accounts.results,boards:boards.results,requests:requests.results,bets:bets.results,decisions:decisions.results})
 }))
}
