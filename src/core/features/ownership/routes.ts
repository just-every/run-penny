import type { Context, Hono } from 'hono'
import { z } from 'zod'
import { parseMutationBody, type OperatorMutationEnvironment } from '@/core/app/operator-mutations'
import { integrationOperator } from '../integrations/destinations'
import { NativeError } from '../auth/native-tokens'
import { itemOwner, ownershipCatalog, setItemOwner } from './repository'
import { acknowledgeComment, ownQueue } from './queue'

const assignment = z.object({ operatorId: z.string().min(1).max(160).nullable() }).strict()

export function registerOwnershipRoutes(app: Hono<OperatorMutationEnvironment>) {
 app.get('/api/operator/ownership/catalog', c => admitted(c, async db => c.json(await ownershipCatalog(db))))
 app.get('/api/operator/ownership/queue', c => admitted(c, async (db, actor) => {
  const page = z.coerce.number().int().min(1).max(10000).safeParse(c.req.query('page') ?? 1)
  if (!page.success) return c.json({ error: 'validation_failed' }, 400)
  return c.json(await ownQueue(db, actor, page.data))
 }))
 for (const entity of ['requests', 'evidence', 'boards'] as const) {
  const path = `/api/operator/ownership/${entity}/:value`
  app.get(path, c => admitted(c, async db => c.json(await itemOwner(db, entity, c.req.param('value')!))))
  app.patch(path, c => admitted(c, async (db, actor) => {
   const input = await parseMutationBody(c, assignment)
   if (!input) return c.json({ error: 'validation_failed' }, 400)
   await setItemOwner(db, entity, c.req.param('value')!, input.operatorId, actor)
   return c.json({ ok: true })
  }))
 }
 app.post('/api/operator/ownership/comments/:id/handled', c => admitted(c, async (db, actor) => {
  const input = await parseMutationBody(c, z.object({ updatedAt: z.string().min(1).max(80) }).strict())
  if (!input) return c.json({ error: 'validation_failed' }, 400)
  await acknowledgeComment(db, actor, c.req.param('id'), input.updatedAt)
  return c.json({ ok: true })
 }))
}

async function admitted(c: Context<OperatorMutationEnvironment>, action: (db: D1Database, actor: string) => Promise<Response>) {
 try {
  const { db, actor } = await integrationOperator(c.get('runtime'), c.req.raw)
  c.header('Cache-Control', 'private, no-store')
  return await action(db, actor.id)
 } catch (error) {
  if (error instanceof NativeError) return c.json({ error: error.code, ...(error.hint ? { message: error.hint } : {}) }, error.status)
  throw error
 }
}
