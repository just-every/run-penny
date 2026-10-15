import { createUlid } from '@/core/shared/ulid'

/** A system audit row for one finished automated mail attempt. It follows the
 * attempt's own state change in the same batch and is written only when that
 * change applied, so a late or repeated finish records nothing. Details are
 * state and reason codes, never addresses or message content. */
export function systemDeliveryAudit(db:D1Database,feature:string,action:string,entityType:string,entityId:string,details:{state:string;reason:string|null}){
 const now=new Date().toISOString()
 return db.prepare("INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,details_json,occurred_at,created_at,updated_at) SELECT ?,'system',?,?,?,?,?,?,?,? WHERE changes()>0").bind(createUlid(),feature,action,entityType,entityId,JSON.stringify(details),now,now,now)
}
