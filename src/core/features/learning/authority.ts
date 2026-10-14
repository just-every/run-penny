import {NativeError} from '../auth/native-tokens'
import {guardedDatabase,type AuthorityGuard} from '../integrations/guarded-database'
import type {Investigation,Source} from './schema'
export function scopeGuard(i:Investigation,s:Source):AuthorityGuard {
 return {sql:`EXISTS(SELECT 1 FROM learning_investigations i JOIN learning_sources s ON s.id=i.source_id JOIN oa_operators o ON o.id=i.native_operator_id WHERE i.id=? AND i.version=? AND i.purpose=? AND i.source_id=? AND s.version=? AND s.resource_ids_json=? AND s.installation_id IS ? AND s.state='active' AND i.state='active' AND i.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now') AND i.spent_micros<=i.budget_micros AND i.max_run_cost_micros=? AND o.status='active' AND o.version=i.operator_version AND EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle'))`,params:[i.id,i.version,i.purpose,s.id,s.version,s.resource_ids_json,s.installation_id,i.max_run_cost_micros]}
}
export function scopedDatabase(db:D1Database,i:Investigation,s:Source){return guardedDatabase(db,scopeGuard(i,s))}
export async function assertScope(db:D1Database,i:Investigation,s:Source){const guard=scopeGuard(i,s);if(!await db.prepare(`SELECT (${guard.sql}) ok`).bind(...guard.params).first('ok'))throw new NativeError('learning_scope_changed',409)}
export async function context(db:D1Database,id:string){const i=await db.prepare('SELECT * FROM learning_investigations WHERE id=?').bind(id).first<Investigation>();if(!i)throw new NativeError('learning_not_found',404);const s=await db.prepare('SELECT * FROM learning_sources WHERE id=?').bind(i.source_id).first<Source>();if(!s)throw new NativeError('learning_source_unavailable',409);return {i,s}}
