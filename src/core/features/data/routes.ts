import type { Context, Hono } from 'hono'
import { z } from 'zod'
import type { PennyRuntime } from '@/core/app/runtime'
import type { AppBindings } from '@/core/shared/bindings'
import { operatorAuth } from '@/core/features/auth/operator'
import { parseInput } from '@/core/features/auth/native-routes'
import { NativeError } from '@/core/features/auth/native-tokens'
import { DATA_LIMITS,abortInterruptedExport,abortPendingErasure,abortRestore,dataOperation,exportArchive,planErasure,readErasureJournal,recoverInterruptedRunner,restoreStagingKey,startErasure,startRestore } from './archive'
import { assertDataAuthority, type DataAuthority } from './authority'
import { planOperatorErasure, startOperatorErasure } from './operator-erasure'
import { describeCopies } from './erasure-copy-places'
import { runOperation } from './operations'
import { registerWork } from './runner/claims'
import { advanceDataWork } from './runner/advance'
import { confirmed, keepAlive } from './runner/inline'
import { queueDataWork } from './runner/queue'
import { dataWorkDue, operationProgress, recentOutcome } from './runner/status'
import { dataBatch } from './authority'
import {ownHostedExport,registerPortabilityRoutes} from './portability'
import {CopyScanPending} from '../imports/copy-scan'
import {PREVIEW_TOKEN_BYTES} from '../imports/preview-token'
type Environment={Bindings:AppBindings;Variables:{runtime:PennyRuntime;dataAuthority?:DataAuthority}}
function authority(c:Context<Environment>):DataAuthority{
 const session=c.get('dataAuthority')
 if(!session)throw new NativeError('unauthenticated',401)
 return session
}
/** Confirmed work runs its first steps in this request (inside `confirmed`,
 * so a closed tab does not stop it); the server's runner continues the rest
 * (runner/advance.ts). */
