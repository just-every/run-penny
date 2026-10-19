import type { Row, Table } from './archive'

/** Archives list rows by primary key, so a reply can precede the note it answers.
 * A row that names another row of its own table restores after that row, so
 * insert-time checks (a reply's thread trigger) see the parent. Other rows keep
 * their archive order. */
export function parentsFirst(table:Pick<Table,'name'|'foreignKeys'>,rows:Row[]):Row[]{
 const own=table.foreignKeys.filter(key=>key.table===table.name)
 if(!own.length)return rows
 const index=new Map(own.map(key=>[key.to,new Map(rows.map(row=>[row[key.to],row]))]))
 const placed=new Set<Row>(),visiting=new Set<Row>(),ordered:Row[]=[]
 const place=(row:Row)=>{
  if(placed.has(row)||visiting.has(row))return
  visiting.add(row)
  for(const key of own){
   const parent=row[key.from]===null?undefined:index.get(key.to)!.get(row[key.from])
   if(parent&&parent!==row)place(parent)
  }
  visiting.delete(row);placed.add(row);ordered.push(row)
 }
 for(const row of rows)place(row)
 return ordered
}
