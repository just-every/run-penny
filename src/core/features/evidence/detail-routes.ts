import type { Hono } from 'hono'
import { z } from 'zod'
import { parseMutationBody,type OperatorMutationEnvironment } from '@/core/app/operator-mutations'
import { readAttachment } from '../requests/mutation-boundaries'
import { requestSuggestions } from '../requests/suggestions'
import { evidenceMutation } from './admission'
import { editEvidenceWording,evidenceVersions } from './wording'
import { evidenceAttachmentResponse,listEvidenceAttachments,uploadEvidenceAttachment,recoverEvidenceAttachment,releaseEvidenceWriter } from './attachments'
export function registerEvidenceDetailRoutes(app:Hono<OperatorMutationEnvironment>){
 app.patch('/api/operator/evidence/:id/wording',c=>evidenceMutation(c,async(actor,now,db)=>{
 const input=await parseMutationBody(c,z.object({wording:z.string().trim().min(1).max(20000),expectedVersionId:z.string().min(1)}).strict())
 if(!input)return c.json({error:'validation_failed'},400)
 return c.json(await editEvidenceWording(db,c.req.param('id'),input.wording,input.expectedVersionId,actor,now))
 }))
 app.get('/api/operator/evidence/:id/versions',c=>evidenceMutation(c,async(_actor,_now,db)=>c.json(await evidenceVersions(db,c.req.param('id')))))
 app.get('/api/operator/requests/suggestions',c=>evidenceMutation(c,async(_actor,_now,db)=>{
 const title=c.req.query('title')?.trim()??''
 if(!title||title.length>280)return c.json({error:'validation_failed'},400)
 return c.json(await requestSuggestions(db,title,true))
 }))
 app.get('/api/operator/evidence/:id/attachments',c=>evidenceMutation(c,async(_actor,_now,db)=>c.json(await listEvidenceAttachments(db,c.req.param('id')))))
 app.post('/api/operator/evidence/:id/attachments',c=>evidenceMutation(c,async(_actor,now,db)=>{
 const runtime=c.get('runtime'),file=await readAttachment(c.req.raw)
 return c.json(await uploadEvidenceAttachment(db,runtime.database.binding,runtime.blobs,c.req.param('id'),file,now),201)
 }))
 app.get('/api/operator/evidence-attachments/:id',c=>evidenceMutation(c,async(_actor,_now,db)=>evidenceAttachmentResponse(db,c.get('runtime').blobs,c.req.param('id'))))
 app.post('/api/operator/evidence-uploads/:id/recover',c=>evidenceMutation(c,async(_actor,_now,db)=>{
 const runtime=c.get('runtime'),file=c.req.header('Content-Type')?.startsWith('multipart/form-data')?await readAttachment(c.req.raw):undefined
 return c.json(await recoverEvidenceAttachment(db,runtime.database.binding,runtime.blobs,c.req.param('id'),file))
 }))
 app.post('/api/operator/evidence-uploads/:id/release-writer',c=>evidenceMutation(c,async(_actor,_now,db)=>{
 const input=await parseMutationBody(c,z.object({confirmPriorWriterStopped:z.literal(true)}).strict())
 if(!input)return c.json({error:'validation_failed'},400)
 await releaseEvidenceWriter(db,c.req.param('id'));return c.json({released:true})
 }))
}
