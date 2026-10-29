import type {Hono} from 'hono'
import {z} from 'zod'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {parseMutationBody,MutationError} from '@/core/app/operator-mutations'
import {loopMutation} from '@/core/app/loop-mutation'
import {guardedDatabase} from '../integrations/guarded-database'
import {integrationOperator} from '../integrations/destinations'
import {uploadEvidenceAttachment,recoverEvidenceAttachment} from '../evidence/attachments'
import {readAttachment} from '../requests/mutation-boundaries'
import {audit} from '../decisions/write-support'
import {captureInput,pageUrl,digest} from './schema'
import {startCapture,requireCapture,unfinished,checkSource} from './service'

export function registerBrowserCaptureRoutes(app:Hono<OperatorMutationEnvironment>){
 app.get('/api/operator/browser-captures',c=>loopMutation(c,async()=>{
  const {db}=await integrationOperator(c.get('runtime'),c.req.raw),url=c.req.query('url')
  if(url&&!pageUrl.safeParse(url).success)return c.json({error:'validation_failed'},400)
  const rows=await db.prepare(`SELECT b.*,o.display_name AS owner_name FROM penny_browser_captures b LEFT JOIN operators o ON o.id=b.actor_id ${url?'WHERE b.page_url=?':''} ORDER BY b.created_at DESC,b.id DESC LIMIT 25`).bind(...(url?[new URL(url).href]:[])).all()
  return c.json(rows.results)
 }))
 app.post('/api/operator/browser-captures',c=>loopMutation(c,async(actor,now)=>{
  const input=await parseMutationBody(c,captureInput);if(!input)return c.json({error:'validation_failed'},400)
  const {db,session}=await integrationOperator(c.get('runtime'),c.req.raw)
  return c.json(await startCapture(db,input,actor,session,now),201)
 }))
 app.get('/api/operator/browser-captures/:id',c=>loopMutation(c,async()=>{const {db}=await integrationOperator(c.get('runtime'),c.req.raw);return c.json(await requireCapture(db,c.req.param('id')))}))
 app.post('/api/operator/browser-captures/:id/screenshot',c=>loopMutation(c,async(_actor,now)=>{
  const runtime=c.get('runtime'),access=await integrationOperator(runtime,c.req.raw),row=await requireCapture(access.db,c.req.param('id'));unfinished(row)
  const db=guardedDatabase(access.db,{sql:"EXISTS(SELECT 1 FROM penny_browser_captures WHERE id=? AND state IN('uploading','failed','held') AND source_state NOT IN('removed','purged'))",params:[row.id]})
  const incoming=await readAttachment(c.req.raw),file=new File([incoming],`capture-${row.id}.png`,{type:incoming.type}),bytes=await file.arrayBuffer(),signature=[137,80,78,71,13,10,26,10]
  if(file.type!=='image/png'||incoming.name!=='browser-screenshot.png'||bytes.byteLength!==row.screenshot_bytes||await digest(bytes)!==row.screenshot_hash||!signature.every((value,index)=>new Uint8Array(bytes)[index]===value))throw new MutationError(422,'Choose this capture’s original PNG screenshot.')
  if(await db.prepare('SELECT id FROM attachments WHERE id=? AND evidence_id=?').bind(row.id,row.evidence_id).first())return c.json({id:row.id})
  const pending=await db.prepare('SELECT writing FROM evidence_attachment_uploads WHERE id=? AND evidence_id=?').bind(row.id,row.evidence_id).first<{writing:number}>()
  if(pending?.writing)throw new MutationError(409,'The screenshot upload was interrupted or is still active. Stop the prior upload, then release its writer in the inbox before retrying.')
  return c.json(pending?await recoverEvidenceAttachment(db,runtime.database.binding,runtime.blobs,row.id,file):await uploadEvidenceAttachment(db,runtime.database.binding,runtime.blobs,row.evidence_id,file,now,row.id))
 }))
 app.post('/api/operator/browser-captures/:id/ready',c=>loopMutation(c,async(actor,now)=>{
  const runtime=c.get('runtime'),{db,session}=await integrationOperator(runtime,c.req.raw),row=await requireCapture(db,c.req.param('id'))
  if(['done','pending','running'].includes(row.state))return c.json(row)
  unfinished(row)
  if(row.screenshot_hash){
   const file=await db.prepare('SELECT storage_key FROM attachments WHERE id=? AND evidence_id=?').bind(row.id,row.evidence_id).first<{storage_key:string}>(),object=file&&await runtime.blobs.get(file.storage_key)
   if(!object||object.size!==row.screenshot_bytes||await digest(await object.arrayBuffer())!==row.screenshot_hash)throw new MutationError(409,'The original screenshot is not attached yet. Retry its upload before completing capture.')
  }
  await db.batch([
   db.prepare('INSERT INTO penny_browser_authority(capture_id,session_id,owner_id,owner_version) VALUES(?,?,?,?) ON CONFLICT(capture_id) DO UPDATE SET session_id=excluded.session_id,owner_id=excluded.owner_id,owner_version=excluded.owner_version').bind(row.id,session.id,session.operatorId,session.operator.version),
   db.prepare("UPDATE penny_browser_captures SET state='pending',actor_id=?,failure=NULL,claim=NULL,updated_at=? WHERE id=? AND state IN('uploading','failed','held')").bind(actor,now,row.id),
   audit(db,actor,'evidence',row.evidence_id,'browser.capture_queued',now),
  ])
  return c.json(await requireCapture(db,row.id),202)
 }))
 app.post('/api/operator/browser-captures/:id/stop',c=>loopMutation(c,async(actor,now)=>{
  const {db}=await integrationOperator(c.get('runtime'),c.req.raw),row=await requireCapture(db,c.req.param('id'))
  await db.batch([db.prepare("UPDATE penny_browser_captures SET state='stopped',claim=NULL,failure='Stopped by an operator.',updated_at=? WHERE id=? AND state<>'done'").bind(now,row.id),audit(db,actor,'evidence',row.evidence_id,'browser.capture_stopped',now)])
  return c.json(await requireCapture(db,row.id))
 }))
 app.post('/api/operator/browser-captures/:id/check',c=>loopMutation(c,async(actor,now)=>{
  const input=await parseMutationBody(c,z.object({pageUrl,wording:z.string().max(20000),screenshotHash:z.string().regex(/^[a-f0-9]{64}$/).optional(),status:z.number().int().min(100).max(599)}).strict());if(!input)return c.json({error:'validation_failed'},400)
  const {db}=await integrationOperator(c.get('runtime'),c.req.raw)
  return c.json(await checkSource(db,await requireCapture(db,c.req.param('id')),input,actor,now))
 }))
}
