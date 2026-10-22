import {learningRedactions} from '../learning/erasure-scope'
import {NativeError,digest} from '../auth/native-tokens'
import {canonical,schema,checkSchemaHeaders,schemaPart,type TableHeader,type Row,type Cell,type Table} from './archive'
import {readErasureFrontier,checkErasureRead,importCustody,type FrontierPage} from './erasure-read'
import {checkClauseErasureEdges,expandClauseErasure,erasureFiles} from './erasure-dependencies'
import {keptRequestWords,keptAuthor,keptRedaction,planRedactions,rowsKey} from './erasure-redaction'

function fail(code:string,status:400|409|413=409):never{throw new NativeError(code,status)}
const ident=(name:string)=>'"'+name+'"'
const rowKey=(table:ErasureTable,row:Row)=>canonical((table.columns.some(c=>c.pk>0)?table.columns.filter(c=>c.pk>0).sort((a,b)=>a.pk-b.pk):table.columns).map(c=>row[c.name]))
const foreignGroups=(keys:Table['foreignKeys'])=>{const groups=new Map<number,Table['foreignKeys']>();for(const key of keys)groups.set(key.id,[...(groups.get(key.id)??[]),key]);return groups}
export type ErasureTable=Pick<Table,'name'|'columns'|'foreignKeys'>
export type NativeScope={table:string;id:string;tables:ErasureTable[];data:Record<string,Row[]>;selected:Record<string,number[]>;kept:Record<string,number[]>;literals:string[];ids:string[];approvedPhrases:string[];prepared:boolean;schema?:{name:string}[];round?:{offset:number;changed:boolean;readIds:string[];releaseVersionCount:number;row?:{after:string;matches:number}}}
const selectedRows=(scope:NativeScope,from:'selected'|'kept'='selected'):Record<string,Row[]>=>Object.fromEntries(Object.entries(scope[from]).map(([table,indices])=>[table,indices.map(index=>scope.data[table][index])]))
const indices=(tables:ErasureTable[],data:Record<string,Row[]>,rows:Record<string,Row[]>)=>Object.fromEntries(tables.map(table=>[table.name,(rows[table.name]??[]).map(row=>data[table.name].indexOf(row))]))
function strings(value:Cell):string[]{
 if(typeof value!=='string')return []
 try{const parsed=JSON.parse(value) as unknown;const walk=(item:unknown):string[]=>typeof item==='string'?[item]:Array.isArray(item)?item.flatMap(walk):item!==null&&typeof item==='object'?Object.values(item).flatMap(walk):[];return [value,...walk(parsed)]}catch{return [value]}
}
export async function startNativeScope(db:D1Database,tableName:string,id:string,headers?:TableHeader[]):Promise<NativeScope>{
 if(headers)checkSchemaHeaders(headers)
 const tables=headers?[]:(await schema(db)).map(({name,columns,foreignKeys})=>({name,columns,foreignKeys})),data:Record<string,Row[]>=Object.fromEntries(tables.map(table=>[table.name,[]]))
 const root=await db.prepare(`SELECT * FROM ${ident(tableName)} WHERE id=?`).bind(id).first<Row>();if(!root)fail('entity_not_found',400)
 data[tableName]=[root]
 if(!headers)checkClauseErasureEdges(tables)
 const selected:Record<string,number[]>=Object.fromEntries(tables.map(table=>[table.name,[]]));selected[tableName]=[0]
 return {table:tableName,id,tables,data,selected,kept:{},literals:[],ids:[],approvedPhrases:[],prepared:false,...(headers?{schema:headers.map(({name})=>({name}))}:{})}
}

