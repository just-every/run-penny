import {createUlid} from '@/core/shared/ulid'
import {NativeError} from '../auth/native-tokens'
import {nativeProxyPredicate} from '../requests/proxy-votes'

/** UTF-8 without a BOM; every field quoted, CRLF records, formula cells treated as text. */
const cell=(value:unknown)=>{const text=value==null?'':String(value);return '"'+(/^[\s]*[=+\-@\t\r]/.test(text)?"'"+text:text).replaceAll('"','""')+'"'}
export function csvResponse(columns:readonly string[],rows:Record<string,unknown>[],kind:string){
 return new Response([columns.map(cell).join(','),...rows.map(row=>columns.map(key=>cell(row[key])).join(','))].join('\r\n')+'\r\n',{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="penny-${kind}.csv"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
}
export async function csvExport(db:D1Database,kind:'requests'|'voters',actor:{id:string}){
 const selection='SELECT id FROM requests'
 const columns=kind==='requests'?['request_id','request','title','description','board','category','vote_total']:['request_id','request','voter_id','voter','proxy','voted_at']
 const importedProxy="EXISTS(SELECT 1 FROM request_vote_supporter_types st JOIN request_canonical_roots root ON root.origin_id=st.request_id WHERE root.canonical_id=v.request_id AND st.requester_id=v.requester_id AND st.supporter_type='proxy') AND NOT EXISTS(SELECT 1 FROM request_vote_supporter_types st JOIN request_canonical_roots root ON root.origin_id=st.request_id WHERE root.canonical_id=v.request_id AND st.requester_id=v.requester_id AND st.supporter_type='unmarked')"
 const sql=kind==='requests'?`SELECT r.id AS request_id,r.slug AS request,r.title,r.description,b.name AS board,c.name AS category,(SELECT COUNT(*) FROM request_votes v JOIN requesters p ON p.id=v.requester_id WHERE v.request_id=r.id AND p.blocked_at IS NULL AND r.withdrawn_at IS NULL) AS vote_total FROM requests r JOIN boards b ON b.id=r.board_id LEFT JOIN request_categories c ON c.id=r.category_id WHERE r.id IN (${selection}) ORDER BY r.id LIMIT 20001`:`SELECT r.id AS request_id,r.slug AS request,p.id AS voter_id,p.display_name AS voter,CASE WHEN ${nativeProxyPredicate()} OR (${importedProxy}) THEN 'yes' ELSE 'no' END AS proxy,v.created_at AS voted_at FROM request_votes v JOIN requests r ON r.id=v.request_id JOIN requesters p ON p.id=v.requester_id WHERE p.blocked_at IS NULL AND r.withdrawn_at IS NULL AND r.id IN (${selection}) ORDER BY r.id,p.id LIMIT 20001`
 const now=new Date().toISOString()
 const [result]=await db.batch<Record<string,unknown>>([
  db.prepare(sql).bind(),
  db.prepare("INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) VALUES(?,'operator',?,'data.csv_exported','csv_export',?,?,?,?)").bind(createUlid(),actor.id,kind,now,now,now),
 ])
 if(result.results.length>20000)throw new NativeError('csv_export_limit',413)
 return csvResponse(columns,result.results,kind)
}
