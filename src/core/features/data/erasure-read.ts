import type { Row } from './archive'
import { NativeError } from '../auth/native-tokens'

type Table={name:string;columns:{name:string;pk:number}[];foreignKeys:{table:string;from:string;to:string;id:number}[]}
const quote=(name:string)=>'"'+name.replaceAll('"','""')+'"'
export const importCustody=(name:string)=>name.startsWith('ik_')||name.startsWith('feedback_import_')&&name!=='feedback_import_records'
const identity=(table:Table,row:Row)=>JSON.stringify((table.columns.some(c=>c.pk)?table.columns.filter(c=>c.pk):table.columns).map(c=>row[c.name]))
/** Read only the graph frontier and possible private copies. Each SQL query
 * returns bounded native rows; a large unrelated import never enters JS. */
export async function readErasureFrontier(db:D1Database,tables:Table[],data:Record<string,Row[]>,selected:Record<string,Row[]>,ids:Set<string>,literals:Set<string>,page?:{start:number;count:number;releaseVersionCount:number}):Promise<boolean>{
 const parents=[...Object.entries(selected).flatMap(([table,rows])=>rows.map(row=>({table,row}))),...data.release_versions.slice(0,page?.releaseVersionCount).map(row=>({table:'candidate_release_versions',row}))]
 const parentJson=JSON.stringify(parents),idJson=JSON.stringify([...ids]),literalJson=JSON.stringify([...literals].flatMap(value=>[value,JSON.stringify(value).slice(1,-1)]))
 if([parentJson,idJson,literalJson].some(value=>new TextEncoder().encode(value).length>512*1024))throw new NativeError('Selected erasure graph exceeds the bounded 512 KiB frontier. No records were removed.',413)
 const candidates=tables.filter(table=>!importCustody(table.name)),queries=(page?candidates.slice(page.start,page.start+page.count):candidates).map(table=>{
  const groups=new Map<number,Table['foreignKeys']>();for(const fk of table.foreignKeys)groups.set(fk.id,[...(groups.get(fk.id)??[]),fk])
  const parents="json_each((SELECT parents FROM frontier))"
  const references=[...groups.values()].map(group=>`EXISTS(SELECT 1 FROM ${parents} p WHERE json_extract(p.value,'$.table')='${group[0].table}' AND ${group.map(fk=>`n.${quote(fk.from)} IS NOT NULL AND n.${quote(fk.from)} IS json_extract(p.value,'$.row.${fk.to}')`).join(' AND ')})`)
  let cells="'{}'"
  for(let start=0;start<table.columns.length;start+=15)cells=`json_set(${cells},${table.columns.slice(start,start+15).map(column=>"'$."+column.name+"',n."+quote(column.name)).join(',')})`
  // Compare the original text cells directly. Serializing every unrelated row
  // into JSON just to parse its cells again makes large boards quadratic in bytes.
  const copied=(field:string)=>`EXISTS(SELECT 1 FROM json_each((SELECT ${field} FROM frontier)) atom WHERE ${table.columns.map(column=>`(typeof(n.${quote(column.name)})='text' AND instr(n.${quote(column.name)},atom.value)>0)`).join(' OR ')})`
  const extra:string[]=[]
  if(table.name==='operators')extra.push('1')
  if(table.name==='releases')extra.push(`n.id IN (SELECT json_extract(p.value,'$.row.release_id') FROM ${parents} p WHERE json_extract(p.value,'$.table')='candidate_release_versions')`)
  // Outcomes belong to a recipient snapshot or release target by composite
  // value, not by a foreign key or copied ID, so the frontier names both paths.
  if(table.name==='release_outcomes')extra.push(`EXISTS(SELECT 1 FROM ${parents} p WHERE json_extract(p.value,'$.table')='release_recipient_snapshots' AND n.release_version_id IS json_extract(p.value,'$.row.release_version_id') AND n.requester_id IS json_extract(p.value,'$.row.requester_id'))`,`EXISTS(SELECT 1 FROM ${parents} p,release_versions v WHERE json_extract(p.value,'$.table')='release_targets' AND v.id=n.release_version_id AND v.release_id IS json_extract(p.value,'$.row.release_id') AND n.roadmap_item_id IS json_extract(p.value,'$.row.roadmap_item_id'))`)
  if(table.name==='release_versions')extra.push(`n.release_id IN (SELECT json_extract(p.value,'$.row.release_id') FROM ${parents} p WHERE json_extract(p.value,'$.table')='release_targets')`)
  if(table.name==='decision_bet_snapshots')extra.push(`EXISTS(SELECT 1 FROM ${parents} p WHERE json_extract(p.value,'$.table')='decision_evidence_snapshots' AND n.decision_revision_id IS json_extract(p.value,'$.row.decision_revision_id') AND n.candidate_bet_id IS json_extract(p.value,'$.row.candidate_bet_id'))`)
  for(const [child,column] of table.name==='evidence_items'?[['request_evidence_links','evidence_id'],['request_evidence_contributions','evidence_id']]:table.name==='requesters'?[['requester_identity_merges','source_requester_id']]:[])extra.push(`n.id IN (SELECT json_extract(p.value,'$.row.${column}') FROM ${parents} p WHERE json_extract(p.value,'$.table')='${child}')`)
  if(table.name==='requests')extra.push(`n.id IN (SELECT request_id FROM request_evidence_links WHERE evidence_id IN (SELECT json_extract(p.value,'$.row.id') FROM ${parents} p WHERE json_extract(p.value,'$.table')='evidence_items' AND json_extract(p.value,'$.row.source_type')='portal_request'))`)
  return {table,sql:`SELECT '${table.name}' table_name,${cells} body FROM ${quote(table.name)} n WHERE ${[...references,copied('ids'),copied('literals'),...extra].join(' OR ')} LIMIT 2001`}
 })
 let changed=false
 // A shared three-binding CTE batches four bounded table scans per query,
 // preserving the paid D1 invocation budget across closure rounds.
 const groupSize=page?1:4
 for(let start=0;start<queries.length;start+=groupSize){const group=queries.slice(start,start+groupSize)
  const result=await db.prepare('WITH frontier AS (SELECT json(?) parents,json(?) ids,json(?) literals) '+group.map(item=>'SELECT * FROM ('+item.sql+')').join(' UNION ALL ')).bind(parentJson,idJson,literalJson).all<{table_name:string;body:string}>()
  for(const {table} of group){const rows=result.results.filter(row=>row.table_name===table.name).map(row=>JSON.parse(row.body) as Row);if(rows.length>2000)throw new NativeError('Selected erasure graph or private-copy candidates exceed 2000 rows in '+table.name+'. No records were removed.',413)
   const known=new Set(data[table.name].map(row=>identity(table,row)))
   for(const row of rows){const key=identity(table,row);if(!known.has(key)){data[table.name].push(row);known.add(key);changed=true}}
  }
  checkErasureRead(data)
 }
 return changed
}

export function checkErasureRead(data:Record<string,Row[]>):void {
 let rows=0,bytes=0
 for(const entries of Object.values(data)){rows+=entries.length;for(const row of entries)bytes+=new TextEncoder().encode(JSON.stringify(row)).byteLength}
 if(rows>20000||bytes>24*1024*1024)throw new NativeError('Erasure scope exceeds 20000 rows or 24 MiB; no records were removed.',413)
}
