import type { Session } from '../../../../base/modules/operator-auth/index.mjs'
import { NativeError } from '../auth/native-tokens'

export type DataAuthority = Pick<Session, 'id' | 'operatorId' | 'operator'>

/** Maintenance owns its own phase/operation fences. Native authority must still
 * be current in the transaction, including while that operation holds the lock. */
export async function dataBatch<T = Record<string, unknown>>(db:D1Database,statements:D1PreparedStatement[],authority?:DataAuthority):Promise<D1Result<T>[]> {
 if(!authority)return db.batch<T>(statements)
 const id=crypto.randomUUID()
 try{
  const result=await db.batch<T>([
   db.prepare(`INSERT INTO penny_integration_guards(id,allowed) VALUES (?,EXISTS(
    SELECT 1 FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id
    WHERE s.id=? AND s.operator_id=? AND s.revoked_at IS NULL
    AND s.expires_at>unixepoch('subsec')*1000 AND o.status='active'
    AND o.version=s.operator_version AND o.version=?))`).bind(id,authority.id,authority.operatorId,authority.operator.version),
   ...statements,
   db.prepare('DELETE FROM penny_integration_guards WHERE id=?').bind(id),
  ])
  return result.slice(1,-1)
 }catch(error){
  if(error instanceof Error&&error.message.includes('penny_integration_authority'))throw new NativeError('unauthenticated',401)
  throw error
 }
}

export async function assertDataAuthority(db:D1Database,authority?:DataAuthority):Promise<void>{
 if(authority)await dataBatch(db,[db.prepare('SELECT 1')],authority)
}
