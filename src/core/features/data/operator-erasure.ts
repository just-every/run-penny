import { NativeError, digest } from '../auth/native-tokens'
import { createUlid } from '@/core/shared/ulid'
import { applyStart, audit, canonical, finish, hash, keyColumns, readErasureJournal, reserve, rowKey, schema, state, ERASURE_LIMITS, type Row } from './archive'
import { assertDataAuthority, dataBatch, type DataAuthority } from './authority'

/** A former operator is a person too. Their identity is redacted in place so
 * the business records they attributed keep one stable, anonymous author: the
 * product and Base operator rows keep only their opaque IDs, copies of their
 * name in attribution columns become the anonymous label, their sign-in,
 * session, rate and identity-provider rows are deleted, mail attempts lose the
 * address and audit details naming them are cleared. Anything else that still
 * holds their address is an ambiguous copy and blocks the erasure. */
const LABEL = 'Erased operator'
const fail = (code: string, status: 400 | 409 | 413 = 409): never => { throw new NativeError(code, status) }
// Attribution columns Penny fills from the operator's display name.
const attributions = [
 { table: 'release_versions', column: 'author_name', owner: 'release_id IN (SELECT id FROM releases WHERE author_operator_id=?)' },
 { table: 'request_comments', column: 'public_author_display_name', owner: 'operator_id=?' },
 { table: 'requests', column: 'public_author_display_name', owner: 'author_operator_id=?' },
] as const
const attempts = ['notification_attempts', 'notification_outbox_attempts'] as const
// Rows these tables hold for the operator are deleted or redacted below, and
// audit details are cleared, so they are not ambiguous copies.
const handled = new Set(['operators', 'operator_sessions', 'native_magic_links', 'local_auth_outbox', 'native_rate_limits', 'audit_entries', 'data_tombstones', 'data_operations', ...attempts])

type Operator = { id: string; email: string; display_name: string }
// Audit details the erasure clears: rows about or by the operator (their product
// or Base operator id) that name them, and any row holding their address. A row
// only repeating their display name is someone else's record and blocks instead.
const ownAudit = '(actor_id IN (?1,?2) OR entity_id IN (?1,?2))'
const auditName = 'instr(details_json,?4)>0'
const auditCleared = `((${ownAudit} AND (${auditName} OR instr(details_json,?3)>0)) OR instr(details_json,?3)>0)`
const auditValues = (operator: Operator, native: Native) => [operator.id, native?.id ?? operator.id, operator.email, JSON.stringify(operator.display_name)]
type Native = { id: string; version: number; status: string } | null
/** A blocked copy. A name-only audit row also carries its action and time and is
 * `resolvable`: the owner may confirm it unrelated (kept) or clear its details. */
export type BlockedCopy = { table: string; key: string; columns: string[]; action?: string; occurredAt?: string; resolvable?: true }
export type AuditResolution = { id: string; resolution: 'unrelated' | 'clear' }
export type OperatorErasurePlan = { table: 'operators'; id: string; planHash: string; counts: Record<string, number>; files: string[]; blockedCopies: BlockedCopy[] }

async function subject(db: D1Database, id: string): Promise<{ operator: Operator; native: Native }> {
 const operator = await db.prepare('SELECT id,email,display_name FROM operators WHERE id=?').bind(id).first<Operator>()
 if (!operator) fail('entity_not_found', 400)
 if (operator!.email.endsWith('@erased.invalid')) fail('operator_already_erased')
 const native = await db.prepare('SELECT id,version,status FROM oa_operators WHERE lower(email)=lower(?)').bind(operator!.email).first<{ id: string; version: number; status: string }>()
 // Erasure never removes current authority: an operator is removed first.
 if (native && native.status !== 'inactive') fail('erasure_operator_active')
 return { operator: operator!, native }
}

