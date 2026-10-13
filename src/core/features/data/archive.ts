import { z } from 'zod'
import { portabilityErasureStatements } from '../../../../scripts/portability/cleanup.mjs'
import { NativeError, digest } from '@/core/features/auth/native-tokens'
import { createUlid } from '@/core/shared/ulid'
import inventory from './schema-inventory.json'
import {hostErasureStatements} from '../auth/host-custody'
import {readErasureFrontier,checkErasureRead} from './erasure-read'
import {admitFlatImportErasure} from '../imports/erasure-admission'
import {importCopyHolds} from '../imports/erasure-scope'
import type {CopyScanOptions} from '../imports/copy-scan'
import { importErasureStatements } from '../imports/erasure'
import {retainErasureWork,resumeImportErasure} from '../imports/erasure-work'
import { validateFeedbackArchive } from '../imports/archive-custody'
import { feedbackRestoreCustody } from '../imports/archive-restore'
import {eraseArchivedSourceOptions,eraseExportedSourceOptions} from '../imports/archive-source-erasure'
import { checkClauseErasureEdges, clauseDeletionOrder, expandClauseErasure, erasureFiles } from './erasure-dependencies'
import { assertDataAuthority, dataBatch, type DataAuthority } from './authority'
export type Cell=string|number|null
export type Row=Record<string,Cell>
type ForeignKey={table:string;from:string;to:string;id:number;seq:number;on_delete:string}
type Table={name:string;sql:string;columns:{name:string;pk:number}[];foreignKeys:ForeignKey[]}
type State={origin:string;epoch:number;phase:string;lock_id:string|null}
export const ERASURE_LIMITS={rows:20000,recordBytes:24*1024*1024}
export const DATA_LIMITS={rows:2000,recordBytes:4*1024*1024,fileBytes:10*1024*1024,filesBytes:20*1024*1024,archiveBytes:32*1024*1024}
const cell=z.union([z.string(),z.number().finite(),z.null()])
const tombstone=z.object({epoch:z.number().int().positive(),table_name:z.string(),key_hash:z.string().regex(/^[a-f0-9]{64}$/)}).strict()
const journalShape=z.object({version:z.literal(1),origin:z.string().regex(/^[a-f0-9]{32}$/),epoch:z.number().int().nonnegative(),tombstones:z.array(tombstone).max(ERASURE_LIMITS.rows),sha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict()
const archiveShape=z.object({format:z.literal('penny-data'),version:z.literal(1),schemaHash:z.string(),origin:z.string(),epoch:z.number().int().nonnegative(),journalHash:z.string(),tables:z.record(z.string(),z.array(z.record(z.string(),cell))),files:z.array(z.object({key:z.string().min(1).max(1024),bytes:z.string(),sha256:z.string().regex(/^[a-f0-9]{64}$/),contentType:z.string(),size:z.number().int().nonnegative()}).strict()),sha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict()
export type Archive=z.infer<typeof archiveShape>
export type ErasureJournal=z.infer<typeof journalShape>
export function canonical(value:unknown):string {
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']'
 if(value!==null&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>JSON.stringify(key)+':'+canonical(item)).join(',')+'}'
 return JSON.stringify(value)
}
const hash=(value:unknown)=>digest(canonical(value))
function fail(code:string,status:400|409|413|503=409):never{throw new NativeError(code,status)}
function foreignGroups(keys:ForeignKey[]):Map<number,ForeignKey[]>{const groups=new Map<number,ForeignKey[]>();for(const key of keys)groups.set(key.id,[...(groups.get(key.id)??[]),key]);return groups}
const ident=(name:string)=>{if(!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name))fail('unsupported_schema');return '"'+name+'"'}
const keyColumns=(table:Table)=>table.columns.some(column=>column.pk>0)?table.columns.filter(column=>column.pk>0).sort((a,b)=>a.pk-b.pk):table.columns
const rowKey=(table:Table,row:Row)=>canonical(keyColumns(table).map(column=>row[column.name]))
const schemaHash=(tables:Table[])=>hash(tables.map(table=>({name:table.name,sql:table.sql})))
const state=(db:D1Database)=>db.prepare('SELECT origin,epoch,phase,lock_id FROM data_state WHERE singleton=1').first<State>()
export async function schema(db:D1Database):Promise<Table[]>{
 const result=await db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name!='d1_migrations' AND name NOT LIKE 'rer_portability_%' ORDER BY name").all<{name:string;sql:string}>()
 const namesJson=JSON.stringify(result.results.map(table=>table.name)),definitions=await db.batch([db.prepare('SELECT names.value native_table,p.* FROM json_each(?) names,pragma_table_info(names.value) p').bind(namesJson),db.prepare('SELECT names.value native_table,p.* FROM json_each(?) names,pragma_foreign_key_list(names.value) p').bind(namesJson)])
 const classified=inventory as Record<string,{classification:string;columns:string[]}>
 const names=new Set(result.results.map(table=>table.name))
 if(result.results.some(table=>!classified[table.name])||Object.entries(classified).some(([name,definition])=>definition.classification!=='installation'&&!names.has(name)))fail('unclassified_archive_schema',503)
 return result.results.map(table=>{
  const columns=(definitions[0].results as (Table['columns'][number]&{native_table:string})[]).filter(row=>row.native_table===table.name),expected=classified[table.name]
  if(canonical(columns.map(column=>column.name))!==canonical(expected.columns))fail('unclassified_archive_schema',503)
  return {...table,columns,foreignKeys:(definitions[1].results as (ForeignKey&{native_table:string})[]).filter(row=>row.native_table===table.name)}
 }).filter(table=>classified[table.name].classification==='product')
}
async function rows(db:D1Database,tables:Table[]):Promise<Record<string,Row[]>>{
 // Fetch one overflow row, never an unbounded table. The archive is refused
 // before it can claim a silently truncated result.
 const data:Record<string,Row[]>={};let count=0
 for(const table of tables){
  const result=await db.prepare(`SELECT * FROM ${ident(table.name)} LIMIT ?`).bind(DATA_LIMITS.rows-count+1).all<Row>()
  data[table.name]=result.results.sort((a,b)=>rowKey(table,a).localeCompare(rowKey(table,b)))
  count+=result.results.length;limits(data)
 }
 return data
}
function limits(data:Record<string,Row[]>):void{
 if(Object.values(data).reduce((n,items)=>n+items.length,0)>DATA_LIMITS.rows||new TextEncoder().encode(canonical(data)).byteLength>DATA_LIMITS.recordBytes)fail('archive_limit',413)
}
export const normalize=(name:string,row:Row):Row=>{
 if(name==='operator_sessions'||name==='native_requester_sessions')return {...row,token_hash:`disabled-${row.id}`,revoked_at:row.revoked_at??'1970-01-01T00:00:00.000Z'}
 if(name==='native_magic_links')return {...row,token_hash:`disabled-${row.id}`,consumed_at:row.consumed_at??'1970-01-01T00:00:00.000Z'}
 if(name==='notification_outbox'&&row.delivery_state==='queued')return {...row,delivery_state:'unknown',failure_reason:'restored_delivery_review_required'}
 if(name==='decision_review_notifications'&&['queued','sending','unknown'].includes(String(row.state)))return {...row,state:'held',claim_id:null,failure_reason:'restored_delivery_review_required'}
 if(name==='notification_batches'&&row.state==='queued')return {...row,failure_reason:'restored_delivery_review_required'}
 if(name==='integration_deliveries'&&['queued','sending'].includes(String(row.state)))return {...row,state:'uncertain',claim:null,claim_until:null}
 if(name==='penny_integration_events')return {...row,held:1}
 if(name==='penny_tracker_commands')return {...row,held:1}
 if(name==='notification_intents')return {...row,restoration_hold_at:row.restoration_hold_at??'1970-01-01T00:00:00.000Z'}
 if(name==='requester_pending_actions')return {...row,pending_token_hash:`disabled-${row.id}`,claimed_at:row.claimed_at??'1970-01-01T00:00:00.000Z'}
 if(name==='requester_pending_action_bindings')return {...row,pending_token_hash:String(row.pending_token_hash).startsWith('disabled-')?row.pending_token_hash:`disabled-${row.pending_token_hash}`,expires_at:'1970-01-01T00:00:00.000Z'}
 if(name==='local_auth_outbox')return {...row,token:`disabled-${row.id}`,expires_at:'1970-01-01T00:00:00.000Z'}
 return row
}
export async function readErasureJournal(db:D1Database):Promise<ErasureJournal>{
 const result=await db.batch([db.prepare('SELECT origin,epoch,phase,lock_id FROM data_state WHERE singleton=1'),db.prepare('SELECT epoch,table_name,key_hash FROM data_tombstones ORDER BY table_name,key_hash LIMIT ?').bind(ERASURE_LIMITS.rows+1)]);const current=result[0].results[0] as State,tombstones=result[1].results as z.infer<typeof tombstone>[]
 if(tombstones.length>ERASURE_LIMITS.rows||new TextEncoder().encode(canonical(tombstones)).byteLength>ERASURE_LIMITS.recordBytes)fail('erasure_journal_limit',413)
 const body={version:1 as const,origin:current.origin,epoch:current.epoch,tombstones};return {...body,sha256:await hash(body)}
}
async function reserve(db:D1Database,kind:'export'|'restore'|'erase',payload:unknown,authority?:DataAuthority):Promise<string>{
 const id=createUlid(),now=new Date().toISOString()
 let result:D1Result[]
 try {result=await dataBatch(db,[db.prepare("UPDATE data_state SET phase='locked',lock_id=? WHERE singleton=1 AND phase='idle' RETURNING 1").bind(id),db.prepare("INSERT INTO data_operations(id,kind,status,payload_json,created_at,updated_at) SELECT ?,?,'pending',?,?,? WHERE EXISTS(SELECT 1 FROM data_state WHERE lock_id=?)").bind(id,kind,canonical(payload),now,now,id)],authority)}catch(error){if(String(error).includes('attachment_writer_active'))fail('attachment_writer_active');if(String(error).includes('notification_writer_active'))fail('notification_writer_active');throw error}
 if(result[0].results.length!==1)fail('data_busy');return id
}
async function finish(db:D1Database,id:string,status:'complete'|'aborted',authority?:DataAuthority):Promise<void>{
 await dataBatch(db,[db.prepare("UPDATE data_operations SET status=?,payload_json='{}',updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM data_state WHERE lock_id=?)").bind(status,new Date().toISOString(),id,id),db.prepare("UPDATE data_state SET phase='idle',lock_id=NULL WHERE singleton=1 AND lock_id=?").bind(id)],authority)
}
const applyStart=(db:D1Database,id:string)=>[db.prepare("INSERT INTO data_apply_claims(operation_id) VALUES((SELECT lock_id FROM data_state WHERE singleton=1 AND lock_id=? AND phase='locked'))").bind(id),db.prepare("UPDATE data_state SET phase='applying' WHERE singleton=1 AND lock_id=?").bind(id),db.prepare('PRAGMA defer_foreign_keys=ON')]
const audit=(db:D1Database,action:string,id:string)=>{const now=new Date().toISOString();return db.prepare("INSERT INTO audit_entries(id,actor_type,action,entity_type,entity_id,occurred_at,created_at,updated_at) VALUES(?,'system',?,'data_operation',?,?,?,?)").bind(createUlid(),action,id,now,now,now)}
export async function exportArchive(db:D1Database,bucket:R2Bucket,authority?:DataAuthority):Promise<{archive:Archive;journal:ErasureJournal}>{
 const id=await reserve(db,'export',{},authority)
 try {
  const tables=await schema(db);let data=await rows(db,tables);limits(data);validateNativeIdentity(data);validateFeedbackArchive(data)
  if(await eraseExportedSourceOptions(db,id,data,authority)){data=await rows(db,tables);limits(data);validateNativeIdentity(data);validateFeedbackArchive(data)}
  if(data.request_attachment_uploads?.length||data.evidence_attachment_uploads?.length)fail('unfinished_attachment_uploads')
  const journal=await readErasureJournal(db)
  const expectedKeys=new Set(data.attachments.map(row=>String(row.storage_key)));let cursor:string|undefined
  do{const listing=await bucket.list({limit:1000,...(cursor?{cursor}:{})});if(listing.objects.some(object=>!expectedKeys.has(object.key)))fail('untracked_attachment_objects',503);cursor=listing.truncated?listing.cursor:undefined}while(cursor)
  const files:Archive['files']=[];let total=0
  for(const attachment of data.attachments){
   const object=await bucket.get(String(attachment.storage_key));if(!object)fail('missing_attachment',503)
   if(object.size!==attachment.byte_size||object.size>DATA_LIMITS.fileBytes)fail('attachment_size',413)
   total+=object.size;if(total>DATA_LIMITS.filesBytes)fail('archive_limit',413)
   const bytes=new Uint8Array(await object.arrayBuffer());let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte)
   files.push({key:String(attachment.storage_key),bytes:btoa(binary),sha256:await bytesHash(bytes),contentType:String(attachment.content_type),size:bytes.byteLength})
  }
  const body={format:'penny-data' as const,version:1 as const,schemaHash:await schemaHash(tables),origin:journal.origin,epoch:journal.epoch,journalHash:journal.sha256,tables:Object.fromEntries(tables.map(table=>[table.name,data[table.name].map(row=>normalize(table.name,row))])),files}
  const archive={...body,sha256:await hash(body)};if(new TextEncoder().encode(canonical(archive)).byteLength>DATA_LIMITS.archiveBytes)fail('archive_limit',413)
  await finish(db,id,'complete',authority);return {archive,journal}
 }catch(error){await finish(db,id,'aborted');throw error}
}
async function bytesHash(bytes:Uint8Array):Promise<string>{return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>))].map(value=>value.toString(16).padStart(2,'0')).join('')}
const bootstrapTables=new Set(['operators','operator_sessions','native_magic_links','local_auth_outbox','native_rate_limits'])
async function validated(db:D1Database,value:unknown,journalValue:unknown):Promise<{archive:Archive;journal:ErasureJournal;tables:Table[];bytes:Uint8Array[]}>{
 const parsed=archiveShape.safeParse(value),parsedJournal=journalShape.safeParse(journalValue)
 if(!parsed.success||!parsedJournal.success)fail('invalid_archive',400)
 const archive=parsed.data,journal=parsedJournal.data
 const {sha256:archiveHash,...body}=archive,{sha256:journalHash,...journalBody}=journal
 if(await hash(body)!==archiveHash||await hash(journalBody)!==journalHash)fail('archive_corrupt',400)
 const journalKeys=journal.tombstones.map(item=>item.table_name+':'+item.key_hash)
 if(new Set(journalKeys).size!==journalKeys.length||Math.max(0,...journal.tombstones.map(item=>item.epoch))!==journal.epoch)fail('invalid_erasure_journal',400)
 if(archive.origin!==journal.origin||archive.epoch!==journal.epoch||archive.journalHash!==journal.sha256)fail('stale_archive')
 const current=(await state(db))!,known=await readErasureJournal(db)
 if(known.tombstones.length&&(known.origin!==journal.origin||known.tombstones.some(item=>!journal.tombstones.some(other=>canonical(item)===canonical(other)))))fail('erasure_journal_regression')
 if(current.origin===journal.origin&&current.epoch>journal.epoch)fail('stale_archive')
 const tables=await schema(db)
 if(await schemaHash(tables)!==archive.schemaHash||canonical(Object.keys(archive.tables).sort())!==canonical(tables.map(table=>table.name).sort()))fail('unsupported_archive_schema')
 limits(archive.tables);validateNativeIdentity(archive.tables);validateFeedbackArchive(archive.tables)
 if(archive.tables.request_attachment_uploads.length||archive.tables.evidence_attachment_uploads.length)fail('unfinished_attachment_uploads')
 for(const table of tables){
  const keys=new Set<string>()
  for(const row of archive.tables[table.name]){
   if(canonical(Object.keys(row).sort())!==canonical(table.columns.map(column=>column.name).sort()))fail('invalid_archive_columns',400)
   const key=rowKey(table,row);if(keys.has(key))fail('duplicate_archive_key',400);keys.add(key)
  }
 }
 // Tombstones compare opaque primary-key hashes, never original private wording.
 for(const item of journal.tombstones){const table=tables.find(table=>table.name===item.table_name);if(!table)fail('unsupported_journal_schema');for(const row of archive.tables[table.name])if(await hash([journal.origin,table.name,rowKey(table,row)])===item.key_hash)fail('erased_archive_record')}
 const files=new Map(archive.files.map(file=>[file.key,file]));if(files.size!==archive.files.length||files.size!==archive.tables.attachments.length)fail('invalid_archive_files',400)
 let total=0;const bytes:Uint8Array[]=[]
 for(const file of archive.files){
  const attachment=archive.tables.attachments.find(row=>row.storage_key===file.key)
  if(!attachment||attachment.byte_size!==file.size||attachment.content_type!==file.contentType||file.size>DATA_LIMITS.fileBytes)fail('invalid_archive_files',400)
  if(file.bytes.length!==Math.ceil(file.size/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(file.bytes))fail('archive_corrupt',400)
  let buffer:Uint8Array;try{buffer=Uint8Array.from(atob(file.bytes),character=>character.charCodeAt(0))}catch{fail('archive_corrupt',400)}
  if(buffer!.byteLength!==file.size||await bytesHash(buffer!)!==file.sha256)fail('archive_corrupt',400)
  total+=buffer!.byteLength;if(total>DATA_LIMITS.filesBytes)fail('archive_limit',413);bytes.push(buffer!)
 }
 return {archive,journal,tables,bytes}
}
function validateReferences(tables:Table[],data:Record<string,Row[]>):void{
 for(const table of tables)for(const row of data[table.name]){
  if(table.columns.some(column=>column.pk>0&&row[column.name]===null))fail('invalid_archive_key',400)
  const groups=foreignGroups(table.foreignKeys)
  for(const group of groups.values()){
   if(group.some(key=>row[key.from]===null))continue
   if(!data[group[0].table]?.some(parent=>group.every(key=>parent[key.to]===row[key.from])))fail('invalid_archive_reference',400)
  }
 }
}
type Operation={id:string;kind:'export'|'restore'|'erase';status:string;payload_json:string}
export async function dataOperation(db:D1Database,id:string):Promise<Operation|null>{return db.prepare('SELECT id,kind,status,payload_json FROM data_operations WHERE id=?').bind(id).first<Operation>()}
export async function restoreArchive(db:D1Database,bucket:R2Bucket,value:unknown,journalValue:unknown,resumeId?:string,authority?:DataAuthority):Promise<{operationId:string;status:string}>{
 const existing=resumeId?await dataOperation(db,resumeId):null
 if(resumeId&&(!existing||existing.kind!=='restore'))fail('invalid_data_operation',400)
 if(existing?.status==='complete')return {operationId:existing.id,status:'complete'}
 if(existing?.status==='aborted')fail('data_operation_aborted')
 const input=await validated(db,value,journalValue),{archive,journal,tables,bytes}=input
 validateReferences(tables,archive.tables)
 const payload={archiveHash:archive.sha256,journalHash:journal.sha256,keys:archive.files.map(file=>file.key)}
 const saved=existing?JSON.parse(existing.payload_json) as typeof payload&{r2Owned?:boolean}:null
 if(saved){const {r2Owned:ignored,...identity}=saved;void ignored;if(canonical(identity)!==canonical(payload)||(await state(db))?.lock_id!==existing!.id)fail('data_operation_mismatch')}
 const id=existing?.id??await reserve(db,'restore',payload,authority)
 await claimRunner(db,id,'pending','running',authority)
 let ownsR2=saved?.r2Owned===true
 try{
  const occupied=await db.batch(tables.map(table=>db.prepare(`SELECT 1 AS occupied FROM ${ident(table.name)} LIMIT 1`)))
  if(tables.some((table,index)=>!bootstrapTables.has(table.name)&&occupied[index].results.length))fail('restore_requires_empty_target')
  if(!ownsR2){
   if((await bucket.list({limit:1})).objects.length)fail('restore_requires_empty_bucket')
   const [ownership]=await dataBatch(db,[db.prepare("UPDATE data_operations SET payload_json=?,updated_at=? WHERE id=? AND status='running' AND EXISTS(SELECT 1 FROM data_state WHERE lock_id=?) RETURNING 1").bind(canonical({...payload,r2Owned:true}),new Date().toISOString(),id,id)],authority)
   if(ownership.results.length!==1)fail('data_operation_changed')
   ownsR2=true
  }
  for(let index=0;index<archive.files.length;index++){const file=archive.files[index];await assertDataAuthority(db,authority);await bucket.put(file.key,bytes[index],{httpMetadata:{contentType:file.contentType}})}
  eraseArchivedSourceOptions(archive.tables)
  const importCustody=await feedbackRestoreCustody(db,archive.tables)
  const statements=[...applyStart(db,id),...importCustody.before,...tables.map(table=>db.prepare(`DELETE FROM ${ident(table.name)}`))]
  for(const table of tables)for(const original of archive.tables[table.name]){
   const row=normalize(table.name,original),columns=table.columns.map(column=>column.name)
   statements.push(db.prepare(`INSERT INTO ${ident(table.name)}(${columns.map(ident).join(',')}) VALUES(${columns.map(()=>'?').join(',')})`).bind(...columns.map(column=>row[column])))
  }
  statements.push(...importCustody.after)
  // Never delete a destination erasure journal. Validation requires a superset.
  for(const item of journal.tombstones)statements.push(db.prepare('INSERT OR IGNORE INTO data_tombstones(epoch,table_name,key_hash) VALUES(?,?,?)').bind(item.epoch,item.table_name,item.key_hash))
  statements.push(db.prepare('UPDATE data_state SET origin=?,epoch=? WHERE singleton=1 AND lock_id=?').bind(journal.origin,journal.epoch,id),audit(db,'data.restored',id),db.prepare("UPDATE data_operations SET status='complete',payload_json='{}',updated_at=? WHERE id=?").bind(new Date().toISOString(),id),db.prepare("UPDATE data_state SET phase='idle',lock_id=NULL WHERE singleton=1 AND lock_id=?").bind(id))
  await dataBatch(db,statements,authority)
  return {operationId:id,status:'complete'}
 }catch(error){
  // A response fault after commit must not delete successfully restored files.
  const operation=await dataOperation(db,id)
  if(operation?.status==='complete')return {operationId:id,status:'complete'}
  // Compensation may release this runner's lock and staged originals after
  // authority is lost, but never applies the archive or authorizes new work.
  try{if(ownsR2)await bucket.delete(payload.keys);await finish(db,id,'aborted')}catch{await releaseRunner(db,id,'running','pending');if(error instanceof NativeError&&error.status===401)throw error;return {operationId:id,status:'pending'}}
  throw error
 }
}
export async function abortRestore(db:D1Database,bucket:R2Bucket,id:string,authority?:DataAuthority):Promise<void>{
 const operation=await dataOperation(db,id)
 if(!operation||operation.kind!=='restore'||operation.status!=='pending'||(await state(db))?.lock_id!==id)fail('invalid_data_operation')
 await claimRunner(db,id,'pending','running',authority)
 try{const payload=JSON.parse(operation.payload_json) as {keys:string[];r2Owned?:boolean};if(payload.r2Owned===true){await assertDataAuthority(db,authority);await bucket.delete(payload.keys)}await finish(db,id,'aborted',authority)}catch(error){await releaseRunner(db,id,'running','pending');throw error}
}
const roots=new Set(['requesters','requests','evidence_items','accounts'])
type ErasurePlan={table:string;id:string;planHash:string;counts:Record<string,number>;files:string[];blockedCopies:{table:string;key:string;columns:string[]}[];selected:Record<string,Row[]>;audit:Row[];tables:Table[]}
function strings(value:Cell):string[]{
 if(typeof value!=='string')return []
 try{const parsed=JSON.parse(value) as unknown;const walk=(item:unknown):string[]=>typeof item==='string'?[item]:Array.isArray(item)?item.flatMap(walk):item!==null&&typeof item==='object'?Object.values(item).flatMap(walk):[];return [value,...walk(parsed)]}catch{return [value]}
}
export async function planErasure(db:D1Database,tableName:string,id:string,copyScan?:CopyScanOptions):Promise<ErasurePlan>{
 if(!roots.has(tableName))fail('unsupported_erasure_entity',400)
 const tables=await schema(db),data:Record<string,Row[]>=Object.fromEntries(tables.map(table=>[table.name,[]]))
 const found=await db.prepare(`SELECT * FROM ${ident(tableName)} WHERE id=?`).bind(id).first<Row>();if(found)data[tableName].push(found)
 checkClauseErasureEdges(tables)
 const root=data[tableName].find(row=>row.id===id);if(!root)fail('entity_not_found',400)
 const identities=await db.batch<Row>([db.prepare('SELECT id,display_name FROM requesters LIMIT 50001'),db.prepare('SELECT id,email FROM requester_addresses LIMIT 50001'),db.prepare('SELECT id,name FROM accounts LIMIT 50001')])
 if(identities.some(result=>result.results.length>50000))fail('erasure_identity_scope_limit',413)
 const privateIdentityAtoms=identities.flatMap(result=>result.results.flatMap(row=>Object.values(row))).filter((value):value is string=>typeof value==='string'&&value.length>0)
 // Approved public wording is installation-wide, not frontier-local: a phrase
 // must be known before the first round turns a matching title into a literal.
 const published=await db.batch<Row>([db.prepare("SELECT public_title,public_description FROM requests WHERE moderation_state='approved' AND published_at IS NOT NULL LIMIT 50001"),db.prepare('SELECT title,problem,body FROM roadmap_update_versions WHERE published_at IS NOT NULL LIMIT 50001'),db.prepare('SELECT public_title,public_summary FROM roadmap_publications WHERE approved_at IS NOT NULL LIMIT 50001')])
 if(published.some(result=>result.results.length>50000))fail('erasure_identity_scope_limit',413)
 const approvedPhrases=new Set(published.flatMap(result=>result.results.flatMap(row=>Object.values(row))).filter((value):value is string=>typeof value==='string'&&value.length>0&&!privateIdentityAtoms.some(atom=>value.includes(atom))))
 const selected:Record<string,Row[]>=Object.fromEntries(tables.map(table=>[table.name,[]]));selected[tableName].push(root)
 const marked=(table:Table,row:Row)=>selected[table.name].some(other=>rowKey(table,other)===rowKey(table,row))
 const literals=new Set<string>(),ids=new Set<string>()
 let changed=true
 while(changed){changed=false
  if(expandClauseErasure(data,selected))changed=true
  for(const table of tables)for(const row of selected[table.name]){
   if(typeof row.id==='string')ids.add(row.id)
   // Removing a comparison copy does not turn its duplicated business dimensions
   // into new personal literals; root/evidence literals still fence personal copies.
   for(const [column,value]of Object.entries(row))if(table.name!=='decision_bet_snapshots'&&!(table.name==='mail_event_records'&&column==='value_json')&&!(column==='title'&&['release_recipient_contexts','roadmap_update_contexts'].includes(table.name)&&typeof value==='string'&&approvedPhrases.has(value))&&['email','recipient','display_name','name','title','public_title','description','public_description','wording','body','proposed_solution','impact_statement','approved_author_name','source_label','named_speaker','review_reason','original_filename','rejection_reason','declined_reason','reason','rationale','question','summary','outcome_prompt','note','health','value_json'].includes(column)&&typeof value==='string'&&value.length>0)strings(value).forEach(text=>literals.add(text))
  }
  const readIds=new Set([...ids,...await Promise.all([...ids,...selected.requester_addresses.map(row=>String(row.email))].map(digest))])
  if(await readErasureFrontier(db,tables,data,selected,readIds,literals))changed=true
  checkErasureRead(data)
  const evidenceLinks=[...data.request_evidence_links,...(data.request_evidence_contributions??[])]
  // Erasing a request also erases its original evidence, including shared copies.
  for(const link of evidenceLinks)if(selected.requests.some(row=>row.id===link.request_id)){
   const evidence=data.evidence_items.find(row=>row.id===link.evidence_id)!,definition=tables.find(table=>table.name==='evidence_items')!
   if(evidence&&!marked(definition,evidence)){selected.evidence_items.push(evidence);changed=true}
  }
  for(const link of evidenceLinks)if(selected.evidence_items.some(row=>row.id===link.evidence_id&&row.source_type==='portal_request')){
   const request=data.requests.find(row=>row.id===link.request_id)!,definition=tables.find(table=>table.name==='requests')!
   if(request&&!marked(definition,request)){selected.requests.push(request);changed=true}
  }
  // Comparison snapshots inherit the evidence snapshot's erasure provenance.
  for(const snapshot of selected.decision_evidence_snapshots??[])for(const comparison of data.decision_bet_snapshots??[]){
   const definition=tables.find(table=>table.name==='decision_bet_snapshots')!
   if(comparison.decision_revision_id===snapshot.decision_revision_id&&comparison.candidate_bet_id===snapshot.candidate_bet_id&&!marked(definition,comparison)){selected.decision_bet_snapshots.push(comparison);changed=true}
  }
  const emails=new Set(selected.requester_addresses.map(row=>String(row.email)))
  const subjectHashes=new Set(await Promise.all([...ids,...emails].map(digest)))
  for(const table of tables){
   if(['operators','operator_sessions','audit_entries','feedback_import_tombstones','host_identity_tombstones','ik_d1_erased_sources','ik_d1_erased_targets'].includes(table.name))continue
   const groups=foreignGroups(table.foreignKeys)
   for(const row of data[table.name]){
    if(marked(table,row))continue
    const referenced=[...groups.values()].some(group=>selected[group[0].table]?.some(parent=>group.every(key=>row[key.from]!==null&&parent[key.to]===row[key.from])))
    const copied=Object.values(row).flatMap(strings).some(text=>[...ids].some(id=>text.includes(id)))
    const address=(table.name==='native_magic_links'&&emails.has(String(row.email)))||(table.name==='local_auth_outbox'&&emails.has(String(row.recipient)))
    const rate=table.name==='native_rate_limits'&&subjectHashes.has(String(row.subject_hash))
    if(referenced||copied||address||rate){selected[table.name].push(row);changed=true}
   }
  }
 }
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
 const blockedCopies:{table:string;key:string;columns:string[]}[]=[]
 for(const table of tables){if(['audit_entries','operators','operator_sessions'].includes(table.name))continue;for(const row of data[table.name]){if(marked(table,row))continue;const columns=Object.entries(row).filter(([column,value])=>!['id','created_at','updated_at','token_hash','token','slug','storage_key','subject_hash','key_hash','body_hash'].includes(column)&&strings(value).some(text=>[...literals].some(literal=>text.includes(literal)&&!independentPublicPhrase(table.name,row,column,literal)))).map(([column])=>column);if(columns.length)blockedCopies.push({table:table.name,key:rowKey(table,row),columns})}}
 for(const row of data.audit_entries)if(!audits.includes(row)&&strings(row.details_json).some(text=>[...ids,...literals].some(literal=>text.includes(literal))))blockedCopies.push({table:'audit_entries',key:rowKey(tables.find(table=>table.name==='audit_entries')!,row),columns:['details_json']})
 const current=(await state(db))!
 const scope=copyScan?await hash({current,table:tableName,id,selected,audits,blockedCopies}):undefined
 blockedCopies.push(...await importCopyHolds(db,selected.feedback_import_records,new Set([...literals,...ids]),copyScan?{...copyScan,scope}:undefined))
 const files=erasureFiles(selected)
 const counts=Object.fromEntries(tables.map(table=>[table.name,selected[table.name].length]).filter(([,count])=>count!==0));counts.audit_anonymized=audits.length
 const planHash=await hash({origin:current.origin,epoch:current.epoch,table:tableName,id,selected,audits,files,blockedCopies})
 return {table:tableName,id,planHash,counts,files,blockedCopies,selected,audit:audits,tables}
}
export async function resumeErasure(db:D1Database,bucket:R2Bucket,id:string,authority?:DataAuthority):Promise<{operationId:string;status:string}>{
 let operation=await dataOperation(db,id)
 if(!operation||operation.kind!=='erase')fail('invalid_data_operation',400)
 if(operation.status==='complete')return {operationId:id,status:'complete'}
 if(operation.status==='pending_import'){
  await claimRunner(db,id,'pending_import','running_import',authority)
  try{const done=await resumeImportErasure(db,id,authority);await releaseRunner(db,id,'running_import',done?'pending_r2':'pending_import',authority);if(!done)return {operationId:id,status:'pending_import'}}catch(error){await releaseRunner(db,id,'running_import','pending_import');throw error}
  operation=(await dataOperation(db,id))!
 }
 if(operation.status!=='pending_r2'||(await state(db))?.lock_id!==id)fail('invalid_data_operation')
 const payload=JSON.parse(operation.payload_json) as {keys:string[]}
 await claimRunner(db,id,'pending_r2','running_r2',authority)
 try{
  await assertDataAuthority(db,authority);await bucket.delete(payload.keys)
  await finish(db,id,'complete',authority);return {operationId:id,status:'complete'}
 }catch(error){
  await releaseRunner(db,id,'running_r2','pending_r2')
  if(error instanceof NativeError&&error.status===401)throw error
  return {operationId:id,status:'pending_r2'}
 }
}
export async function eraseEntity(db:D1Database,bucket:R2Bucket,tableName:string,entityId:string,planHash:string,authority?:DataAuthority):Promise<{operationId:string;status:string}>{
 const reviewed=await planErasure(db,tableName,entityId)
 if(reviewed.planHash!==planHash)fail('erasure_plan_changed')
 if(reviewed.blockedCopies.length)fail('erasure_ambiguous_copies')
 await assertDataAuthority(db,authority)
 const importAdmission=await admitFlatImportErasure(db,reviewed.selected.feedback_import_records,authority)
 const id=await reserve(db,'erase',{},authority)
 try{
  const plan=await planErasure(db,tableName,entityId)
  if(plan.planHash!==planHash)fail('erasure_plan_changed')
  if(plan.blockedCopies.length)fail('erasure_ambiguous_copies')
  const current=(await state(db))!,epoch=current.epoch+1,journal=await readErasureJournal(db)
  if(journal.tombstones.length+Object.values(plan.selected).reduce((n,rows)=>n+rows.length,0)>ERASURE_LIMITS.rows)fail('journal_limit',413)
  const statements=[...applyStart(db,id),...importAdmission.map(query=>db.prepare(query.sql).bind(...query.params??[])),db.prepare('DELETE FROM ik_d1_assertions'),...await portabilityErasureStatements(db)]
  statements.push(...retainErasureWork(db,id,plan.selected.feedback_import_records),...importErasureStatements(db,plan.selected),...await hostErasureStatements(db,plan.selected))
  // Development mail contains credentials, is never portable, and loses captures
  // for each erased identity in the same transaction as the product graph.
  const hasLocalOutbox = await db.prepare("SELECT 1 present FROM sqlite_master WHERE type='table' AND name='rer_mail_development_outbox'").first()
  for (const address of hasLocalOutbox ? plan.selected.requester_addresses ?? [] : []) statements.push(db.prepare(`DELETE FROM rer_mail_development_outbox WHERE EXISTS (SELECT 1 FROM json_each(json_extract(message,'$.to')) WHERE value=?) OR EXISTS (SELECT 1 FROM json_each(json_extract(message,'$.cc')) WHERE value=?) OR EXISTS (SELECT 1 FROM json_each(json_extract(message,'$.bcc')) WHERE value=?)`).bind(address.email,address.email,address.email))
  // These Base witnesses can only disappear after their owning job. Other
  // foreign keys remain deferred within the complete erasure transaction.
  const deletionOrder=clauseDeletionOrder(plan.tables)
  // Fence the complete closure before any DELETE can cascade. Every selected
  // child receives its own tombstone even when the database removes it first.
  for(const table of deletionOrder)for(let start=0;start<plan.selected[table.name].length;start+=250){
   const hashes=await Promise.all(plan.selected[table.name].slice(start,start+250).map(row=>hash([current.origin,table.name,rowKey(table,row)])))
   statements.push(db.prepare('INSERT OR IGNORE INTO data_tombstones(epoch,table_name,key_hash) SELECT ?,?,value FROM json_each(?)').bind(epoch,table.name,JSON.stringify(hashes)))
  }
  for(const table of deletionOrder)for(let start=0;start<plan.selected[table.name].length;start+=250){
   const columns=keyColumns(table),keys=plan.selected[table.name].slice(start,start+250).map(row=>columns.map(column=>row[column.name]))
   statements.push(db.prepare(`DELETE FROM ${ident(table.name)} WHERE EXISTS(SELECT 1 FROM json_each(?) selected WHERE ${columns.map((column,index)=>`${ident(table.name)}.${ident(column.name)} IS json_extract(selected.value,'$[${index}]')`).join(' AND ')})`).bind(JSON.stringify(keys)))
  }
  const anonymousReference=`erased:${crypto.randomUUID()}`
  for(const row of plan.audit)statements.push(db.prepare("UPDATE audit_entries SET entity_id=?,actor_id=NULL,details_json=NULL,updated_at=? WHERE id=?").bind(anonymousReference,new Date().toISOString(),row.id))
  statements.push(audit(db,'data.erased',id),db.prepare('UPDATE data_state SET epoch=?,phase=\'locked\' WHERE singleton=1 AND lock_id=?').bind(epoch,id),db.prepare("UPDATE data_operations SET status=?,payload_json=?,updated_at=? WHERE id=?").bind(plan.selected.feedback_import_records.length?'pending_import':'pending_r2',canonical({keys:plan.files}),new Date().toISOString(),id))
  await dataBatch(db,statements,authority)
 }catch(error){const operation=await dataOperation(db,id);if(['pending_r2','pending_import'].includes(operation?.status??''))return resumeErasure(db,bucket,id,authority);await finish(db,id,'aborted');throw error}
 const pending=await dataOperation(db,id);if(pending?.status==='pending_import')return {operationId:id,status:'pending_import'}
 return resumeErasure(db,bucket,id,authority)
}

async function claimRunner(db:D1Database,id:string,from:string,to:string,authority?:DataAuthority):Promise<void>{
 const [result]=await dataBatch(db,[db.prepare('UPDATE data_operations SET status=?,updated_at=? WHERE id=? AND status=? AND EXISTS(SELECT 1 FROM data_state WHERE lock_id=?) RETURNING 1').bind(to,new Date().toISOString(),id,from,id)],authority)
 if(result.results.length!==1)fail('data_runner_busy')
}
async function releaseRunner(db:D1Database,id:string,from:string,to:string,authority?:DataAuthority):Promise<void>{
 await dataBatch(db,[db.prepare('UPDATE data_operations SET status=?,updated_at=? WHERE id=? AND status=? AND EXISTS(SELECT 1 FROM data_state WHERE lock_id=?) RETURNING 1').bind(to,new Date().toISOString(),id,from,id)],authority)
}
export async function recoverInterruptedRunner(db:D1Database,id:string,expectedStatus:'running'|'running_r2'|'running_import',authority?:DataAuthority):Promise<void>{
 // The authenticated local operator must first quiesce the prior runner. There
 // is deliberately no timed takeover: an old runner must never write late.
 const next=expectedStatus==='running'?'pending':expectedStatus==='running_import'?'pending_import':'pending_r2'
 const [result]=await dataBatch(db,[db.prepare('UPDATE data_operations SET status=?,updated_at=? WHERE id=? AND status=? AND EXISTS(SELECT 1 FROM data_state WHERE lock_id=?) RETURNING 1').bind(next,new Date().toISOString(),id,expectedStatus,id)],authority)
 if(result.results.length!==1)fail('data_operation_changed')
}

export async function abortInterruptedExport(db:D1Database,id:string,authority?:DataAuthority):Promise<void>{
 const operation=await dataOperation(db,id)
 if(!operation||operation.kind!=='export'||operation.status!=='pending'||(await state(db))?.lock_id!==id)fail('invalid_data_operation')
 // Called only after the authenticated operator confirms the prior runner stopped.
 await finish(db,id,'aborted',authority)
}

export function validateNativeIdentity(data:Record<string,Row[]>):void{
 const nativeIds=new Set([...data.request_submission_keys.map(row=>row.request_id),...data.audit_entries.filter(row=>row.action==='request.submitted'&&row.entity_type==='request').map(row=>row.entity_id)])
 for(const request of data.requests)if(nativeIds.has(request.id)&&(!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(String(request.id))||request.slug!==`feedback-${String(request.id).toLowerCase()}`))fail('unsafe_native_public_identity',400)
}

export async function abortPendingErasure(db:D1Database,id:string,authority?:DataAuthority):Promise<void>{
 const result=await dataBatch(db,[
  db.prepare("UPDATE data_operations SET status='aborted',payload_json='{}',updated_at=? WHERE id=? AND kind='erase' AND status='pending' AND NOT EXISTS(SELECT 1 FROM data_apply_claims WHERE operation_id=?) AND EXISTS(SELECT 1 FROM data_state WHERE lock_id=?) RETURNING 1").bind(new Date().toISOString(),id,id,id),
  db.prepare("UPDATE data_state SET phase='idle',lock_id=NULL WHERE singleton=1 AND lock_id=? AND EXISTS(SELECT 1 FROM data_operations WHERE id=? AND status='aborted')").bind(id,id),
 ],authority)
 if(result[0].results.length!==1)fail('data_operation_changed')
}
