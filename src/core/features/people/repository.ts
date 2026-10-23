import {fieldSnapshot} from '../settings/field-snapshot'
import {personActivity} from './activity'
import type {PersonProfile} from './types'
export async function readPerson(db:D1Database,id:string,page:number):Promise<PersonProfile|null>{
 const person=await db.prepare(`SELECT p.id,p.display_name AS displayName,p.blocked_at AS blockedAt,(SELECT target_requester_id FROM requester_identity_merges WHERE source_requester_id=p.id) AS mergedIntoId,(SELECT muted_at FROM requester_notification_preferences WHERE requester_id=p.id) AS notificationMutedAt FROM requesters p WHERE p.id=?`).bind(id).first<Pick<PersonProfile,'id'|'displayName'|'blockedAt'|'mergedIntoId'|'notificationMutedAt'>>()
 if(!person)return null
 // The existing directory address plus the verified addresses shown on voter lists.
 // ARR/MRR are intentionally absent: today's account schema has no such fields or permission.
 const [addresses,accounts,fields,sections]=await Promise.all([
  db.prepare(`SELECT id,email,verified_at AS verifiedAt,suppressed_at AS suppressedAt FROM requester_addresses WHERE requester_id=? AND (verified_at IS NOT NULL OR id=(SELECT id FROM requester_addresses WHERE requester_id=? ORDER BY CASE WHEN verified_at IS NOT NULL AND suppressed_at IS NULL THEN 0 ELSE 1 END,created_at,id LIMIT 1)) ORDER BY created_at,id`).bind(id,id).all<PersonProfile['addresses'][number]>(),
  db.prepare('SELECT a.id,a.name,a.slug FROM accounts a JOIN requester_account_links l ON l.account_id=a.id WHERE l.requester_id=? ORDER BY a.name,a.id').bind(id).all<{id:string;name:string;slug:string}>(),
  fieldSnapshot(db,'requester',[id]),personActivity(db,id,page,25),
 ])
 return {...person,email:addresses.results[0]?.email??null,addresses:addresses.results,accounts:accounts.results.map(a=>({id:a.id,name:a.name,href:`/app/customers/${encodeURIComponent(a.slug)}`})),customFields:Object.values(fields)[0]?.data??[],page,pageSize:25,sections}
}
