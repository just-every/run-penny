import type { DatabaseConnection } from '@/core/platform/database'
import { NativeError } from '../auth/native-tokens'
import { requestStatusExpression } from '../requests/status-sql'
function cell(value:unknown){const text=value==null?'':String(value);return '"'+(/^\s*[=+@\-\t\r]/.test(text)?"'"+text:text).replaceAll('"','""')+'"'}
export async function requestCategoryCsv(database:DatabaseConnection){
 const rows=await database.binding.prepare(`SELECT r.slug AS request,r.title,r.description,b.name AS board,
  parent.name AS parent_category,c.name AS category,${requestStatusExpression} AS status,r.moderation_state AS moderation
  FROM requests r JOIN boards b ON b.id=r.board_id LEFT JOIN request_categories c ON c.id=r.category_id LEFT JOIN request_categories parent ON parent.id=c.parent_id
  ORDER BY b.slug,r.created_at,r.id LIMIT 2001`).all<Record<string,string|null>>()
 if(rows.results.length>2000)throw new NativeError('csv_export_limit',413)
 const columns=['request','title','description','board','parent_category','category','status','moderation']
 return new Response([columns.map(cell).join(','),...rows.results.map(row=>columns.map(column=>cell(row[column])).join(','))].join('\r\n')+'\r\n',{
  headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="penny-requests.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'},
 })
}