async function preparePhrases(db:D1Database,scope:NativeScope):Promise<void>{
 const identities=await db.batch<Row>([db.prepare('SELECT id,display_name FROM requesters LIMIT 50001'),db.prepare('SELECT id,email FROM requester_addresses LIMIT 50001'),db.prepare('SELECT id,name FROM accounts LIMIT 50001')])
 if(identities.some(result=>result.results.length>50000))fail('erasure_identity_scope_limit',413)
 const privateIdentityAtoms=identities.flatMap(result=>result.results.flatMap(row=>Object.values(row))).filter((value):value is string=>typeof value==='string'&&value.length>0)
 // Approved public wording is installation-wide, not frontier-local: a phrase
 // must be known before the first round turns a matching title into a literal.
 const published=await db.batch<Row>([db.prepare("SELECT public_title,public_description FROM requests WHERE moderation_state='approved' AND published_at IS NOT NULL LIMIT 50001"),db.prepare('SELECT title,problem,body FROM roadmap_update_versions WHERE published_at IS NOT NULL LIMIT 50001'),db.prepare('SELECT public_title,public_summary FROM roadmap_publications WHERE approved_at IS NOT NULL LIMIT 50001')])
 if(published.some(result=>result.results.length>50000))fail('erasure_identity_scope_limit',413)
 const approvedPhrases=new Set(published.flatMap(result=>result.results.flatMap(row=>Object.values(row))).filter((value):value is string=>typeof value==='string'&&value.length>0&&!privateIdentityAtoms.some(atom=>value.includes(atom))))
 scope.approvedPhrases=[...approvedPhrases];scope.prepared=true
}
/** Checkpoint bounded metadata and frontier pages without repeating a SQL scan.
 * Keep each closure round's inputs frozen until every table has been read. */
