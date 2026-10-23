import type {Context,Hono} from 'hono'
import {z} from 'zod'
import {parseMutationBody,type OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {integrationOperator} from '../integrations/destinations'
import {sessionGuard} from '../integrations/keys'
import {guardedDatabase} from '../integrations/guarded-database'
import {NativeError} from '../auth/native-tokens'
import {ownershipCatalog} from '../ownership/repository'
import {createRequestBatch,undoRequestBatch} from './bulk-repository'
const input=z.object({requestIds:z.array(z.string().min(1).max(160)).min(1).max(200),tagId:z.string().min(1).max(160).optional(),operatorId:z.string().min(1).max(160).nullable().optional()}).strict().refine(v=>(v.tagId!==undefined||Object.hasOwn(v,'operatorId'))&&new Set(v.requestIds).size===v.requestIds.length)
export function registerBulkRoutes(app:Hono<OperatorMutationEnvironment>){
 app.get('/api/operator/triage/batches/options',c=>admitted(c,async(db,_actor,canManage)=>c.json(canManage?{canManage,tags:(await db.prepare('SELECT id,name FROM tags ORDER BY name,id').all()).results,operators:(await ownershipCatalog(db)).operators}:{canManage,tags:[],operators:[]})))
 app.post('/api/operator/triage/batches',c=>admitted(c,async(db,actor)=>{
  const body=await parseMutationBody(c,input);if(!body)return c.json({error:'validation_failed'},400)
  return c.json(await createRequestBatch(db,actor,body),201)
 },true))
 app.post('/api/operator/triage/batches/:id/undo',c=>admitted(c,async(db,actor)=>{
  const body=await parseMutationBody(c,z.object({}).strict());if(!body)return c.json({error:'validation_failed'},400)
  return c.json(await undoRequestBatch(db,actor,c.req.param('id')))
 },true))
}
async function admitted(c:Context<OperatorMutationEnvironment>,action:(db:D1Database,actor:string,canManage:boolean)=>Promise<Response>,write=false){
 try{
  const runtime=c.get('runtime'),{session,actor,db}=await integrationOperator(runtime,c.req.raw),canManage=['owner','admin'].includes(session.operator.role)
  if(write&&!canManage)throw new NativeError('batch_role_required',403)
  const guard=sessionGuard(session);guard.sql+=" AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role IN('owner','admin'))";guard.params.push(session.operatorId)
  c.header('Cache-Control','private, no-store');return await action(write?guardedDatabase(runtime.database.binding,guard):db,actor.id,canManage)
 }catch(error){if(error instanceof NativeError)return c.json({error:error.code},error.status);throw error}
}
