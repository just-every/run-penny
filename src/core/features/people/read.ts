import {MutationError} from '@/core/app/operator-mutations'
import {voteImportanceSql} from '../requests/vote-importance'
import {nativeProxyPredicate} from '../requests/proxy-votes'
const requestHref=(id:string,slug:string)=>`/app/moderation?item=${id}#request-${slug}`
const sourceUrl=(value:string|null)=>{try{const url=new URL(value??'');return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?[url.href]:[]}catch{return []}}
export async function readPerson(db:D1Database,id:string){
 const person=await db.prepare('SELECT id,display_name AS displayName,blocked_at AS blockedAt FROM requesters WHERE id=?').bind(id).first<{id:string;displayName:string;blockedAt:string|null}>()
 if(!person)throw new MutationError(404,'Person not found.')
 const rows=async<T>(sql:string)=>(await db.prepare(sql).bind(id).all<T>()).results
 const [addresses,accounts,submitted,votes,follows,comments,evidence,permissions,outcomes,customFields]=await Promise.all([
  rows<{email:string;verifiedAt:string|null;suppressedAt:string|null}>('SELECT email,verified_at AS verifiedAt,suppressed_at AS suppressedAt FROM requester_addresses WHERE requester_id=? ORDER BY created_at,id'),
  rows<{id:string;slug:string;name:string;revenueCents:number|null}>('SELECT a.id,a.slug,a.name,a.revenue_cents AS revenueCents FROM accounts a JOIN requester_account_links l ON l.account_id=a.id WHERE l.requester_id=? ORDER BY a.name,a.id'),
  rows<{id:string;slug:string;title:string}>('SELECT id,slug,title FROM requests WHERE author_requester_id=? ORDER BY created_at,id'),
  rows<{id:string;slug:string;title:string;importance:number|null;proxy:number;supporterType:string|null}>(`SELECT r.id,r.slug,r.title,${voteImportanceSql()} importance,${nativeProxyPredicate()} proxy,(SELECT supporter_type FROM request_vote_supporter_types WHERE request_id=v.request_id AND requester_id=v.requester_id) supporterType FROM request_votes v JOIN requests r ON r.id=v.request_id WHERE v.requester_id=? ORDER BY v.created_at,r.id`),
  rows<{id:string;slug:string;title:string;mutedAt:string|null}>('SELECT r.id,r.slug,r.title,f.muted_at AS mutedAt FROM request_follows f JOIN requests r ON r.id=f.request_id WHERE f.requester_id=? ORDER BY f.created_at,r.id'),
  rows<{id:string;requestId:string;slug:string;title:string;body:string}>('SELECT c.id,c.request_id AS requestId,r.slug,r.title,c.body FROM request_comments c JOIN requests r ON r.id=c.request_id WHERE c.requester_id=? ORDER BY c.created_at,c.id'),
  rows<{id:string;sourceLabel:string|null;wording:string}>(`SELECT e.id,e.source_label AS sourceLabel,(SELECT wording FROM evidence_versions WHERE evidence_id=e.id ORDER BY version_number DESC LIMIT 1) wording FROM evidence_items e WHERE e.requester_id=? ORDER BY e.observed_at DESC,e.id`),
  rows<{id:string;source:string;grantedAt:string;revokedAt:string|null;suppressedAt:string|null;requestId:string|null;slug:string|null}>('SELECT p.id,p.source,p.granted_at AS grantedAt,p.revoked_at AS revokedAt,p.suppressed_at AS suppressedAt,p.request_id AS requestId,r.slug FROM requester_update_permissions p LEFT JOIN requests r ON r.id=p.request_id WHERE p.requester_id=? ORDER BY p.created_at,p.id'),
  rows<{id:string;outcome:string;slug:string;title:string}>('SELECT o.id,o.outcome,r.slug,v.title FROM release_outcomes o JOIN release_versions v ON v.id=o.release_version_id JOIN releases r ON r.id=v.release_id WHERE o.requester_id=? ORDER BY o.updated_at,o.id'),
  rows<{name:string;valueJson:string}>('SELECT d.name,v.value_json AS valueJson FROM custom_field_values v JOIN custom_field_definitions d ON d.id=v.definition_id WHERE v.entity_id=? AND d.entity_type=\'requester\' ORDER BY d.name,d.id'),
 ])
 return {...person,addresses,accounts:accounts.map(a=>({...a,href:'/app/customers/'+a.slug})),submitted:submitted.map(r=>({...r,href:requestHref(r.id,r.slug)})),votes:votes.map(r=>({...r,href:requestHref(r.id,r.slug)})),follows:follows.map(r=>({...r,href:requestHref(r.id,r.slug)})),comments:comments.map(r=>({...r,href:requestHref(r.requestId,r.slug)})),evidence:evidence.map(e=>({...e,href:`/app/feedback?item=${e.id}#evidence-${e.id}`,sourceUrls:sourceUrl(e.sourceLabel)})),permissions:permissions.map(p=>({...p,href:p.requestId&&p.slug?requestHref(p.requestId,p.slug):'/app/customers?directory=requesters'})),outcomes:outcomes.map(o=>({...o,href:'/app/releases/'+o.slug})),customFields:customFields.map(f=>({name:f.name,value:JSON.parse(f.valueJson) as unknown})),actions:{merge:`/app/customers?directory=requesters&item=${id}#merge-requesters-${id}`,block:`/app/customers?directory=requesters&item=${id}#requesters-${id}`,export:'/app/data',erase:'/app/data'}}
}
export type PersonView=Awaited<ReturnType<typeof readPerson>>
