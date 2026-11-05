import type {Row} from './archive'

// Issuing a destination credential is installation setup, not business data.
// Only an audit tied to a credential this installation owns is eligible.
const keyAudit=`actor_type='operator' AND action='integration.key_issued' AND entity_type='integration_key' AND details_json IS NULL AND EXISTS(
 SELECT 1 FROM integration_tokens t JOIN penny_api_issuers i ON i.token_id=t.id
 WHERE t.namespace='penny-api' AND t.id=audit_entries.entity_id AND i.actor_id=audit_entries.actor_id
)`
export const businessAuditQuery=`SELECT 1 AS occupied FROM audit_entries WHERE NOT (${keyAudit}) LIMIT 1`

/** Portable actors retain historical attribution. Destination credentials keep
 * their native issuer and version, and use that issuer's matching product actor. */
export async function restoreKeyCustody(db:D1Database,archivedActors:Row[]):Promise<D1PreparedStatement[]>{
 const [actors,audits]=await db.batch([
  db.prepare('SELECT DISTINCT o.* FROM operators o JOIN penny_api_issuers i ON i.actor_id=o.id'),
  db.prepare(`SELECT * FROM audit_entries WHERE ${keyAudit}`),
 ])
 const statements:D1PreparedStatement[]=[],actorIds=new Map<string,string>()
 for(const actor of actors.results as Row[]){
  const restored=archivedActors.find(row=>row.email===actor.email),id=String(restored?.id??actor.id)
  actorIds.set(String(actor.id),id)
  if(!restored)statements.push(db.prepare('INSERT INTO operators(id,email,display_name,created_at,updated_at) VALUES(?,?,?,?,?)').bind(actor.id,actor.email,actor.display_name,actor.created_at,actor.updated_at))
  statements.push(db.prepare('UPDATE penny_api_issuers SET actor_id=? WHERE actor_id=?').bind(id,actor.id))
 }
 for(const audit of audits.results as Row[]){
  const columns=Object.keys(audit),values:Row={...audit,actor_id:actorIds.get(String(audit.actor_id))??audit.actor_id}
  statements.push(db.prepare(`INSERT INTO audit_entries(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`).bind(...columns.map(column=>values[column])))
 }
 return statements
}
