import { NativeError } from '../auth/native-tokens'
const cell=(value:unknown)=>{const text=value==null?'':String(value);return '"'+(/^\s*[=+@\-\t\r]/.test(text)?"'"+text:text).replaceAll('"','""')+'"'}
export async function proxyVotesCsv(db:D1Database,proxyPredicate:string){
 const rows=await db.prepare(`SELECT r.slug AS request,p.id AS customer_id,p.display_name AS customer,
  (SELECT group_concat(email,'; ') FROM requester_addresses WHERE requester_id=p.id) AS addresses,
  ${proxyPredicate} AS proxy,proxy.recorder_operator_id AS recorder_id,o.display_name AS recorder,
  proxy.source,proxy.source_url,v.created_at AS voted_at
  FROM request_votes v JOIN requests r ON r.id=v.request_id JOIN requesters p ON p.id=v.requester_id
  LEFT JOIN penny_proxy_votes proxy ON proxy.requester_id=p.id AND proxy.request_id=(SELECT pv.request_id FROM penny_proxy_votes pv JOIN request_canonical_roots root ON root.origin_id=pv.request_id WHERE root.canonical_id=r.id AND pv.requester_id=p.id ORDER BY pv.created_at,pv.request_id LIMIT 1)
  LEFT JOIN operators o ON o.id=proxy.recorder_operator_id
  WHERE p.blocked_at IS NULL AND r.withdrawn_at IS NULL ORDER BY r.slug,p.id LIMIT 20001`).all<Record<string,unknown>>()
 if(rows.results.length>20000)throw new NativeError('csv_export_limit',413)
 const columns=['request','customer_id','customer','addresses','proxy','recorder_id','recorder','source','source_url','voted_at']
 return new Response([columns.map(cell).join(','),...rows.results.map(row=>columns.map(key=>cell(row[key])).join(','))].join('\r\n')+'\r\n',{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="penny-voters.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
}
