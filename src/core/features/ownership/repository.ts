import { NativeError } from '../auth/native-tokens'
import { createUlid } from '@/core/shared/ulid'
import type { ItemOwner, OwnedEntity, OwnershipCatalog, OwnershipOperator } from './types'

const entities = {
 requests: { table: 'penny_request_owners', key: 'request_id', source: 'requests', lookup: 'slug', kind: 'request' },
 evidence: { table: 'penny_evidence_owners', key: 'evidence_id', source: 'evidence_items', lookup: 'id', kind: 'evidence' },
 boards: { table: 'penny_board_owners', key: 'board_id', source: 'boards', lookup: 'slug', kind: 'board' },
} as const
export const activeOwner = `EXISTS(SELECT 1 FROM operators p JOIN oa_operators n ON n.email=p.email WHERE p.id=? AND n.status='active')`
const ownerColumns = `p.id,p.display_name AS displayName,EXISTS(SELECT 1 FROM oa_operators n WHERE n.email=p.email AND n.status='active') AS active`
const selectableOwners = "SELECT p.id,p.display_name AS displayName FROM operators p JOIN oa_operators n ON n.email=p.email WHERE n.status='active' ORDER BY p.display_name,p.id"

export async function ownershipCatalog(db: D1Database): Promise<OwnershipCatalog> {
 const [operators, boards] = await db.batch([
  db.prepare(selectableOwners),
  db.prepare(`SELECT b.id,b.slug,b.name,p.id AS ownerId,p.display_name AS displayName,
   EXISTS(SELECT 1 FROM oa_operators n WHERE n.email=p.email AND n.status='active') AS active
   FROM boards b LEFT JOIN penny_board_owners d ON d.board_id=b.id LEFT JOIN operators p ON p.id=d.operator_id
   WHERE b.archived_at IS NULL ORDER BY b.position,b.name,b.id`),
 ])
 return {
  operators: operators.results as OwnershipCatalog['operators'],
  boards: (boards.results as { id: string; slug: string; name: string; ownerId: string | null; displayName: string | null; active: number }[]).map(row => ({
   id: row.id, slug: row.slug, name: row.name,
   owner: row.ownerId ? { id: row.ownerId, displayName: row.displayName!, active: Boolean(row.active) } : null,
  })),
 }
}

export async function itemOwner(db: D1Database, entity: OwnedEntity, value: string): Promise<{ owner: ItemOwner | null; operators: OwnershipOperator[] }> {
 const definition = entities[entity]
 const [found, owners, operators] = await db.batch([
  db.prepare(`SELECT id FROM ${definition.source} WHERE ${definition.lookup}=?`).bind(value),
  db.prepare(`SELECT ${ownerColumns} FROM ${definition.table} a JOIN ${definition.source} s ON s.id=a.${definition.key}
   JOIN operators p ON p.id=a.operator_id WHERE s.${definition.lookup}=?`).bind(value),
  db.prepare(selectableOwners),
 ])
 if (!found.results.length) throw new NativeError('ownership_item_not_found', 404)
 const owner = owners.results[0] as (Omit<ItemOwner, 'active'> & { active: number }) | undefined
 return { owner: owner ? { ...owner, active: Boolean(owner.active) } : null, operators: operators.results as unknown as OwnershipOperator[] }
}

/** Session admission wraps this complete batch. This second assertion checks the
 * current target membership and the resource in that very same transaction. */
export async function setItemOwner(db: D1Database, entity: OwnedEntity, value: string, operatorId: string | null, actor: string) {
 const definition = entities[entity], guard = crypto.randomUUID(), now = new Date().toISOString()
 const resource = `EXISTS(SELECT 1 FROM ${definition.source} WHERE ${definition.lookup}=?)`
 try {
  await db.batch([
   db.prepare(`INSERT INTO penny_ownership_guards(id,allowed) VALUES (?,(${resource}) AND (? IS NULL OR ${activeOwner}))`).bind(guard, value, operatorId, operatorId),
   db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,details_json,occurred_at,created_at,updated_at)
    SELECT ?,'operator',?,'${entity === 'boards' ? 'ownership.default_changed' : 'ownership.assigned'}',?,s.id,
    json_object('previousOwnerId',a.operator_id,'ownerId',?),?,?,?
    FROM ${definition.source} s LEFT JOIN ${definition.table} a ON a.${definition.key}=s.id WHERE s.${definition.lookup}=?`)
    .bind(createUlid(), actor, definition.kind, operatorId, now, now, now, value),
   db.prepare(`INSERT INTO ${definition.table}(${definition.key},operator_id,updated_at)
    SELECT id,?,? FROM ${definition.source} WHERE ${definition.lookup}=?
    ON CONFLICT(${definition.key}) DO UPDATE SET operator_id=excluded.operator_id,updated_at=excluded.updated_at`).bind(operatorId, now, value),
   db.prepare('DELETE FROM penny_ownership_guards WHERE id=?').bind(guard),
  ])
 } catch (error) {
  if (String(error).includes('penny_ownership_admitted')) throw new NativeError('ownership_changed', 409, 'This item or operator is no longer available. Refresh before assigning it.')
  throw error
 }
}