async function counts(db: D1Database, { operator, native }: { operator: Operator; native: Native }): Promise<Record<string, number>> {
 const queries: [string, D1PreparedStatement][] = [
  ['penny_scorecard_scores', db.prepare('SELECT count(*) n FROM penny_scorecard_scores WHERE scorer_id=?').bind(operator.id)],
  ['operator_sessions', db.prepare('SELECT count(*) n FROM operator_sessions WHERE operator_id=?').bind(operator.id)],
  ['mail_event_records', db.prepare('SELECT count(*) n FROM mail_event_records WHERE operator_id=?').bind(operator.id)],
  ['native_magic_links', db.prepare('SELECT count(*) n FROM native_magic_links WHERE lower(email)=lower(?)').bind(operator.email)],
  ['local_auth_outbox', db.prepare('SELECT count(*) n FROM local_auth_outbox WHERE lower(recipient)=lower(?)').bind(operator.email)],
  ['audit_entries', db.prepare(`SELECT count(*) n FROM audit_entries WHERE ${auditCleared}`).bind(...auditValues(operator, native))],
  ...attributions.map(({ table, column, owner }) => [`${table}:${column}`, db.prepare(`SELECT count(*) n FROM ${table} WHERE ${owner} AND ${column}=?`).bind(operator.id, operator.display_name)] as [string, D1PreparedStatement]),
  ...attempts.map(table => [table, db.prepare(`SELECT count(*) n FROM ${table} WHERE lower(recipient_email)=lower(?)`).bind(operator.email)] as [string, D1PreparedStatement]),
  ...(native ? [['oa_external_identities', db.prepare('SELECT count(*) n FROM oa_external_identities WHERE operator_id=?').bind(native.id)] as [string, D1PreparedStatement]] : []),
 ]
 const results = await db.batch<{ n: number }>(queries.map(([, query]) => query))
 const found: Record<string, number> = { operators: 1, ...(native ? { oa_operators: 1 } : {}) }
 for (const [index, [table]] of queries.entries()) { const n = results[index].results[0].n; if (n) found[table] = (found[table] ?? 0) + n }
 return found
}

// Free text, settings and custody elsewhere may hold the address. Penny does not
// guess whether such a copy is the person's data or a business record.
async function copies(db: D1Database, operator: Operator, native: Native): Promise<BlockedCopy[]> {
 const blocked: BlockedCopy[] = []
 const audits = (await db.prepare(`SELECT id,action,occurred_at FROM audit_entries WHERE ${auditName} AND NOT ${auditCleared} ORDER BY occurred_at,id LIMIT 21`).bind(...auditValues(operator, native)).all<{ id: string; action: string; occurred_at: string }>()).results
 for (const row of audits) blocked.push({ table: 'audit_entries', key: canonical([row.id]), columns: ['details_json'], action: row.action, occurredAt: row.occurred_at, ...(audits.length <= 20 ? { resolvable: true as const } : {}) })
 for (const table of (await schema(db)).filter(table => !handled.has(table.name))) {
  const columns = table.columns.map(column => column.name), ident = (name: string) => '"' + name + '"'
  // Receipts of the operator's own mail events are deleted with them.
  const own = table.name === 'mail_event_records' ? ' AND operator_id IS NOT ?2' : ''
  const rows = (await db.prepare(`SELECT * FROM ${ident(table.name)} WHERE (${columns.map(name => `instr(lower(CAST(${ident(name)} AS TEXT)),lower(?1))>0`).join(' OR ')})${own} LIMIT 21`).bind(operator.email, ...(own ? [operator.id] : [])).all<Row>()).results
  for (const row of rows) blocked.push({ table: table.name, key: rowKey(table, row), columns: columns.filter(name => typeof row[name] === 'string' && String(row[name]).toLowerCase().includes(operator.email.toLowerCase())) })
 }
 return blocked
}

export async function planOperatorErasure(db: D1Database, id: string): Promise<OperatorErasurePlan> {
 const found = await subject(db, id), current = (await state(db))!
 const planned = { counts: await counts(db, found), files: [] as string[], blockedCopies: await copies(db, found.operator, found.native) }
 const planHash = await hash({ origin: current.origin, epoch: current.epoch, table: 'operators', id, operator: found.operator, native: found.native, ...planned })
 return { table: 'operators', id, planHash, ...planned }
}

