import type { Context, Hono } from 'hono'
import { z } from 'zod'
import type { PennyRuntime } from '@/core/app/runtime'
import type { AppBindings } from '@/core/shared/bindings'
import { operatorAuth } from '@/core/features/auth/operator'
import { parseInput } from '@/core/features/auth/native-routes'
import { NativeError } from '@/core/features/auth/native-tokens'
import { DATA_LIMITS,abortInterruptedExport,abortPendingErasure,abortRestore,dataOperation,eraseEntity,exportArchive,planErasure,readErasureJournal,recoverInterruptedRunner,resumeErasure,restoreArchive } from './archive'
import { assertDataAuthority, type DataAuthority } from './authority'
import {CopyScanPending} from '../imports/copy-scan'
import {PREVIEW_TOKEN_BYTES} from '../imports/preview-token'
type Environment={Bindings:AppBindings;Variables:{runtime:PennyRuntime;dataAuthority?:DataAuthority}}
function authority(c:Context<Environment>):DataAuthority{
 const session=c.get('dataAuthority')
 if(!session)throw new NativeError('unauthenticated',401)
 return session
}
export function registerDataRoutes(app:Hono<Environment>):void{
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
 app.get('/api/operator/data/overview',async c=>{
  const kinds=[['requesters','display_name'],['requests','title'],['evidence_items','source_type'],['accounts','name']] as const
  const results=await c.env.DB.batch<{id:string;label:string}>(kinds.map(([table,column])=>c.env.DB.prepare(`SELECT id,${column} AS label FROM ${table} ORDER BY created_at DESC LIMIT 100`)))
  const state=await c.env.DB.prepare('SELECT lock_id FROM data_state WHERE singleton=1').first<{lock_id:string|null}>(),operation=state?.lock_id?await dataOperation(c.env.DB,state.lock_id):null,journal=await readErasureJournal(c.env.DB)
  const configuration=c.get('runtime').configuration,hosted=!['local','test'].includes(configuration.environment)
  const origin=configuration.appOrigin!.replaceAll("'", "'\"'\"'"),connection=`--origin '${origin}' --session-file private/session.json`
  const commands={restore:`pnpm run data:import -- private/archive.json --journal private/latest-source-journal.json ${connection}`,preview:`pnpm run data:erase-preview -- requests 'ROOT_ID' private/plan.json ${connection}`,erase:`pnpm run data:erase -- private/plan.json --journal-out private/latest-journal.json ${connection}`,status:`pnpm run data:status -- 'OPERATION_ID' ${connection}`}
  return c.json({hosted,commands,targets:kinds.flatMap(([table],index)=>results[index].results.map(row=>({table,...row}))),operation:operation?{id:operation.id,kind:operation.kind,status:operation.status}:null,epoch:journal.epoch})
 })
 app.post('/api/operator/data/import',async c=>{
  const input=await parseInput(c.req.raw,z.object({archive:z.unknown(),journal:z.unknown(),resumeOperationId:z.string().optional()}).strict(),DATA_LIMITS.archiveBytes)
  const result=await restoreArchive(c.env.DB,c.env.FILES,input.archive,input.journal,input.resumeOperationId,authority(c))
  return c.json(result,result.status==='complete'?200:202)
 })
 app.post('/api/operator/data/erasure/preview',async c=>{
  const input=await parseInput(c.req.raw,z.object({table:z.string(),id:z.string().min(1).max(160),continuation:z.string().max(PREVIEW_TOKEN_BYTES).optional()}).strict(),DATA_LIMITS.archiveBytes)
  const session=authority(c),secret=c.get('runtime').configuration.authSecret!
  try{
   const plan=await planErasure(c.env.DB,input.table,input.id,{secret,subject:session.operatorId+':'+session.id,continuation:input.continuation})
   return c.json({table:plan.table,id:plan.id,planHash:plan.planHash,counts:plan.counts,fileCount:plan.files.length,blockedCopies:plan.blockedCopies})
  }catch(error){
   if(error instanceof CopyScanPending)return c.json({status:'pending',continuation:error.continuation},202)
   throw error
  }
 })
 app.post('/api/operator/data/erasure',async c=>{
  const input=await parseInput(c.req.raw,z.object({table:z.string(),id:z.string().min(1).max(160),planHash:z.string().length(64)}).strict())
  const result=await eraseEntity(c.env.DB,c.env.FILES,input.table,input.id,input.planHash,authority(c))
  return c.json(result,result.status==='complete'?200:202)
 })
 app.get('/api/operator/data/operations/:id',async c=>{
  const operation=await dataOperation(c.env.DB,c.req.param('id'));if(!operation)throw new NativeError('not_found',404)
  return c.json({operationId:operation.id,kind:operation.kind,status:operation.status})
 })
 app.post('/api/operator/data/operations/:id/resume',async c=>{const result=await resumeErasure(c.env.DB,c.env.FILES,c.req.param('id'),authority(c));return c.json(result,result.status==='complete'?200:202)})
 app.post('/api/operator/data/operations/:id/abort-pending-erasure',async c=>{await parseInput(c.req.raw,z.object({confirmPriorRunnerStopped:z.literal(true)}).strict());await abortPendingErasure(c.env.DB,c.req.param('id'),authority(c));return c.body(null,204)})
 app.post('/api/operator/data/operations/:id/abort-export',async c=>{await parseInput(c.req.raw,z.object({confirmPriorRunnerStopped:z.literal(true)}).strict());await abortInterruptedExport(c.env.DB,c.req.param('id'),authority(c));return c.body(null,204)})
 app.post('/api/operator/data/operations/:id/recover-runner',async c=>{const input=await parseInput(c.req.raw,z.object({expectedStatus:z.enum(['running','running_r2','running_import']),confirmPriorRunnerStopped:z.literal(true)}).strict());await recoverInterruptedRunner(c.env.DB,c.req.param('id'),input.expectedStatus,authority(c));return c.body(null,204)})
 app.post('/api/operator/data/operations/:id/abort-restore',async c=>{await abortRestore(c.env.DB,c.env.FILES,c.req.param('id'),authority(c));return c.body(null,204)})
}
