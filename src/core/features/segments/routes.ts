import type { Hono } from 'hono'
import { parseMutationBody, type OperatorMutationEnvironment } from '@/core/app/operator-mutations'
import { evidenceMutation } from '../evidence/admission'
import { segmentId, segmentInput } from './input'
import { listSegments, readSegment, saveSegment } from './repository'

export function registerSegmentRoutes(app: Hono<OperatorMutationEnvironment>) {
 app.get('/api/operator/segments', c => evidenceMutation(c, async (_actor, _now, db) => c.json(await listSegments(db))))
 app.get('/api/operator/segments/:id', c => evidenceMutation(c, async (_actor, _now, db) => {
  const id = segmentId.safeParse(c.req.param('id'))
  if (!id.success) return c.json({ error: 'validation_failed' }, 400)
  return c.json(await readSegment(db, id.data))
 }))
 app.post('/api/operator/segments', c => evidenceMutation(c, async (actor, now, db) => {
  const input = await parseMutationBody(c, segmentInput)
  if (!input) return c.json({ error: 'validation_failed' }, 400)
  return c.json(await saveSegment(db, null, input, actor, now), 201)
 }))
 app.patch('/api/operator/segments/:id', c => evidenceMutation(c, async (actor, now, db) => {
  const input = await parseMutationBody(c, segmentInput), id = segmentId.safeParse(c.req.param('id'))
  if (!input || !id.success) return c.json({ error: 'validation_failed' }, 400)
  return c.json(await saveSegment(db, id.data, input, actor, now))
 }))
}
