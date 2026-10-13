import type { Hono } from 'hono'
import { z } from 'zod'
import { parseMutationBody,type OperatorMutationEnvironment } from '@/core/app/operator-mutations'
import { evidenceMutation } from './admission'
import { registerEvidenceDetailRoutes } from './detail-routes'
import { registerAccountMutationRoutes } from '../accounts/routes'
import { recordEvidence,reviewEvidence,linkEvidence } from './write-service'
import { createDecision } from '../decisions/write-service'
import { createOperatorRequest } from '../requests/operator-context'
export function registerEvidenceRoutes(app:Hono<OperatorMutationEnvironment>){
 registerEvidenceDetailRoutes(app)
 registerAccountMutationRoutes(app)
 app.post('/api/operator/evidence',c=>evidenceMutation(c,async(actor,now,db)=>{
 const input=await parseMutationBody(c,z.object({sourceType:z.enum(['sales_call','support_conversation','interview','email','free_text']),sourceLabel:z.string().max(200).refine(s=>s.trim().length>0).nullable().optional(),wording:z.string().min(1).max(20000).refine(s=>s.trim().length>0),observedAt:z.string().min(1),namedSpeaker:z.string().max(200).refine(s=>s.trim().length>0).nullable().optional(),accountId:z.string().nullable().optional(),releaseId:z.string().min(1).nullable().optional(),requestLinks:z.array(z.object({id:z.string().min(1),stance:z.enum(['supporting','contradicting']).default('supporting')}).strict()).max(100).refine(rows=>new Set(rows.map(r=>r.id)).size===rows.length).optional(),betLinks:z.array(z.object({id:z.string().min(1),stance:z.enum(['supporting','contradicting']).default('supporting')}).strict()).max(100).refine(rows=>new Set(rows.map(r=>r.id)).size===rows.length).optional()}).strict())
 if(!input)return c.json({error:'validation_failed'},400)
 return c.json(await recordEvidence(db,input,actor,now),201)
 }))
 app.post('/api/operator/evidence/:id/review',c=>evidenceMutation(c,async(actor,now,db)=>{const input=await parseMutationBody(c,z.object({reviewed:z.boolean(),reason:z.string().max(2000).nullable().optional()}).strict());if(!input)return c.json({error:'validation_failed'},400);await reviewEvidence(db,c.req.param('id'),input.reviewed,input.reason??null,actor,now);return c.json({ok:true})}))
 for(const method of ['put','delete'] as const)app[method]('/api/operator/evidence/:id/links',c=>evidenceMutation(c,async(actor,now,db)=>{const input=await parseMutationBody(c,z.object({target:z.enum(['request','bet']),targetId:z.string().min(1),stance:z.enum(['supporting','contradicting']).default('supporting')}).strict());if(!input)return c.json({error:'validation_failed'},400);await linkEvidence(db,c.req.param('id'),input.target,input.targetId,input.stance,method==='delete',actor,now);return c.json({ok:true})}))
 app.get('/api/operator/evidence/:id/links',c=>evidenceMutation(c,async(_actor,_now,db)=>{const id=c.req.param('id');const [requests,bets]=await Promise.all([db.prepare("SELECT 'request' AS target,l.request_id AS targetId,r.title AS label,l.stance FROM request_evidence_links l JOIN requests r ON r.id=l.request_id WHERE l.evidence_id=?").bind(id).all(),db.prepare("SELECT 'bet' AS target,l.candidate_bet_id AS targetId,b.title AS label,l.stance FROM candidate_bet_evidence_links l JOIN candidate_bets b ON b.id=l.candidate_bet_id WHERE l.evidence_id=?").bind(id).all()]);return c.json([...requests.results,...bets.results])}))
 app.post('/api/operator/evidence/:id/decision',c=>evidenceMutation(c,async(actor,now,db)=>{const input=await parseMutationBody(c,z.object({question:z.string().trim().min(1).max(1000),ownerOperatorId:z.string().nullable().optional(),betTitle:z.string().trim().min(1).max(280),approach:z.string().trim().min(1).max(20000)}).strict());if(!input)return c.json({error:'validation_failed'},400);return c.json(await createDecision(db,{question:input.question,ownerOperatorId:input.ownerOperatorId,initialBet:{title:input.betTitle,summary:input.approach},evidenceId:c.req.param('id')},actor,now),201)}))
 app.post('/api/operator/evidence/:id/request',c=>evidenceMutation(c,async (actor,_now,db)=>{const input=await parseMutationBody(c,z.object({title:z.string().trim().min(1).max(280),description:z.string().trim().min(1).max(20000),boardSlug:z.string().min(1)}).strict());if(!input)return c.json({error:'validation_failed'},400);return c.json(await createOperatorRequest({...c.get('runtime').database,binding:db},{...input,evidenceIds:[c.req.param('id')]},actor),201)}))
}