// Every remaining copy must be a listed name-only audit row with exactly one
// resolution; anything else still blocks.
function resolved(plan: OperatorErasurePlan, resolutions: AuditResolution[]): boolean {
 const listed = plan.blockedCopies.filter(copy => copy.resolvable).map(copy => JSON.parse(copy.key)[0] as string)
 return plan.blockedCopies.every(copy => copy.resolvable) && resolutions.length === listed.length
  && new Set(resolutions.map(item => item.id)).size === resolutions.length && resolutions.every(item => listed.includes(item.id))
}

export type OperatorErasurePayload = { table: 'operators'; id: string; planHash: string; resolutions: AuditResolution[] }
/** Checks the reviewed plan and the owner's choice for each listed copy, then
 * takes the data lock; the redaction itself runs as a server step. */
export async function startOperatorErasure(db: D1Database, id: string, planHash: string, authority?: DataAuthority, resolutions: AuditResolution[] = []): Promise<string> {
 const reviewed = await planOperatorErasure(db, id)
 if (reviewed.planHash !== planHash) fail('erasure_plan_changed')
 if (!resolved(reviewed, resolutions)) fail('erasure_ambiguous_copies')
 await assertDataAuthority(db, authority)
 return reserve(db, 'erase', { table: 'operators', id, planHash, resolutions } satisfies OperatorErasurePayload, authority)
}
/** The redaction's one transaction, inside the lock; file cleanup follows. */
export async function applyOperatorErasure(db: D1Database, operation: string, { id, planHash, resolutions }: OperatorErasurePayload, authority?: DataAuthority): Promise<void> {
 try {
  const found = await subject(db, id), { operator, native } = found
  const plan = await planOperatorErasure(db, id)
  if (plan.planHash !== planHash || !resolved(plan, resolutions)) fail('erasure_plan_changed')
  const cleared = resolutions.filter(item => item.resolution === 'clear').map(item => item.id), confirmed = resolutions.filter(item => item.resolution === 'unrelated').map(item => item.id)
  const current = (await state(db))!, epoch = current.epoch + 1, journal = await readErasureJournal(db)
  if (journal.tombstones.length + 1 > ERASURE_LIMITS.rows) fail('journal_limit', 413)
  const anonymous = createUlid().toLowerCase(), email = `operator-${anonymous}@erased.invalid`, now = new Date().toISOString(), epochMs = Date.now()
  const subjectHashes = await Promise.all([operator.email, operator.email.toLowerCase(), operator.id, ...(native ? [native.id] : [])].map(digest))
  const operatorsTable = (await schema(db)).find(table => table.name === 'operators')!
  // The product row keeps its key, so it receives no row tombstone: a newer
  // archive restores the anonymous author. This opaque redaction checkpoint
  // advances the journal, so the latest journal refuses any older archive.
  const checkpoint = await hash([current.origin, 'operators', 'redacted', rowKey(operatorsTable, { id: operator.id }), keyColumns(operatorsTable).length])
  const guard = (sql: string, ...params: unknown[]) => db.prepare(`INSERT INTO ik_d1_assertions(ok) SELECT CASE WHEN ${sql} THEN 1 ELSE 0 END`).bind(...params)
  const statements: D1PreparedStatement[] = [...applyStart(db, operation),
   guard('EXISTS(SELECT 1 FROM operators WHERE id=? AND email=? AND display_name=?)', operator.id, operator.email, operator.display_name),
   native ? guard("EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND version=? AND status='inactive')", native.id, native.version) : guard('NOT EXISTS(SELECT 1 FROM oa_operators WHERE lower(email)=lower(?))', operator.email),
   db.prepare('UPDATE penny_scorecard_scores SET scorer_id=NULL WHERE scorer_id=?').bind(operator.id),
   db.prepare('UPDATE operators SET email=?,display_name=?,updated_at=? WHERE id=?').bind(email, LABEL, now, operator.id),
   db.prepare('DELETE FROM operator_sessions WHERE operator_id=?').bind(operator.id),
   db.prepare('DELETE FROM mail_event_records WHERE operator_id=?').bind(operator.id),
   db.prepare('DELETE FROM operator_mail_suppressions WHERE operator_id=?').bind(operator.id),
   db.prepare('DELETE FROM native_magic_links WHERE lower(email)=lower(?)').bind(operator.email),
   db.prepare('DELETE FROM local_auth_outbox WHERE lower(recipient)=lower(?)').bind(operator.email),
   db.prepare('DELETE FROM native_rate_limits WHERE subject_hash IN (SELECT value FROM json_each(?))').bind(JSON.stringify(subjectHashes)),
   ...attributions.map(({ table, column, owner }) => db.prepare(`UPDATE ${table} SET ${column}=? WHERE ${owner} AND ${column}=?`).bind(LABEL, operator.id, operator.display_name)),
   ...attempts.map(table => db.prepare(`UPDATE ${table} SET recipient_email=? WHERE lower(recipient_email)=lower(?)`).bind(email, operator.email)),
   db.prepare(`UPDATE audit_entries SET details_json=NULL,updated_at=?5 WHERE ${auditCleared}`).bind(...auditValues(operator, native), now),
   // The owner's choice for each listed name-only row: cleared, or confirmed unrelated and kept.
   db.prepare('UPDATE audit_entries SET details_json=NULL,updated_at=? WHERE id IN (SELECT value FROM json_each(?))').bind(now, JSON.stringify(cleared)),
  ]
  if (native) statements.push(
   db.prepare('UPDATE oa_operators SET email=?,display_name=? WHERE id=?').bind(email, LABEL, native.id),
   db.prepare('DELETE FROM oa_provider_sessions WHERE session_id IN (SELECT id FROM oa_sessions WHERE operator_id=?)').bind(native.id),
   db.prepare('DELETE FROM oa_external_identities WHERE operator_id=?').bind(native.id),
   db.prepare('UPDATE oa_sessions SET revoked_at=COALESCE(revoked_at,?) WHERE operator_id=?').bind(epochMs, native.id),
   db.prepare('UPDATE oc_owner_claims SET email=? WHERE operator_id=?').bind(email, native.id),
  )
  statements.push(
   db.prepare('UPDATE oa_auth_audit SET value=NULL WHERE instr(value,?)>0').bind(operator.email),
   db.prepare('DELETE FROM oa_limits WHERE instr(key,?)>0 OR key IN (SELECT value FROM json_each(?))').bind(operator.email.toLowerCase(), JSON.stringify(subjectHashes)),
  )
  // Development mail holds sign-in links for the address and is never portable.
  if (await db.prepare("SELECT 1 present FROM sqlite_master WHERE type='table' AND name='rer_mail_development_outbox'").first()) statements.push(db.prepare("DELETE FROM rer_mail_development_outbox WHERE instr(lower(message),lower(?))>0").bind(operator.email))
  statements.push(
   db.prepare('INSERT INTO data_tombstones(epoch,table_name,key_hash) VALUES(?,?,?)').bind(epoch, 'operators', checkpoint),
   audit(db, 'data.erased', operation, authority, JSON.stringify({ phase: 'operator_redacted', targetType: 'operators', targetReference: await hash([current.origin, 'operators', operator.id]), auditCopiesCleared: cleared, auditCopiesConfirmedUnrelated: confirmed })),
   db.prepare('DELETE FROM ik_d1_assertions'),
   db.prepare("UPDATE data_state SET epoch=?,phase='locked' WHERE singleton=1 AND lock_id=?").bind(epoch, operation),
   db.prepare("UPDATE data_operations SET status='pending_r2',payload_json=?,updated_at=? WHERE id=?").bind(canonical({ keys: [] }), now, operation),
  )
  try { await dataBatch(db, statements, authority) }
  catch (error) { if (String(error).includes('IMPORT_ATOMIC_GUARD')) fail('erasure_plan_changed'); throw error }
 } catch (error) {
  const pending = await db.prepare('SELECT status FROM data_operations WHERE id=?').bind(operation).first<string>('status')
  if (pending === 'pending_r2') return
  // A superseded runner leaves the operation to the runner that took it over.
  if (!(error instanceof NativeError && error.code === 'data_runner_superseded')) await finish(db, operation, 'aborted')
  throw error
 }
}