async function runHere(c:Context<Environment>,id:string):Promise<{operationId:string;status:string}>{
 await queueDataWork(c.env.JOBS,10)
 return runOperation(c.env.DB,c.env.FILES,id,authority(c))
}
export function registerDataRoutes(app:Hono<Environment>):void{
 registerPortabilityRoutes(app)
 app.use('/api/operator/data/*',async(c,next)=>{
  c.header('Cache-Control','private, no-store')
  c.header('Pragma','no-cache')
  c.header('X-Content-Type-Options','nosniff')
  const configuration=c.get('runtime').configuration
  if(!['local','test'].includes(configuration.environment)&&!['GET','HEAD','OPTIONS'].includes(c.req.method)){
   if(c.req.header('Origin')!==configuration.appOrigin||new URL(c.req.url).origin!==configuration.appOrigin)throw new NativeError('forbidden_origin',403)
  }
  const session=await operatorAuth(c.get('runtime')).getSession(c.req.raw)
  if(!session)throw new NativeError('unauthenticated',401)
  c.set('dataAuthority',session)
  await next()
  await assertDataAuthority(c.env.DB,session)
 })
 app.get('/api/operator/data/export',async c=>{const result=await exportArchive(c.env.DB,c.env.FILES,authority(c));c.header('Content-Disposition','attachment; filename="penny-data-bundle.json"');return c.json(result)})
 app.get('/api/operator/data/journal',async c=>{const result=await readErasureJournal(c.env.DB);c.header('Content-Disposition','attachment; filename="penny-erasure-journal.json"');return c.json(result)})
 app.get('/api/operator/data/maintenance',async c=>{
  const exporting=await c.env.DB.prepare("SELECT 1 FROM data_state s JOIN data_operations o ON o.id=s.lock_id WHERE s.singleton=1 AND s.phase='locked' AND o.kind='export'").first()
  return c.json({exporting:Boolean(exporting)})
 })
 app.get('/api/operator/data/overview',async c=>{
  // Each record is chosen by what an operator recognises: a name, a title or the evidence's own words.
  const kinds=[['requesters','display_name'],['requests','title'],['evidence_items',"COALESCE((SELECT substr(v.wording,1,80) FROM evidence_versions v WHERE v.evidence_id=evidence_items.id ORDER BY v.version_number DESC LIMIT 1),source_type)"],['accounts','name']] as const
  const results=await c.env.DB.batch<{id:string;label:string}>(kinds.map(([table,column])=>c.env.DB.prepare(`SELECT id,${column} AS label FROM ${table} ORDER BY created_at DESC LIMIT 100`)))
  // Removed operators who are not yet erased; current operators hold authority.
  const former=await c.env.DB.prepare("SELECT p.id,p.display_name AS label FROM operators p WHERE p.email NOT LIKE '%@erased.invalid' AND NOT EXISTS(SELECT 1 FROM oa_operators o WHERE lower(o.email)=lower(p.email) AND o.status<>'inactive') ORDER BY p.created_at DESC LIMIT 100").all<{id:string;label:string}>()
  const state=await c.env.DB.prepare('SELECT lock_id FROM data_state WHERE singleton=1').first<{lock_id:string|null}>(),operation=state?.lock_id?await dataOperation(c.env.DB,state.lock_id):null,journal=await readErasureJournal(c.env.DB)
  const configuration=c.get('runtime').configuration,hosted=!['local','test'].includes(configuration.environment)
  const currentSession=await operatorAuth(c.get('runtime')).getSession(c.req.raw)
  if(await dataWorkDue(c.env.DB))keepAlive(c,advanceDataWork(c.env))
  const progress=operation&&operation.kind!=='export'?await operationProgress(c.env.DB,c.env.FILES,operation):null
  return c.json({hosted,canExport:currentSession?.kind==='native'&&currentSession.operator.role==='owner',ownExport:await ownHostedExport(c.env.DB,operation,currentSession),targets:[...kinds.flatMap(([table],index)=>results[index].results.map(row=>({table,...row}))),...former.results.map(row=>({table:'operators',...row}))],operation:operation?{id:operation.id,kind:operation.kind,status:operation.status,progress}:null,recent:await recentOutcome(c.env.DB),epoch:journal.epoch})
 })
 app.post('/api/operator/data/import',async c=>{
  const input=await parseInput(c.req.raw,z.object({archive:z.unknown(),journal:z.unknown(),resumeOperationId:z.string().optional()}).strict(),DATA_LIMITS.archiveBytes)
  const result=await confirmed(c,async()=>runHere(c,await startRestore(c.env.DB,c.env.FILES,input.archive,input.journal,input.resumeOperationId,authority(c))))
  return c.json(result,result.status==='complete'?200:202)
 })
 app.post('/api/operator/data/erasure/preview',async c=>{
  const input=await parseInput(c.req.raw,z.object({table:z.string(),id:z.string().min(1).max(160),continuation:z.string().max(PREVIEW_TOKEN_BYTES).optional()}).strict(),DATA_LIMITS.archiveBytes)
  const session=authority(c),secret=c.get('runtime').configuration.authSecret!
  try{
   const plan=input.table==='operators'?await planOperatorErasure(c.env.DB,input.id):await planErasure(c.env.DB,input.table,input.id,{secret,subject:session.operatorId+':'+session.id,continuation:input.continuation})
   // The import kit withdraws each touched import's whole saved original, for everyone in it.
   const imports=new Set((('selected' in plan?plan.selected.feedback_import_records:undefined)??[]).map(row=>row.namespace)).size
   // Records that stay without the person's words, by kind.
   const kept:Record<string,number>={};for(const row of 'redactions' in plan?plan.redactions:[])kept[row.table]=(kept[row.table]??0)+1
   return c.json({table:plan.table,id:plan.id,planHash:plan.planHash,counts:plan.counts,kept,fileCount:plan.files.length,importCount:imports,blockedCopies:await describeCopies(c.env.DB,plan.blockedCopies)})
  }catch(error){
   if(error instanceof CopyScanPending)return c.json({status:'pending',continuation:error.continuation},202)
   throw error
  }
 })
 app.post('/api/operator/data/erasure',async c=>{
  const input=await parseInput(c.req.raw,z.object({table:z.string(),id:z.string().min(1).max(160),planHash:z.string().length(64),auditCopies:z.array(z.object({id:z.string().min(1).max(160),resolution:z.enum(['unrelated','clear'])}).strict()).max(21).optional(),
   copies:z.array(z.object({table:z.string().max(80),key:z.string().max(400),resolution:z.enum(['redact','rename']),values:z.record(z.string().max(80),z.string().max(4000)).optional()}).strict()).max(200).optional()}).strict())
  if(input.auditCopies&&input.table!=='operators'||input.copies&&input.table==='operators')throw new NativeError('validation_failed',400)
  const result=await confirmed(c,async()=>runHere(c,input.table==='operators'?await startOperatorErasure(c.env.DB,input.id,input.planHash,authority(c),input.auditCopies):await startErasure(c.env.DB,input.table,input.id,input.planHash,authority(c),input.copies)))
  return c.json(result,result.status==='complete'?200:202)
 })
 app.get('/api/operator/data/operations/:id',async c=>{
  const operation=await dataOperation(c.env.DB,c.req.param('id'));if(!operation)throw new NativeError('not_found',404)
  return c.json({operationId:operation.id,kind:operation.kind,status:operation.status})
 })
 // Resume binds a stopped erasure or restore to the operator resuming it and
 // runs it again; the server continues it from there. A restore whose staged
 // backup is gone needs the same backup chosen again (POST import).
 app.post('/api/operator/data/operations/:id/resume',async c=>{
  const id=c.req.param('id'),operation=await dataOperation(c.env.DB,id)
  if(!operation||!['erase','restore'].includes(operation.kind))throw new NativeError('invalid_data_operation',400)
  if(['complete','aborted'].includes(operation.status))return c.json({operationId:id,status:operation.status},operation.status==='complete'?200:202)
  if(operation.kind==='restore'&&!await c.env.FILES.head(restoreStagingKey(id)))throw new NativeError('restore_backup_needed',409)
  const result=await confirmed(c,async()=>{await dataBatch(c.env.DB,[registerWork(c.env.DB,id,'operation',authority(c),undefined,{sql:'EXISTS(SELECT 1 FROM data_state WHERE lock_id=?)',params:[id]})],authority(c));return runHere(c,id)});return c.json(result,result.status==='complete'?200:202)
 })
 app.post('/api/operator/data/operations/:id/abort-pending-erasure',async c=>{await parseInput(c.req.raw,z.object({confirmPriorRunnerStopped:z.literal(true)}).strict());await abortPendingErasure(c.env.DB,c.req.param('id'),authority(c));return c.body(null,204)})
 app.post('/api/operator/data/operations/:id/abort-export',async c=>{await parseInput(c.req.raw,z.object({confirmPriorRunnerStopped:z.literal(true)}).strict());await abortInterruptedExport(c.env.DB,c.req.param('id'),authority(c));return c.body(null,204)})
 app.post('/api/operator/data/operations/:id/recover-runner',async c=>{const input=await parseInput(c.req.raw,z.object({expectedStatus:z.enum(['running','running_r2','running_import']),confirmPriorRunnerStopped:z.literal(true)}).strict());await recoverInterruptedRunner(c.env.DB,c.req.param('id'),input.expectedStatus,authority(c));return c.body(null,204)})
 app.post('/api/operator/data/operations/:id/abort-restore',async c=>{await abortRestore(c.env.DB,c.env.FILES,c.req.param('id'),authority(c));return c.body(null,204)})
}
