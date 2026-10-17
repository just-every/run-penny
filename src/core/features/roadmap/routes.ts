import { roadmapContexts } from './read-contexts'
import { MutationError } from '@/core/app/operator-mutations'
import type { Hono } from 'hono'
import { z } from 'zod'
import { parseMutationBody,type OperatorMutationEnvironment } from '@/core/app/operator-mutations'
import { loopMutation } from '@/core/app/loop-mutation'
import { approveRoadmap,editRoadmap,moveRoadmap,withdrawRoadmap } from './write-service'
import { getOperatorRoadmapSettings, publicRoadmapSettings, saveStatusRoadmapSettings } from './status-roadmap-settings'
const nullable=z.string().max(20000).nullable()
export function registerRoadmapRoutes(app:Hono<OperatorMutationEnvironment>){
 app.get('/api/operator/settings/status-roadmap',getOperatorRoadmapSettings)
 app.put('/api/operator/settings/status-roadmap',saveStatusRoadmapSettings)
 app.get('/api/public/roadmap/settings',async c=>{c.header('Cache-Control','no-store');return c.json(await publicRoadmapSettings(c.get('runtime').database.binding))})
 app.get('/api/operator/roadmap/:id/context',c=>loopMutation(c,async()=>{
 const db=c.get('runtime').database.binding,id=c.req.param('id')
 const contexts=await roadmapContexts(db,[id]),context=contexts[id]
 if(!context)throw new MutationError(404,'Roadmap item not found.')
 return c.json(context)
 }))
 app.patch('/api/operator/roadmap/:id',c=>loopMutation(c,async(actor,now)=>{const input=await parseMutationBody(c,z.object({title:z.string().trim().min(1).max(280),summary:z.string().max(20000),ownerOperatorId:nullable,targetWindow:nullable,deliveryNotes:nullable,confidence:z.enum(['low','medium','high']).nullable(),accountImpact:nullable,decisionId:nullable,candidateBetId:nullable,publicTitle:nullable,publicSummary:nullable,evidenceIds:z.array(z.string().trim().min(1)).max(100).optional()}).strict());if(!input)return c.json({error:'validation_failed'},400);await editRoadmap(c.get('runtime').database.binding,c.req.param('id'),input,actor,now);return c.json({ok:true})}))
 app.post('/api/operator/roadmap/:id/approve',c=>loopMutation(c,async(actor,now)=>{const input=await parseMutationBody(c,z.object({publicTitle:z.string().trim().min(1).max(280),publicSummary:z.string().trim().min(1).max(20000),boardSlug:z.string().trim().min(1),requestIds:z.array(z.string().min(1)).max(100)}).strict());if(!input)return c.json({error:'validation_failed'},400);await approveRoadmap(c.get('runtime').database.binding,c.req.param('id'),input,actor,now);return c.json({ok:true})}))
 app.post('/api/operator/roadmap/:id/withdraw',c=>loopMutation(c,async(actor,now)=>{await withdrawRoadmap(c.get('runtime').database.binding,c.req.param('id'),actor,now);return c.json({ok:true})}))
 app.post('/api/operator/roadmap/:id/move',c=>loopMutation(c,async(actor,now)=>{const input=await parseMutationBody(c,z.object({status:z.enum(['exploring','planned','in_progress','shipped','dropped']),reason:z.string().trim().min(1).max(2000),idempotencyKey:z.string().min(1).max(128)}).strict());if(!input)return c.json({error:'validation_failed'},400);return c.json(await moveRoadmap(c.get('runtime').database.binding,c.req.param('id'),input.status,input.reason,input.idempotencyKey,actor,now))}))
 app.get('/api/public/roadmap/:slug',async c=>{const {PublicRoadmapReadRepository}=await import('./public-read-repository');const item=(await new PublicRoadmapReadRepository(c.get('runtime').database).list()).find(i=>i.slug===c.req.param('slug'));return item?c.json(item):c.json({error:'not_found'},404)})
}