export async function stepNativeScope(db:D1Database,scope:NativeScope,incremental=false):Promise<boolean>{
 if(scope.schema){
  const tables=await schemaPart(db,scope.schema.slice(0,32));scope.schema=scope.schema.slice(32)
  for(const table of tables){scope.tables.push(table);scope.data[table.name]??=[];scope.selected[table.name]??=[]}
  if(!scope.schema.length){delete scope.schema;checkClauseErasureEdges(scope.tables)}
  return true
 }
 if(!scope.prepared){await preparePhrases(db,scope);return true}
 const {tables,data}=scope,selected=selectedRows(scope),kept=selectedRows(scope,'kept'),literals=new Set(scope.literals),ids=new Set(scope.ids),approvedPhrases=new Set(scope.approvedPhrases)
 const marked=(table:ErasureTable,row:Row)=>selected[table.name].some(other=>rowKey(table,other)===rowKey(table,row))
 let changed=scope.round?.changed??false
 if(!scope.round){
  if(expandClauseErasure(data,selected))changed=true
  for(const table of tables)for(const row of selected[table.name]){
   if(typeof row.id==='string')ids.add(row.id)
   // Removing a comparison copy does not turn its duplicated business dimensions
   // into new personal literals; root/evidence literals still fence personal copies.
   for(const [column,value]of Object.entries(row))if(!(table.name.startsWith('learning_')&&column==='reason')&&table.name!=='decision_bet_snapshots'&&!(table.name==='mail_event_records'&&column==='value_json')&&!(column==='title'&&['release_recipient_contexts','roadmap_update_contexts'].includes(table.name)&&typeof value==='string'&&approvedPhrases.has(value))&&['email','recipient','display_name','name','title','public_title','description','public_description','wording','body','proposed_solution','impact_statement','approved_author_name','source_label','named_speaker','review_reason','original_filename','rejection_reason','declined_reason','reason','rationale','question','summary','outcome_prompt','note','health','value_json'].includes(column)&&typeof value==='string'&&value.length>0)strings(value).forEach(text=>literals.add(text))
  }
  // A kept request's own words are this person's words wherever Penny repeats them.
  for(const row of kept.requests??[])keptRequestWords(row).forEach(text=>literals.add(text))
  const readIds=new Set([...ids,...await Promise.all([...ids,...selected.requester_addresses.map(row=>String(row.email))].map(digest))])
  scope.round={offset:0,changed,readIds:[...readIds],releaseVersionCount:data.release_versions.length}
 }
 const page:FrontierPage|undefined=incremental?{start:scope.round.offset,count:8,releaseVersionCount:scope.round.releaseVersionCount,row:scope.round.row}:undefined
 if(await readErasureFrontier(db,tables,data,selected,new Set(scope.round.readIds),literals,page))changed=true
 checkErasureRead(data)
 if(page){scope.round.offset=page.start;scope.round.row=page.row}
 scope.round.changed=changed
 scope.selected=Object.fromEntries(tables.map(table=>[table.name,selected[table.name].map(row=>data[table.name].indexOf(row))]))
 scope.literals=[...literals];scope.ids=[...ids]
 if(incremental&&scope.round.offset<tables.filter(table=>!importCustody(table.name)).length)return true
 delete scope.round
  const evidenceLinks=[...data.request_evidence_links,...(data.request_evidence_contributions??[])]
  // A request and the evidence it was submitted or imported as are one person's
  // words: erasing either erases both. Evidence anyone else gave, linked to the
  // request, is theirs and stays.
  const imported=(request:Row,evidence:Row)=>(data.feedback_import_records??[]).some(record=>{const keys=String(record.row_keys_json);return keys.includes(JSON.stringify(request.id))&&keys.includes(JSON.stringify(evidence.id))})
  const submitted=(request:Row|undefined,evidence:Row|undefined)=>!!request&&!!evidence&&(evidence.source_type==='portal_request'&&evidence.requester_id!==null&&evidence.requester_id===request.author_requester_id||imported(request,evidence))
  for(const link of evidenceLinks)if(selected.requests.some(row=>row.id===link.request_id)){
   const evidence=data.evidence_items.find(row=>row.id===link.evidence_id),definition=tables.find(table=>table.name==='evidence_items')!
   if(evidence&&submitted(data.requests.find(row=>row.id===link.request_id),evidence)&&!marked(definition,evidence)){selected.evidence_items.push(evidence);changed=true}
  }
  for(const link of evidenceLinks)if(selected.evidence_items.some(row=>row.id===link.evidence_id)){
   const request=data.requests.find(row=>row.id===link.request_id),definition=tables.find(table=>table.name==='requests')!
   if(request&&submitted(request,data.evidence_items.find(row=>row.id===link.evidence_id))&&!keptAuthor(request,selected)&&!marked(definition,request)){selected.requests.push(request);changed=true}
  }
  // Comparison snapshots inherit the evidence snapshot's erasure provenance.
  for(const snapshot of selected.decision_evidence_snapshots??[])for(const comparison of data.decision_bet_snapshots??[]){
   const definition=tables.find(table=>table.name==='decision_bet_snapshots')!
   if(comparison.decision_revision_id===snapshot.decision_revision_id&&comparison.candidate_bet_id===snapshot.candidate_bet_id&&!marked(definition,comparison)){selected.decision_bet_snapshots.push(comparison);changed=true}
  }
  const emails=new Set(selected.requester_addresses.map(row=>String(row.email)))
  const subjectHashes=new Set(await Promise.all([...ids,...emails].map(digest)))
  const redacted=learningRedactions(data,selected)
  for(const table of tables){
   if(['operators','operator_sessions','audit_entries','feedback_import_tombstones','host_identity_tombstones','ik_d1_erased_sources','ik_d1_erased_targets'].includes(table.name))continue
   const groups=foreignGroups(table.foreignKeys)
   for(const row of data[table.name]){
    if(marked(table,row))continue
    const references=(group:Table['foreignKeys'])=>selected[group[0].table]?.some(parent=>group.every(key=>row[key.from]!==null&&parent[key.to]===row[key.from]))
    // A request this person wrote stays for everyone who voted, commented or gave
    // evidence on it; only its author and their words go (erasure-redaction.ts).
    if(table.name==='requests'&&keptAuthor(row,selected)&&![...groups.values()].some(group=>group[0].from!=='author_requester_id'&&references(group))){
     if(!kept.requests?.includes(row)){(kept.requests??=[]).push(row);changed=true}
     continue
    }
    const referenced=[...groups.values()].some(references)
    const copied=Object.entries(row).filter(([column])=>!redacted(table.name,row,column)&&(table.name!=='learning_investigations'||!['native_evidence_ids_json','native_request_ids_json'].includes(column))).flatMap(([,value])=>strings(value)).some(text=>[...ids].some(id=>text.includes(id)))
    const address=(table.name==='evidence_items'&&emails.has(String(row.named_speaker)))||(table.name==='native_magic_links'&&emails.has(String(row.email)))||(table.name==='local_auth_outbox'&&emails.has(String(row.recipient)))
    const rate=table.name==='native_rate_limits'&&subjectHashes.has(String(row.subject_hash))
    if(referenced||copied||address||rate){selected[table.name].push(row);changed=true}
   }
  }
 scope.kept=indices(tables,data,kept)
 scope.selected=Object.fromEntries(tables.map(table=>[table.name,selected[table.name].map(row=>data[table.name].indexOf(row))]))
 scope.literals=[...literals];scope.ids=[...ids]
 return changed
}
export function finishNativeScope(scope:NativeScope){
 const {tables,data,table:tableName,id}=scope,selected=selectedRows(scope),kept=selectedRows(scope,'kept'),literals=new Set(scope.literals),ids=new Set(scope.ids),approvedPhrases=new Set(scope.approvedPhrases)
 const marked=(table:ErasureTable,row:Row)=>selected[table.name].some(other=>rowKey(table,other)===rowKey(table,row))

 if(data.operators.some(row=>[row.email,row.display_name].flatMap(strings).some(text=>[...literals].some(literal=>text===literal))))fail('erasure_crosses_operator_hold')
 // Audit details are other people's history too: only an exact ID or JSON value
 // marks a row for anonymizing. A literal inside longer text is ambiguous.
 const exact=(row:Row)=>strings(row.details_json).some(text=>ids.has(text)||literals.has(text))
 const audits=data.audit_entries.filter(row=>ids.has(String(row.entity_id))||ids.has(String(row.actor_id))||exact(row))
 // Approved public wording has independent publication custody. Repeating an
 // explicitly approved public request/problem phrase does not turn that wording
 // into a recipient record; private text, addresses and copied IDs still refuse.
 const publishedReleases=new Set(data.releases.filter(row=>row.state==='published').map(row=>row.id))
 const publishedVersions=new Set(data.release_versions.filter(row=>publishedReleases.has(row.release_id)&&row.snapshot_sealed_at!==null).map(row=>row.id))
 const independentPublicPhrase=(table:string,row:Row,column:string,literal:string)=>approvedPhrases.has(literal)&&(
  (table==='release_versions'&&publishedVersions.has(row.id)&&['title','body'].includes(column))||
  (table==='roadmap_update_versions'&&row.published_at!==null&&['title','problem','body'].includes(column)))
 const copies:{table:string;key:string;columns:string[]}[]=[],redacted=learningRedactions(data,selected)
 const keptRow=(table:ErasureTable,row:Row)=>(kept[table.name]??[]).includes(row)
 for(const table of tables){if(['audit_entries','operators','operator_sessions'].includes(table.name))continue;for(const row of data[table.name]){if(marked(table,row))continue;const columns=Object.entries(row).filter(([column,value])=>!redacted(table.name,row,column)&&!(keptRow(table,row)&&column in keptRedaction)&&!['id','created_at','updated_at','token_hash','token','slug','storage_key','subject_hash','key_hash','body_hash'].includes(column)&&strings(value).some(text=>[...literals].some(literal=>text.includes(literal)&&!independentPublicPhrase(table.name,row,column,literal)))).map(([column])=>column);if(columns.length)copies.push({table:table.name,key:rowKey(table,row),columns})}}
 const rows=new Map(tables.flatMap(table=>data[table.name].filter(row=>!marked(table,row)).map(row=>[rowsKey(table.name,rowKey(table,row)),row] as const)))
 const {blockedCopies,redactions}=planRedactions(copies,tables.flatMap(table=>(kept[table.name]??[]).map(row=>({table:table.name,key:rowKey(table,row)}))),rows,[...literals])
 for(const row of data.audit_entries)if(!audits.includes(row)&&strings(row.details_json).some(text=>[...ids,...literals].some(literal=>text.includes(literal))))blockedCopies.push({table:'audit_entries',key:rowKey(tables.find(table=>table.name==='audit_entries')!,row),columns:['details_json']})
 const files=erasureFiles(selected)
 const counts=Object.fromEntries(tables.map(table=>[table.name,selected[table.name].length]).filter(([,count])=>count!==0));counts.audit_anonymized=audits.length
 const plan={table:tableName,id,counts,files,blockedCopies,redactions,selected,audit:audits,tables,rows}
 return {plan,literals:[...literals,...ids]}
}
