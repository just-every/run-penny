import seed from '../../../../seed.json'
import type { Hono } from 'hono'
import { mutationFailure,parseMutationBody,requireOperator,type OperatorMutationEnvironment } from '@/core/app/operator-mutations'
import { decisionDatabase } from '../decisions/authority'
import { recoverReleaseImage,approveReleaseAttachment,listReleaseAttachments,releaseAttachmentResponse,uploadReleaseAttachment } from './attachments'
import { createReleaseLabel,releaseLabels,releaseLabelSchema } from './rich-repository'
export function registerRichReleaseRoutes(app:Hono<OperatorMutationEnvironment>){
 app.get('/api/operator/releases/labels',async c=>{
  if(!await requireOperator(c))return c.json({authenticated:false},401)
  return c.json(await releaseLabels(c.get('runtime').database.binding))
 })
 app.post('/api/operator/releases/labels',async c=>{
  const actor=await requireOperator(c);if(!actor)return c.json({authenticated:false},401)
  const input=await parseMutationBody(c,releaseLabelSchema);if(!input)return c.json({message:'Provide a unique custom label name.'},400)
  try{return c.json(await createReleaseLabel(await decisionDatabase(c.get('runtime'),c.req.raw),input.name,actor.id),201)}catch(e){return mutationFailure(c,e)}
 })
 app.get('/api/operator/releases/:slug/attachments',async c=>{
  if(!await requireOperator(c))return c.json({authenticated:false},401)
  try{return c.json(await listReleaseAttachments(c.get('runtime').database.binding,c.req.param('slug')))}catch(e){return mutationFailure(c,e)}
 })
 app.post('/api/operator/releases/:slug/attachments',async c=>{
  if(!await requireOperator(c))return c.json({authenticated:false},401)
  const runtime=c.get('runtime'),db=await decisionDatabase(runtime,c.req.raw)
  const declared=c.req.header('Content-Length')
  if(declared&&Number(declared)>seed.limits.uploadBytesPerFile+65536)return c.json({message:'The image exceeds the upload limit.'},400)
  const form=await c.req.formData(),file=form.get('file')
  if(!(file instanceof File))return c.json({message:'Choose an image file.'},400)
  try{return c.json(await uploadReleaseAttachment(db,runtime.database.binding,runtime.blobs,c.req.param('slug'),file),201)}catch(e){return mutationFailure(c,e)}
 })
 app.post('/api/operator/releases/:slug/attachments/:id/recover',async c=>{
  if(!await requireOperator(c))return c.json({authenticated:false},401)
  const runtime=c.get('runtime'),db=await decisionDatabase(runtime,c.req.raw),form=await c.req.formData(),file=form.get('file')
  if(!(file instanceof File)||file.size>seed.limits.uploadBytesPerFile)return c.json({message:'Choose the original image within the upload limit.'},400)
  try{return c.json(await recoverReleaseImage(db,runtime.database.binding,runtime.blobs,c.req.param('slug'),c.req.param('id'),file,form.get('writerStopped')==='yes'))}catch(e){return mutationFailure(c,e)}
 })
 app.post('/api/operator/releases/:slug/attachments/:id/approve',async c=>{
  const actor=await requireOperator(c);if(!actor)return c.json({authenticated:false},401)
  const runtime=c.get('runtime')
  try{return c.json(await approveReleaseAttachment(await decisionDatabase(runtime,c.req.raw),runtime.blobs,c.req.param('slug'),c.req.param('id'),actor.id))}catch(e){return mutationFailure(c,e)}
 })
 app.get('/api/public/releases/:slug/attachments/:id',async c=>{
  const runtime=c.get('runtime')
  try{return await releaseAttachmentResponse(runtime.database.binding,runtime.blobs,c.req.param('slug'),c.req.param('id'))}catch(e){return mutationFailure(c,e)}
 })
}
