/** Monotonic counters, rather than wall clocks, fence replay after explicit re-subscription. */
export function resumeRequestEmailStatement(db:D1Database,requesterId:string,requestId:string,now:string){
 return db.prepare(`INSERT INTO notification_link_epochs(address_id,scope,epoch,created_at,updated_at)
  SELECT address.id,root.origin_id,1,?,? FROM requester_addresses address
  CROSS JOIN request_canonical_roots root WHERE address.requester_id=?
   AND root.canonical_id=(SELECT canonical_id FROM request_canonical_roots WHERE origin_id=?)
  ON CONFLICT(address_id,scope) DO UPDATE SET epoch=epoch+1,updated_at=excluded.updated_at`).bind(now,now,requesterId,requestId)
}
export const epochSql='COALESCE((SELECT epoch FROM notification_link_epochs WHERE address_id=? AND scope=?),0)'
export async function linkEpoch(db:D1Database,addressId:string,scope:string){
 return (await db.prepare(`SELECT ${epochSql} AS epoch`).bind(addressId,scope).first<{epoch:number}>())!.epoch
}
