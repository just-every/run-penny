import type { Session } from '../../../../base/modules/operator-auth/index.mjs'
import { NativeError } from '../auth/native-tokens'

/** A browser session's authority, or, with `standing`, the authority of work an
 * operator confirmed that continues on the server after the tab is gone: that
 * operator must still be active at the same version (removal or a role change
 * stops it), but signing out or closing the tab does not. */
export type DataAuthority = Pick<Session, 'id' | 'operatorId' | 'operator'> & { standing?: true }

/** SQL that holds while this authority is current. */
export function authorityCondition(authority: DataAuthority): { sql: string; params: unknown[] } {
 if (authority.standing) return { sql: "EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=? AND o.status='active' AND o.version=?)", params: [authority.operatorId, authority.operator.version] }
 return {
  sql: `EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id
   WHERE s.id=? AND s.operator_id=? AND s.revoked_at IS NULL
   AND s.expires_at>unixepoch('subsec')*1000 AND o.status='active'
   AND o.version=s.operator_version AND o.version=?)`,
  params: [authority.id, authority.operatorId, authority.operator.version],
 }
}

/** Maintenance owns its own phase/operation fences. Native authority must still
 * be current in the transaction, including while that operation holds the lock. */
export async function dataBatch<T = Record<string, unknown>>(db:D1Database,statements:D1PreparedStatement[],authority?:DataAuthority):Promise<D1Result<T>[]> {
 if(!authority){try{return await db.batch<T>(statements)}catch(error){throw superseded(error)}}
 const id=crypto.randomUUID(),condition=authorityCondition(authority)
 try{
  const result=await db.batch<T>([
   db.prepare(`INSERT INTO penny_integration_guards(id,allowed) VALUES (?,${condition.sql})`).bind(id,...condition.params),
   ...statements,
   db.prepare('DELETE FROM penny_integration_guards WHERE id=?').bind(id),
  ])
  return result.slice(1,-1)
 }catch(error){
  if(error instanceof Error&&error.message.includes('penny_integration_authority'))throw new NativeError('unauthenticated',401)
  throw superseded(error)
 }
}
/** A runner whose claim was taken over after its lease (runner/claims.ts). */
const superseded=(error:unknown)=>error instanceof Error&&error.message.includes('data_runner_superseded')?new NativeError('data_runner_superseded',409):error

export async function assertDataAuthority(db:D1Database,authority?:DataAuthority):Promise<void>{
 if(authority)await dataBatch(db,[db.prepare('SELECT 1')],authority)
}
