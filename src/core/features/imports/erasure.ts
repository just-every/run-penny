import type { Row } from '../data/archive'
export function importErasureStatements(db:D1Database,selected:Record<string,Row[]>):D1PreparedStatement[] {
 const statements:D1PreparedStatement[]=[]
 const records=selected.feedback_import_records??[]
 for(let start=0;start<records.length;start+=250){const rows=records.slice(start,start+250)
  statements.push(db.prepare("INSERT OR IGNORE INTO feedback_import_tombstones(target_kind,target_id) SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]') FROM json_each(?)").bind(JSON.stringify(rows.map(row=>[row.target_kind,row.target_id]))))
 }
 return statements
}
