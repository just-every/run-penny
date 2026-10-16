import type { DataAuthority } from '../authority'
import { fencedDatabase } from './fenced-database'

/** A step that has not released its claim after this long is treated as stopped
 * and may be taken over. Every step is bounded well inside it. */
export const LEASE_MS = 90_000
/** Consecutive failed or stalled steps before the work waits for a person. */
export const MAX_FAILURES = 3
export type WorkKind = 'operation' | 'import'
export type ClaimRow = { work_id: string; kind: WorkKind; operator_id: string | null; operator_version: number | null; actor_id: string | null; runner: string | null; lease_until: number; steps: number; failures: number; last_error: string | null; stopped_at: number | null; finished_at: number | null; created_at: number; updated_at: number }
/** `db` is fenced to this claim; `raw` is only for releasing it. */
export type Claim = { workId: string; kind: WorkKind; token: string; db: D1Database; raw: D1Database; row: ClaimRow }
export const importWorkId = (job: string) => 'import:' + job

/** Records who confirmed the work: their standing carries it on the server after
 * the tab is gone. Registering it again (a person pressing Resume) rebinds it to
 * that person and clears a stop. `when` gates the insert inside a larger batch. */
export function registerWork(db: D1Database, workId: string, kind: WorkKind, authority?: DataAuthority, actorId?: string, when?: { sql: string; params: unknown[] }): D1PreparedStatement {
 const now = Date.now()
 // A saved import's job takes new work after it settles (undo after apply), so
 // its claim reopens; an operation's claim never does.
 return db.prepare(`INSERT INTO data_runner_claims(work_id,kind,operator_id,operator_version,actor_id,lease_until,created_at,updated_at) SELECT ?,?,?,?,?,0,?,? WHERE ${when?.sql ?? '1'}
  ON CONFLICT(work_id) DO UPDATE SET operator_id=excluded.operator_id,operator_version=excluded.operator_version,actor_id=COALESCE(excluded.actor_id,actor_id),failures=0,last_error=NULL,stopped_at=NULL,finished_at=CASE WHEN kind='import' THEN NULL ELSE finished_at END,updated_at=excluded.updated_at WHERE finished_at IS NULL OR kind='import'`)
  .bind(workId, kind, authority?.operatorId ?? null, authority?.operator.version ?? null, actorId ?? null, now, now, ...(when?.params ?? []))
}

export const readClaim = (db: D1Database, workId: string) => db.prepare('SELECT * FROM data_runner_claims WHERE work_id=?').bind(workId).first<ClaimRow>()

/** Takes the next step's claim, or null while another runner's lease is live or
 * the work is finished or waiting for a person. Taking over an expired lease
 * returns an interrupted operation step to its resumable state in the same
 * transaction; the old runner's token no longer passes any fence. */
export async function claimStep(db: D1Database, workId: string): Promise<Claim | null> {
 const row = await readClaim(db, workId), now = Date.now()
 if (!row || row.finished_at !== null || row.stopped_at !== null || row.runner !== null && row.lease_until > now) return null
 const token = crypto.randomUUID()
 const claimed = db.prepare('UPDATE data_runner_claims SET runner=?,lease_until=?,updated_at=? WHERE work_id=? AND runner IS ? AND finished_at IS NULL AND stopped_at IS NULL RETURNING *').bind(token, now + LEASE_MS, now, workId, row.runner)
 const held = 'EXISTS(SELECT 1 FROM data_runner_claims WHERE work_id=?1 AND runner=?2)'
 const recovery = row.kind === 'operation' ? [
  db.prepare(`UPDATE data_operations SET status=CASE status WHEN 'running' THEN 'pending' WHEN 'running_import' THEN 'pending_import' ELSE 'pending_r2' END,updated_at=?3 WHERE id=?1 AND kind IN ('erase','restore') AND status IN ('running','running_import','running_r2') AND ${held}`).bind(workId, token, new Date(now).toISOString()),
  db.prepare(`UPDATE data_state SET phase='locked' WHERE singleton=1 AND lock_id=?1 AND phase='applying' AND ${held}`).bind(workId, token),
 ] : []
 const [result] = await db.batch<ClaimRow>([claimed, ...recovery])
 const current = result.results[0]
 return current ? { workId, kind: row.kind, token, db: fence(db, workId, token), raw: db, row: current } : null
}

function fence(db: D1Database, workId: string, token: string): D1Database {
 return fencedDatabase(db, id => ({
  insert: db.prepare('INSERT INTO data_runner_fences(id,held) VALUES(?,EXISTS(SELECT 1 FROM data_runner_claims WHERE work_id=? AND runner=?))').bind(id, workId, token),
  remove: db.prepare('DELETE FROM data_runner_fences WHERE id=?').bind(id),
 }), { reads: 'direct', unsupported: 'unsupported_runner', strict: false })
}

export type Release = { kind: 'progress' } | { kind: 'finished'; outcome?: string } | { kind: 'failed'; code: string } | { kind: 'stopped'; code: string }
/** Releases only this runner's claim; a superseded runner changes nothing. */
export async function releaseStep(claim: Claim, release: Release): Promise<void> {
 const now = Date.now(), raw = claim.raw
 const statement = release.kind === 'progress'
  ? raw.prepare('UPDATE data_runner_claims SET runner=NULL,lease_until=0,steps=steps+1,failures=0,last_error=NULL,updated_at=? WHERE work_id=? AND runner=?').bind(now, claim.workId, claim.token)
  : release.kind === 'finished'
   ? raw.prepare('UPDATE data_runner_claims SET runner=NULL,lease_until=0,steps=steps+1,last_error=?,finished_at=?,updated_at=? WHERE work_id=? AND runner=?').bind(release.outcome ?? null, now, now, claim.workId, claim.token)
   : raw.prepare(`UPDATE data_runner_claims SET runner=NULL,lease_until=0,failures=failures+1,last_error=?,stopped_at=CASE WHEN ? OR failures+1>=? THEN ? END,updated_at=? WHERE work_id=? AND runner=?`).bind(release.code, release.kind === 'stopped' ? 1 : 0, MAX_FAILURES, now, now, claim.workId, claim.token)
 await statement.run()
}
