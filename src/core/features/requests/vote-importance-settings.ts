import type { Hono } from 'hono'
import { z } from 'zod'
import type { OperatorMutationEnvironment } from '@/core/app/operator-mutations'
import { parseInput } from '../auth/native-routes'
import { NativeError } from '../auth/native-tokens'
import { integrationOperator } from '../integrations/destinations'
import { guardedDatabase } from '../integrations/guarded-database'
import { sessionGuard } from '../integrations/keys'
import { createUlid } from '@/core/shared/ulid'
import { boardImportance } from './vote-importance'
const slug=z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(128)
const input=z.object({enabled:z.boolean(),labels:z.array(z.string().trim().min(1).max(80)).min(3).max(4).refine(labels=>new Set(labels).size===labels.length)}).strict()
export function registerVoteImportanceSettings(app:Hono<OperatorMutationEnvironment>){
 app.get('/api/operator/boards/:slug/vote-importance',async c=>{
  const runtime=c.get('runtime'),{db,session}=await integrationOperator(runtime,c.req.raw),board=await db.prepare('SELECT id FROM boards WHERE slug=?').bind(slug.parse(c.req.param('slug'))).first<{id:string}>()
  if(!board)throw new NativeError('not_found',404)
  return c.json({...await boardImportance(db,board.id),canConfigure:session.operator.role==='owner'})
 })
 app.get('/api/operator/requests/:slug/vote-importance-options',async c=>{
  const {db}=await integrationOperator(c.get('runtime'),c.req.raw),request=await db.prepare('SELECT board_id FROM requests WHERE slug=?').bind(slug.parse(c.req.param('slug'))).first<{board_id:string}>()
  if(!request)throw new NativeError('not_found',404)
  return c.json(await boardImportance(db,request.board_id))
 })
 app.put('/api/operator/boards/:slug/vote-importance',async c=>{
  const runtime=c.get('runtime'),value=await parseInput(c.req.raw,input),{session,actor}=await integrationOperator(runtime,c.req.raw)
  if(session.operator.role!=='owner')throw new NativeError('owner_required',403)
  const guard=sessionGuard(session);guard.sql+=" AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner')";guard.params.push(session.operatorId)
  const db=guardedDatabase(runtime.database.binding,guard),board=await db.prepare('SELECT id FROM boards WHERE slug=?').bind(slug.parse(c.req.param('slug'))).first<{id:string}>()
  if(!board)throw new NativeError('not_found',404)
  const now=new Date().toISOString()
  await db.batch([db.prepare('INSERT INTO penny_vote_importance_settings(board_id,enabled,labels_json,updated_at) VALUES(?,?,?,?) ON CONFLICT(board_id) DO UPDATE SET enabled=excluded.enabled,labels_json=excluded.labels_json,updated_at=excluded.updated_at').bind(board.id,Number(value.enabled),JSON.stringify(value.labels),now),
   db.prepare("INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) VALUES(?,'operator',?,'board.vote_importance_saved','board',?,?,?,?)").bind(createUlid(),actor.id,board.id,now,now,now)])
  return c.json({saved:true})
 })
}
