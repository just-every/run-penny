import type { Hono } from 'hono'
import { z } from 'zod'
import type { OperatorMutationEnvironment } from '@/core/app/operator-mutations'
import type { PennyRuntime } from '@/core/app/runtime'
import type { PublicRequestStatus } from '@/core/shared/api/public'
import { createUlid } from '@/core/shared/ulid'
import { parseInput } from '../auth/native-routes'
import { NativeError } from '../auth/native-tokens'
import { integrationOperator } from '../integrations/destinations'
import { guardedDatabase } from '../integrations/guarded-database'
import { sessionGuard } from '../integrations/keys'

export interface InternalRequestStatus {
  id: string
  name: string
  publicStatus: PublicRequestStatus
  showPublicLabel: boolean
  position: number
}
export interface RequestStatusSettingsData {
  statuses: InternalRequestStatus[]
  templates: Record<PublicRequestStatus, string>
  owner: boolean
}

const root = '/api/operator/settings/request-statuses'
const publicStatuses = ['open', 'under_review', 'planned', 'in_progress', 'shipped', 'declined'] as const
const publicStatusInput = z.enum(publicStatuses)
const statusFields = {
  name: z.string().trim().min(1).max(160),
  publicStatus: publicStatusInput,
  showPublicLabel: z.boolean(),
  position: z.number().int().nonnegative(),
}
const statusInput = z.object({ ...statusFields, showPublicLabel: statusFields.showPublicLabel.default(false), position: statusFields.position.default(0) }).strict()
const statusPatch = z.object(statusFields).partial().strict().refine(input => Object.keys(input).length > 0)
type StatusRow = Omit<InternalRequestStatus, 'showPublicLabel'> & { showPublicLabel: number }
const statusColumns = 'id,name,public_status AS publicStatus,show_public_label AS showPublicLabel,position'

async function settingsOwner(runtime: PennyRuntime, request: Request) {
  const { session, actor } = await integrationOperator(runtime, request)
  if (session.operator.role !== 'owner') throw new NativeError('owner_required', 403)
  const guard = sessionGuard(session)
  guard.sql += " AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner')"
  guard.params.push(session.operatorId)
  return { db: guardedDatabase(runtime.database.binding, guard), actor }
}

function audit(db: D1Database, actorId: string, action: string, entityId: string, now: string) {
  return db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at)
    VALUES(?,'operator',?,?,'request_status_settings',?,?,?,?)`)
    .bind(createUlid(), actorId, action, entityId, now, now, now)
}

export function registerRequestStatusSettingsRoutes(app: Hono<OperatorMutationEnvironment>): void {
  app.get(root, async c => {
    const { db, session } = await integrationOperator(c.get('runtime'), c.req.raw)
    c.header('Cache-Control', 'no-store')
    const results = await db.batch([
      db.prepare(`SELECT ${statusColumns} FROM request_internal_statuses ORDER BY position,name,id`),
      db.prepare('SELECT public_status AS publicStatus,body FROM request_status_templates'),
    ])
    const templates = Object.fromEntries(publicStatuses.map(status => [status, ''])) as Record<PublicRequestStatus, string>
    for (const row of results[1].results as { publicStatus: PublicRequestStatus; body: string }[]) templates[row.publicStatus] = row.body
    return c.json({
      statuses: (results[0].results as StatusRow[]).map(row => ({ ...row, showPublicLabel: Boolean(row.showPublicLabel) })),
      templates, owner: session.operator.role === 'owner',
    } satisfies RequestStatusSettingsData)
  })

  app.post(root, async c => {
    const { db, actor } = await settingsOwner(c.get('runtime'), c.req.raw)
    const input = await parseInput(c.req.raw, statusInput), id = createUlid(), now = new Date().toISOString()
    await db.batch([
      db.prepare('INSERT INTO request_internal_statuses(id,name,public_status,show_public_label,position,created_at,updated_at) VALUES(?,?,?,?,?,?,?)')
        .bind(id, input.name, input.publicStatus, Number(input.showPublicLabel), input.position, now, now),
      audit(db, actor.id, 'request_status.created', id, now),
    ])
    return c.json({ id, ...input }, 201)
  })

  for (const method of ['put', 'patch'] as const) app[method](root + '/:id', async c => {
    const { db, actor } = await settingsOwner(c.get('runtime'), c.req.raw)
    const input = method === 'put' ? await parseInput(c.req.raw, statusInput) : await parseInput(c.req.raw, statusPatch)
    const id = c.req.param('id'), now = new Date().toISOString()
    // Compare the mapping in the transaction, so an edit to a name or position
    // never overwrites a request's newer roadmap status or restarts its clock.
    const results = await db.batch([
      db.prepare(`UPDATE requests SET public_state=?,direct_status_changed_at=?,latest_status_source='direct',updated_at=?
        WHERE internal_status_id=? AND EXISTS(SELECT 1 FROM request_internal_statuses WHERE id=? AND public_status<>?)`)
        .bind(input.publicStatus ?? null, now, now, id, id, input.publicStatus ?? null),
      db.prepare(`UPDATE request_internal_statuses SET name=COALESCE(?,name),public_status=COALESCE(?,public_status),
        show_public_label=COALESCE(?,show_public_label),position=COALESCE(?,position),updated_at=? WHERE id=? RETURNING ${statusColumns}`)
        .bind(input.name ?? null, input.publicStatus ?? null, input.showPublicLabel === undefined ? null : Number(input.showPublicLabel), input.position ?? null, now, id),
      db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at)
        SELECT ?,'operator',?,'request_status.updated','request_status_settings',id,?,?,? FROM request_internal_statuses WHERE id=?`)
        .bind(createUlid(), actor.id, now, now, now, id),
    ])
    const updated = results[1].results[0] as StatusRow | undefined
    if (!updated) throw new NativeError('not_found', 404)
    return c.json({ ...updated, showPublicLabel: Boolean(updated.showPublicLabel) })
  })

  app.put(root + '/templates/:status', async c => {
    const { db, actor } = await settingsOwner(c.get('runtime'), c.req.raw)
    const status = publicStatusInput.safeParse(c.req.param('status'))
    if (!status.success) throw new NativeError('validation_failed', 400)
    const input = await parseInput(c.req.raw, z.object({ body: z.string().max(20000) }).strict(), 128000)
    const now = new Date().toISOString()
    await db.batch([
      db.prepare(`INSERT INTO request_status_templates(public_status,body,updated_at) VALUES(?,?,?)
        ON CONFLICT(public_status) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at`)
        .bind(status.data, input.body, now),
      audit(db, actor.id, 'request_status.template_updated', status.data, now),
    ])
    return c.json({ saved: true })
  })
}
