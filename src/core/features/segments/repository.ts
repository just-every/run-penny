import { MutationError } from '@/core/app/operator-mutations'
import { createUlid } from '@/core/shared/ulid'
import { audit } from '../decisions/write-support'
import type { SegmentInput } from './input'

interface StoredSegment { id: string; name: string; internal_owner_id: string }
export interface SavedSegment { id: string; name: string; rule: SegmentInput['rule'] }
const currentOwner = "EXISTS(SELECT 1 FROM operators p JOIN oa_operators o ON lower(o.email)=lower(p.email) WHERE p.id=? AND o.status='active')"
const decode = (row: StoredSegment): SavedSegment => ({
 id: row.id, name: row.name,
 rule: { attribute: 'internalOwnerId', operator: 'equals', value: row.internal_owner_id },
})

export async function listSegments(db: D1Database): Promise<SavedSegment[]> {
 const rows = await db.prepare('SELECT id,name,internal_owner_id FROM penny_segments ORDER BY name,id').all<StoredSegment>()
 return rows.results.map(decode)
}

export async function readSegment(db: D1Database, id: string) {
 // Rule and membership share one read transaction and its current authority fence.
 // There is no cached audience to go stale after an account changes owner.
 const [rules, members] = await db.batch<StoredSegment & { account_id: string }>([
  db.prepare('SELECT id,name,internal_owner_id FROM penny_segments WHERE id=?').bind(id),
  db.prepare('SELECT a.id AS account_id FROM accounts a JOIN penny_segments s ON s.internal_owner_id=a.internal_owner_id WHERE s.id=? ORDER BY a.id').bind(id),
 ])
 const row = rules.results[0]
 if (!row) throw new MutationError(404, 'Segment not found.')
 return { ...decode(row), accountIds: members.results.map(member => member.account_id) }
}

export async function saveSegment(db: D1Database, id: string | null, input: SegmentInput, actor: string, now: string) {
 if (id && !await db.prepare('SELECT id FROM penny_segments WHERE id=?').bind(id).first()) throw new MutationError(404, 'Segment not found.')
 const target = await db.prepare("SELECT p.id FROM operators p JOIN oa_operators o ON lower(o.email)=lower(p.email) WHERE p.id=? AND o.status='active'").bind(input.rule.value).first()
 if (!target) throw new MutationError(422, 'A current operator is required for the account owner rule.')
 const key = id ?? createUlid()
 try { await db.batch([
  db.prepare(`SELECT CASE WHEN ${currentOwner} THEN 1 ELSE json('segment_owner_unavailable') END`).bind(input.rule.value),
  id
   ? db.prepare('UPDATE penny_segments SET name=?,internal_owner_id=?,updated_at=? WHERE id=?').bind(input.name, input.rule.value, now, key)
   : db.prepare('INSERT INTO penny_segments(id,name,internal_owner_id,created_by_operator_id,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(key, input.name, input.rule.value, actor, now, now),
  audit(db, actor, 'segment', key, id ? 'segment.updated' : 'segment.created', now),
 ]) } catch (error) {
  if (String(error).includes('segment_owner_unavailable')) throw new MutationError(422, 'The account owner is no longer a current operator.')
  throw error
 }
 return { id: key }
}
