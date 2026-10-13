import type { DatabaseConnection } from '@/core/platform/database'
import type { RequesterIdentity } from '../auth/requester'
import { requesterWrite } from '../requests/write-admission'
import { createUlid } from '@/core/shared/ulid'
export interface UpdateSubscription {subscribed:boolean;grantedAt:string|null}
export const activeSubscription=`EXISTS(SELECT 1 FROM requester_update_permissions subscription WHERE subscription.requester_id=n.requester_id AND subscription.requester_address_id=a.id AND subscription.source='subscription' AND subscription.request_id IS NULL AND subscription.revoked_at IS NULL AND subscription.suppressed_at IS NULL)`
export async function readSubscription(db:D1Database,identity:RequesterIdentity):Promise<UpdateSubscription>{
 const row=await db.prepare(`SELECT p.granted_at AS grantedAt FROM requester_update_permissions p JOIN requester_addresses a ON a.id=p.requester_address_id
 WHERE p.requester_id=? AND a.email=? AND p.source='subscription' AND p.request_id IS NULL AND p.revoked_at IS NULL AND p.suppressed_at IS NULL ORDER BY p.granted_at DESC LIMIT 1`).bind(identity.requesterId,identity.verifiedEmail).first<{grantedAt:string}>()
 return {subscribed:Boolean(row),grantedAt:row?.grantedAt??null}
}
export async function changeSubscription(database:DatabaseConnection,identity:RequesterIdentity,subscribed:boolean){
 const db=database.binding,now=new Date().toISOString()
 await requesterWrite(database,identity,subscribed?[
  db.prepare(`INSERT INTO requester_update_permissions(id,requester_id,requester_address_id,request_id,source,granted_at,created_at,updated_at)
  SELECT ?,?,a.id,NULL,'subscription',?,?,? FROM requester_addresses a WHERE a.requester_id=? AND a.email=? AND a.verified_at IS NOT NULL
  AND NOT EXISTS(SELECT 1 FROM requester_update_permissions p WHERE p.requester_id=a.requester_id AND p.requester_address_id=a.id AND p.source='subscription' AND p.request_id IS NULL AND p.revoked_at IS NULL AND p.suppressed_at IS NULL)`).bind(createUlid(),identity.requesterId,now,now,now,identity.requesterId,identity.verifiedEmail),
 ]:[db.prepare(`UPDATE requester_update_permissions SET revoked_at=?,updated_at=? WHERE requester_id=? AND requester_address_id IN(SELECT id FROM requester_addresses WHERE email=?) AND source='subscription' AND request_id IS NULL AND revoked_at IS NULL`).bind(now,now,identity.requesterId,identity.verifiedEmail)])
 return readSubscription(db,identity)
}
