import {createUlid} from '@/core/shared/ulid'

/** Native ids authorize. Product operators are an attribution projection, made
 * only when a native person actually enters a product action. A legacy row may
 * be associated once using the current native account's address; token claims
 * never select an account, and an existing native-id binding never moves. */
export async function operatorActor(db:D1Database,nativeId:string){
 const read=()=>db.prepare(`SELECT p.id,p.email,p.display_name AS displayName FROM penny_operator_bindings b
 JOIN operators p ON p.id=b.actor_id JOIN oa_operators o ON o.id=b.native_operator_id
 WHERE o.id=? AND o.status='active'`).bind(nativeId).first<{id:string;email:string;displayName:string}>()
 const existing=await read()
 if(existing)return existing
 const native=await db.prepare("SELECT version FROM oa_operators WHERE id=? AND status='active'").bind(nativeId).first<{version:number}>()
 if(!native)return null
 const now=new Date().toISOString()
 // Both projection creation and association recheck the same native identity
 // and version in their transaction. Restoration can replace product rows,
 // while native authority and current-person admission stay outside archives.
 await db.batch([
  db.prepare(`INSERT INTO operators(id,email,display_name,created_at,updated_at)
   SELECT ?,o.email,o.display_name,?,? FROM oa_operators o WHERE o.id=? AND o.version=? AND o.status='active'
   AND NOT EXISTS(SELECT 1 FROM operators p WHERE p.email=o.email)
   AND NOT EXISTS(SELECT 1 FROM penny_operator_bindings b WHERE b.native_operator_id=o.id)`)
   .bind(createUlid(),now,now,nativeId,native.version),
  db.prepare(`INSERT INTO penny_operator_bindings(native_operator_id,actor_id)
   SELECT o.id,p.id FROM oa_operators o JOIN operators p ON p.email=o.email
   WHERE o.id=? AND o.version=? AND o.status='active'
   AND NOT EXISTS(SELECT 1 FROM penny_operator_bindings b WHERE b.native_operator_id=o.id)
   ON CONFLICT(native_operator_id) DO NOTHING`).bind(nativeId,native.version),
 ])
 return read()
}
