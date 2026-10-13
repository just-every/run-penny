import { z } from 'zod'
import type { Hono } from 'hono'
import type { AppBindings } from '@/core/shared/bindings'
import type { PennyRuntime } from '@/core/app/runtime'
import { parseInput } from '../auth/native-routes'
import { NativeError } from '../auth/native-tokens'
import { FeedbackSourceError } from './ideas'
import { previewResponse } from './planning'
import { importAuthority,RESTORED_JOB } from './job-authority'
import { applyFeedback,feedbackJob,previewFeedback } from './service'
const file=z.object({name:z.string().min(1).max(100),kind:z.enum(['boards','users','posts','votes','comments','tags','merges']),version:z.enum(['v1','v2','classic-csv','ideas-csv','uservoice-ideas-csv','uservoice-voters-csv','relationships-v1']),base64:z.string(),boardId:z.string().optional(),tagMapping:z.record(z.string(),z.array(z.string().min(1))).optional(),ideas:z.object({key:z.string().min(1),title:z.string().min(1),details:z.string().min(1),status:z.string().min(1),created:z.string().min(1),author:z.string().min(1).optional(),aggregates:z.record(z.string(),z.enum(['count','company','revenue'])).optional(),omissions:z.array(z.string().min(1)).optional()}).strict().optional(),uservoice:z.object({scope:z.enum(['complete','filtered']).optional(),filter:z.string().min(1).max(1000).optional(),headings:z.record(z.string(),z.string().min(1)).optional(),forums:z.record(z.string(),z.string().min(1)).optional(),omissions:z.array(z.string().min(1)).optional()}).strict().optional()}).strict()
const source=z.object({namespace:z.string().min(1).max(80),files:z.array(file).min(1).max(30),statuses:z.record(z.string(),z.enum(['open','under_review','planned','in_progress','shipped','declined'])),boards:z.array(z.object({id:z.string(),name:z.string(),isPrivate:z.boolean(),created:z.string()}).strict()).optional()}).strict()
type Environment={Bindings:AppBindings;Variables:{runtime:PennyRuntime}}
export function registerFeedbackImportRoutes(app:Hono<Environment>):void {
 app.use('/api/operator/feedback-import/*',async(c,next)=>{c.header('Cache-Control','private, no-store');try{await next()}catch(error){
  if(error instanceof FeedbackSourceError)return c.json({error:'feedback_import_refused',reason:error.code,message:error.message,omissions:error.headings},422)
  if(error instanceof NativeError)throw error
  const code=error&&typeof error==='object'&&'code' in error?String(error.code):error instanceof Error&&/^[A-Z0-9_]+$/.test(error.message)?error.message:'FEEDBACK_SOURCE_INVALID'
  return c.json({error:'feedback_import_refused',reason:code},409)
 }})
 app.get('/api/operator/feedback-import/jobs',async c=>{
  const authority=await importAuthority(c.get('runtime'),c.req.raw)
  const result=await c.env.DB.prepare(`WITH progress AS (SELECT p.stream_id,SUM(j.checkpoint) checkpoint,MIN(j.state='completed') completed,MIN(j.state IN ('undone','rolled_back')) undone FROM ik_d1_stream_pages p JOIN ik_jobs j ON j.id=p.job_id GROUP BY p.stream_id)
   SELECT j.id,CASE WHEN scan.job_id IS NOT NULL THEN 'preflighting' WHEN s.id IS NULL THEN j.state WHEN b.sealed IS NOT 1 THEN 'originals_incomplete' WHEN s.state='undoing' THEN CASE WHEN p.undone THEN 'undone' ELSE 'undoing' END WHEN p.completed THEN 'completed' ELSE 'applying' END state,COALESCE(p.checkpoint,j.checkpoint) checkpoint,COALESCE(s.total,j.total) total
   FROM ik_jobs j LEFT JOIN ik_d1_streams s ON s.id=j.id LEFT JOIN progress p ON p.stream_id=j.id LEFT JOIN feedback_import_bundles b ON b.id=j.id LEFT JOIN feedback_import_reversal_scans scan ON scan.job_id=j.id
   WHERE (j.principal_id=? OR (?=1 AND ${RESTORED_JOB})) AND NOT EXISTS(SELECT 1 FROM ik_d1_stream_pages child WHERE child.job_id=j.id AND child.stream_id!=j.id) ORDER BY j.rowid DESC LIMIT 101`).bind(authority.operatorId,authority.owner?1:0).all()
  if(result.results.length>100)throw new NativeError('feedback_job_list_limit',413)
  return c.json(result.results)
 })
 app.post('/api/operator/feedback-import/preview',async c=>{
  try{const input=await parseInput(c.req.raw,source,34*1024*1024),plan=await previewFeedback(c.get('runtime'),c.req.raw,input)
  return c.json(previewResponse(plan))}catch(error){if(error instanceof FeedbackSourceError)return c.json({error:'feedback_import_refused',message:error.message,omissions:error.headings},422);throw error}
 })
 app.post('/api/operator/feedback-import/apply',async c=>{try{const input=await parseInput(c.req.raw,z.object({source,fingerprint:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),34*1024*1024);const job=await applyFeedback(c.get('runtime'),c.req.raw,input.source,input.fingerprint);return c.json(job,job.state==='completed'?200:202)}catch(error){if(error instanceof FeedbackSourceError)return c.json({error:'feedback_import_refused',message:error.message,omissions:error.headings},422);throw error}})
 for(const action of ['resume','undo','rollback'] as const)app.post(`/api/operator/feedback-import/jobs/:id/${action}`,async c=>c.json(await feedbackJob(c.get('runtime'),c.req.raw,c.req.param('id'),action)))
 app.get('/api/operator/feedback-import/jobs/:id',async c=>c.json(await feedbackJob(c.get('runtime'),c.req.raw,c.req.param('id'),'read')))
 app.get('/api/operator/feedback-import/jobs/:id/receipt',async c=>c.json(await feedbackJob(c.get('runtime'),c.req.raw,c.req.param('id'),'receipt')))
 app.get('/api/operator/feedback-import/jobs/:id/originals',async c=>{c.header('Content-Disposition','attachment; filename="penny-import-originals.json"');return c.json(await feedbackJob(c.get('runtime'),c.req.raw,c.req.param('id'),'originals'))})
}
