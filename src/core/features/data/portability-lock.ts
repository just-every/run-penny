import { dataBatch, type DataAuthority } from './authority'
import { NativeError } from '../auth/native-tokens'
import { fencedDatabase } from './runner/fenced-database'
/** Recovery of a Base snapshot belongs to its current native owner too. */
export async function requirePortabilityOwner(db: D1Database, actor: string, authority?: DataAuthority) {
 if (!authority || authority.operator.role !== 'owner' || !actor.startsWith(authority.operatorId + ':') || !await db.prepare("SELECT 1 FROM oa_sessions WHERE id=? AND operator_id=? AND kind='native'").bind(authority.id, authority.operatorId).first()) throw new NativeError('forbidden_portability_owner', 403)
}
/** A durable runner token serializes Base calls and fences a stopped/recovered
 * request at every D1 transaction, including writes after an R2 await. */
export async function claimPortabilityRunner(db: D1Database, operation: string, authority?: DataAuthority) {
 const runner = crypto.randomUUID()
 const [claim] = await dataBatch(db, [db.prepare("UPDATE data_operations SET status='running',payload_json=json_set(payload_json,'$.runner',?) WHERE id=? AND status='pending' AND EXISTS(SELECT 1 FROM data_state WHERE lock_id=? AND phase='locked') RETURNING id").bind(runner, operation, operation)], authority)
 if (claim.results.length !== 1) throw new NativeError('data_runner_busy', 409)
 // Base's reviewed export uses prepare/bind/first/all/run and batch only.
 const guarded = fencedDatabase(db, guard => ({
  insert: db.prepare("INSERT INTO penny_integration_guards(id,allowed) VALUES(?,EXISTS(SELECT 1 FROM data_operations o JOIN data_state s ON s.lock_id=o.id WHERE o.id=? AND o.status='running' AND s.phase='locked' AND json_extract(o.payload_json,'$.runner')=?))").bind(guard, operation, runner),
  remove: db.prepare('DELETE FROM penny_integration_guards WHERE id=?').bind(guard),
 }), { reads: 'fenced', unsupported: 'unsupported_portability', strict: true, authority })
 return {
  db: guarded,
  async release() {
   // Compensation after revocation may release only this runner token. It
   // retains the data lock; a fresh owner must authorize cleanup or new work.
   await db.prepare("UPDATE data_operations SET status='pending',payload_json=json_remove(payload_json,'$.runner') WHERE id=? AND status='running' AND json_extract(payload_json,'$.runner')=? AND EXISTS(SELECT 1 FROM data_state WHERE lock_id=? AND phase='locked')").bind(operation, runner, operation).run()
  },
 }
}
