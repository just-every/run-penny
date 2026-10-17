import type { Context } from 'hono'
import { z } from 'zod'
import type { OperatorMutationEnvironment } from '@/core/app/operator-mutations'
import { createUlid } from '@/core/shared/ulid'
import { NativeError } from '../auth/native-tokens'
import { parseInput } from '../auth/native-routes'
import { integrationOperator } from '../integrations/destinations'
import { guardedDatabase } from '../integrations/guarded-database'
import { sessionGuard } from '../integrations/keys'

export const roadmapStatuses = ['under_review', 'planned', 'in_progress', 'shipped'] as const
export type RoadmapStatus = typeof roadmapStatuses[number]
export interface RoadmapColumn { status: RoadmapStatus; label: string; visible: boolean }
export interface StatusRoadmapSettings {
 source: 'approved_items' | 'request_statuses'
 boardSlugs: string[]
 columns: RoadmapColumn[]
 shippedDays: 30 | 90 | 365 | null
}
export interface PublicRoadmapSettings {
 source: StatusRoadmapSettings['source']
 columns: Pick<RoadmapColumn, 'status' | 'label'>[]
}
export interface OperatorRoadmapSettings {
 settings: StatusRoadmapSettings
 boards: { slug: string; name: string }[]
 owner: boolean
}
const defaultColumns: RoadmapColumn[] = [
 { status: 'under_review', label: 'Under review', visible: true },
 { status: 'planned', label: 'Planned', visible: true },
 { status: 'in_progress', label: 'In progress', visible: true },
 { status: 'shipped', label: 'Shipped', visible: true },
]
const settingsInput = z.object({
 source: z.enum(['approved_items', 'request_statuses']),
 boardSlugs: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(128)).max(100).refine(values => new Set(values).size === values.length),
 columns: z.array(z.object({ status: z.enum(roadmapStatuses), label: z.string().trim().min(1).max(80), visible: z.boolean() }).strict()).length(4).refine(columns => new Set(columns.map(column => column.status)).size === 4),
 shippedDays: z.union([z.literal(30), z.literal(90), z.literal(365)]).nullable(),
}).strict()

export async function readStatusRoadmapSettings(db: D1Database): Promise<StatusRoadmapSettings> {
 const row = await db.prepare('SELECT source,board_slugs_json AS boards,columns_json AS columns,shipped_days AS shippedDays FROM penny_status_roadmap_settings WHERE singleton=1').first<{ source: string; boards: string; columns: string; shippedDays: number | null }>()
 if (!row) throw new NativeError('roadmap_settings_unavailable', 503)
 return settingsInput.parse({ source: row.source, boardSlugs: JSON.parse(row.boards), columns: JSON.parse(row.columns), shippedDays: row.shippedDays })
}

export async function publicRoadmapSettings(db: D1Database): Promise<PublicRoadmapSettings> {
 const settings = await readStatusRoadmapSettings(db)
 const columns = settings.source === 'approved_items' ? defaultColumns : settings.columns
 return { source: settings.source, columns: columns.filter(column => column.visible).map(({ status, label }) => ({ status, label })) }
}

export async function getOperatorRoadmapSettings(c: Context<OperatorMutationEnvironment>) {
 const { session, db } = await integrationOperator(c.get('runtime'), c.req.raw)
 const [settings, boards] = await Promise.all([
  readStatusRoadmapSettings(db),
  db.prepare("SELECT slug,name FROM boards WHERE visibility='public' AND archived_at IS NULL ORDER BY position,name").all<{ slug: string; name: string }>(),
 ])
 c.header('Cache-Control', 'no-store')
 return c.json({ settings, boards: boards.results, owner: session.operator.role === 'owner' } satisfies OperatorRoadmapSettings)
}

export async function saveStatusRoadmapSettings(c: Context<OperatorMutationEnvironment>) {
 const runtime = c.get('runtime'), { session, actor } = await integrationOperator(runtime, c.req.raw)
 if (session.operator.role !== 'owner') throw new NativeError('owner_required', 403)
 const input = await parseInput(c.req.raw, settingsInput)
 const boardSlugs = JSON.stringify(input.boardSlugs)
 if (await runtime.database.binding.prepare("SELECT 1 FROM json_each(?) selected WHERE NOT EXISTS(SELECT 1 FROM boards b WHERE b.slug=selected.value AND b.visibility='public' AND b.archived_at IS NULL) LIMIT 1").bind(boardSlugs).first()) throw new NativeError('public_roadmap_board_unavailable', 400)
 const guard = sessionGuard(session)
 guard.sql += " AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner') AND EXISTS(SELECT 1 FROM penny_status_roadmap_settings WHERE singleton=1) AND NOT EXISTS(SELECT 1 FROM json_each(?) selected WHERE NOT EXISTS(SELECT 1 FROM boards b WHERE b.slug=selected.value AND b.visibility='public' AND b.archived_at IS NULL))"
 guard.params.push(session.operatorId, boardSlugs)
 const db = guardedDatabase(runtime.database.binding, guard), now = new Date().toISOString()
 await db.batch([
  db.prepare('UPDATE penny_status_roadmap_settings SET source=?,board_slugs_json=?,columns_json=?,shipped_days=?,updated_at=? WHERE singleton=1').bind(input.source, boardSlugs, JSON.stringify(input.columns), input.shippedDays, now),
  db.prepare("INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) VALUES(?,'operator',?,'roadmap.settings_replaced','settings','status_roadmap',?,?,?)").bind(createUlid(), actor.id, now, now, now),
 ])
 c.header('Cache-Control', 'no-store')
 return c.json({ saved: true })
}
