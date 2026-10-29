import {validateTeamsArchive} from '../teams/archive'
import {validateHelpScoutArchive} from '../helpscout/archive'
import {validateDiscordArchive} from '../discord/archive'
import {assertOriginalFiles} from './original-files'
import { validateCategoryArchive } from '../categories/archive'
import {validateMailIdentityArchive} from '../settings/mail-identity-archive'
import {validateLearningArchive} from '../learning/archive'
import {learningErasureStatements} from '../learning/privacy'
import {GRANT_REVOCATION_CHECKPOINT} from '../learning/journal'
import { z } from 'zod'
import { portabilityErasureStatements, abortPortabilityActor } from '../../../../scripts/portability/cleanup.mjs'
import { NativeError, digest } from '@/core/features/auth/native-tokens'
import { createUlid } from '@/core/shared/ulid'
import inventory from './schema-inventory.json'
import {hostErasureStatements} from '../auth/host-custody'
import {admitFlatImportErasure} from '../imports/erasure-admission'
import {importCopyHolds,prepareCopyScope,readCopyPage} from '../imports/erasure-scope'
import {copySnapshot,readCopyFence,resumeCopyScan,scanCopyPages,deferCopyScan,type CopyScanOptions,type CopyCheckpoint} from '../imports/copy-scan'
import { importErasureStatements } from '../imports/erasure'
import {retainErasureWork,resumeImportErasure} from '../imports/erasure-work'
import { validateFeedbackArchive } from '../imports/archive-custody'
import { feedbackRestoreCustody } from '../imports/archive-restore'
import {eraseArchivedSourceOptions,eraseExportedSourceOptions} from '../imports/archive-source-erasure'
import { clauseDeletionOrder } from './erasure-dependencies'
import { parentsFirst } from './restore-order'
import { checkCopyResolutions, redactionStatements, type BlockedCopy, type CopyResolution, type Redaction } from './erasure-redaction'
import {assertPlatformLedger} from './platform-ledger'
import {excludedTable} from '@runeditrun/rer/modules/portability'
import {startNativeScope,stepNativeScope,finishNativeScope,type NativeScope,type ErasureTable} from './erasure-native'
import { assertDataAuthority, dataBatch, type DataAuthority } from './authority'
import { claimPortabilityRunner, requirePortabilityOwner } from './portability-lock'
import { registerWork } from './runner/claims'
import type { D1Sql } from '../../../../base/modules/import-kit/src/d1/types'
export type Cell=string|number|null
export type Row=Record<string,Cell>
type ForeignKey={table:string;from:string;to:string;id:number;seq:number;on_delete:string}
export type Table={name:string;sql:string;columns:{name:string;pk:number}[];foreignKeys:ForeignKey[]}
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
export const hash=(value:unknown)=>digest(canonical(value))
function fail(code:string,status:400|409|413|503=409):never{throw new NativeError(code,status)}
function foreignGroups(keys:ForeignKey[]):Map<number,ForeignKey[]>{const groups=new Map<number,ForeignKey[]>();for(const key of keys)groups.set(key.id,[...(groups.get(key.id)??[]),key]);return groups}
const ident=(name:string)=>{if(!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name))fail('unsupported_schema');return '"'+name+'"'}
export const keyColumns=(table:Pick<Table,'columns'>)=>table.columns.some(column=>column.pk>0)?table.columns.filter(column=>column.pk>0).sort((a,b)=>a.pk-b.pk):table.columns
export const rowKey=(table:Pick<Table,'columns'>,row:Row)=>canonical(keyColumns(table).map(column=>row[column.name]))
const schemaHash=(tables:Table[])=>hash(tables.map(table=>({name:table.name,sql:table.sql})))
export const state=(db:D1Database)=>db.prepare('SELECT origin,epoch,phase,lock_id FROM data_state WHERE singleton=1').first<State>()
export type TableHeader={name:string;sql:string}
// Host bookkeeping is not Penny's data: Base's platform list names the migration
// ledgers (Wrangler's, the demo hosts' _rer_* and RER Platform's rer_migrations),
// Base's hosted-demo state (rer_demo) and portability's working tables. Naming a
// table in includeTables leaves only that mandatory platform test, by exact name
// or Base's own prefixes. Base tables Penny's inventory classifies keep its checks.
const hostTable=(name:string)=>!Object.hasOwn(inventory,name)&&excludedTable(name,{includeTables:[name]})
export async function schemaHeaders(db:D1Database):Promise<TableHeader[]>{
 return (await db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' ORDER BY name").all<TableHeader>()).results.filter(table=>!hostTable(table.name))
}
export function checkSchemaHeaders(headers:{name:string}[]):void{
 const classified=inventory as Record<string,{classification:string;columns:string[]}>,names=new Set(headers.map(table=>table.name))
 if(headers.some(table=>!classified[table.name])||Object.entries(classified).some(([name,definition])=>definition.classification!=='installation'&&!names.has(name)))fail('unclassified_archive_schema',503)
}
export async function schemaPart<T extends {name:string}>(db:D1Database,headers:T[]):Promise<(T&Pick<Table,'columns'|'foreignKeys'>)[]>{
 const namesJson=JSON.stringify(headers.map(table=>table.name)),definitions=await db.batch([db.prepare('SELECT names.value native_table,p.name,p.pk FROM json_each(?) names,pragma_table_info(names.value) p').bind(namesJson),db.prepare('SELECT names.value native_table,p.id,p.seq,p."table",p."from",p."to",p.on_delete FROM json_each(?) names,pragma_foreign_key_list(names.value) p').bind(namesJson)])
 const classified=inventory as Record<string,{classification:string;columns:string[]}>
 return headers.map(table=>{
  const columns=(definitions[0].results as (Table['columns'][number]&{native_table:string})[]).filter(row=>row.native_table===table.name),expected=classified[table.name]
  if(canonical(columns.map(column=>column.name))!==canonical(expected.columns))fail('unclassified_archive_schema',503)
  return {...table,columns,foreignKeys:(definitions[1].results as (ForeignKey&{native_table:string})[]).filter(row=>row.native_table===table.name)}
 }).filter(table=>classified[table.name].classification==='product')
}
export async function schema(db:D1Database):Promise<Table[]>{
 const headers=await schemaHeaders(db);checkSchemaHeaders(headers);return schemaPart(db,headers)
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
 if(name==='penny_teams_sources'&&row.check_claim!==null&&row.check_claim!==undefined)return {...row,check_claim:null,check_started_at:null,check_failure:'restored_source_check_review_required'}
 if(name==='penny_discord_sources'&&row.check_claim!==null&&row.check_claim!==undefined)return {...row,check_claim:null,check_started_at:null,check_failure:'restored_source_check_review_required'}
 if(name==='penny_teams_settings')return {...row,enabled:0}
 if(name==='penny_discord_settings')return {...row,enabled:0}
 if(name==='penny_teams_jobs'&&['pending','running','failed'].includes(String(row.state)))return {...row,state:'held',claim:null,failure:'restored_capture_review_required'}
 if(name==='penny_discord_jobs'&&['pending','running','failed'].includes(String(row.state)))return {...row,state:'held',claim:null,failure:'restored_capture_review_required'}
 if(name==='penny_helpscout_connection')return {...row,enabled:0}
 if(name==='penny_helpscout_captures')return {...row,state:row.evidence_id===null?'held':'done',claim:null,started_at:null,failure:'restored_capture_review_required'}
 if(name==='penny_helpscout_replies'&&['draft','sending'].includes(String(row.state)))return {...row,state:'held'}
 if(name==='penny_request_batches')return {...row,held:1}
 if(name==='penny_weekly_publications')return {...row,held:1}
 if(name==='penny_weekly_summary')return {...row,enabled:0}
 if(name==='penny_weekly_choices')return {...row,subscribed:0,revoked_at:row.revoked_at??'1970-01-01T00:00:00.000Z'}
 if(name==='penny_requester_oauth')return {...row,enabled:0}
 // Advance freshness only when imposing the restore hold, so normalized rows
 // remain unchanged through export validation, restore and later exports.
 if(name==='penny_ai_runs'&&row.state==='reserved')return {...row,state:'uncertain'}
 if(name==='learning_sources')return row.state==='held'?row:{...row,state:'held',version:Number(row.version)+1}
 if(name==='learning_investigations')return row.state==='revoked'||(row.state==='held'&&row.last_reason==='restored_grant_review_required')?row:{...row,state:'held',version:Number(row.version)+1,last_reason:'restored_grant_review_required'}
 if(name==='learning_runs'&&row.state==='running')return {...row,state:'uncertain',reason:'restored_run_reconciliation_required'}
 if(name==='operator_sessions'||name==='native_requester_sessions')return {...row,token_hash:`disabled-${row.id}`,revoked_at:row.revoked_at??'1970-01-01T00:00:00.000Z'}
 if(name==='native_magic_links')return {...row,token_hash:`disabled-${row.id}`,consumed_at:row.consumed_at??'1970-01-01T00:00:00.000Z'}
 if(name==='penny_publication_schedules'&&row.state==='scheduled')return {...row,state:'held',last_error:'Restored schedule requires review before rescheduling.'}
 if(name==='notification_outbox'&&row.delivery_state==='queued')return {...row,delivery_state:'unknown',failure_reason:'restored_delivery_review_required'}
 if(name==='decision_review_notifications'&&['queued','sending','unknown'].includes(String(row.state)))return {...row,state:'held',claim_id:null,failure_reason:'restored_delivery_review_required'}
 if(name==='notification_batches'&&row.state==='queued')return {...row,failure_reason:'restored_delivery_review_required'}
 if(name==='integration_deliveries'&&['queued','sending'].includes(String(row.state)))return {...row,state:'uncertain',claim:null,claim_until:null}
 // Destinations and tracker connections travel as records; their credentials
 // and operator authority stay with the source, so a restored one is revoked.
 if(name==='penny_integration_destinations'||name==='penny_tracker_connections')return {...row,revoked_at:row.revoked_at??0}
 if(name==='penny_integration_events')return {...row,held:1}
 if(name==='penny_tracker_commands')return {...row,held:1}
 if(name==='penny_merge_notices')return {...row,restoration_hold_at:row.restoration_hold_at??'1970-01-01T00:00:00.000Z'}
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
export async function reserve(db:D1Database,kind:'export'|'restore'|'erase',payload:unknown,authority?:DataAuthority):Promise<string>{
 const id=createUlid(),now=new Date().toISOString()
 // A confirmed erasure or restore is server work from here (runner/advance.ts).
 const work=kind==='export'?[]:[registerWork(db,id,'operation',authority,undefined,{sql:'EXISTS(SELECT 1 FROM data_state WHERE lock_id=?)',params:[id]})]
 let result:D1Result[]
 try {result=await dataBatch(db,[db.prepare("UPDATE data_state SET phase='locked',lock_id=? WHERE singleton=1 AND phase='idle' RETURNING 1").bind(id),db.prepare("INSERT INTO data_operations(id,kind,status,payload_json,created_at,updated_at) SELECT ?,?,'pending',?,?,? WHERE EXISTS(SELECT 1 FROM data_state WHERE lock_id=?)").bind(id,kind,canonical(payload),now,now,id),...work],authority)}catch(error){if(String(error).includes('attachment_writer_active'))fail('attachment_writer_active');if(String(error).includes('notification_writer_active'))fail('notification_writer_active');throw error}
 if(result[0].results.length!==1)fail('data_busy');return id
}
export async function finish(db:D1Database,id:string,status:'complete'|'aborted',authority?:DataAuthority):Promise<void>{
 await dataBatch(db,[db.prepare("UPDATE data_operations SET status=?,payload_json='{}',updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM data_state WHERE lock_id=?)").bind(status,new Date().toISOString(),id,id),db.prepare('UPDATE data_runner_claims SET finished_at=COALESCE(finished_at,?),updated_at=? WHERE work_id=? AND EXISTS(SELECT 1 FROM data_state WHERE lock_id=?)').bind(Date.now(),Date.now(),id,id),db.prepare("UPDATE data_state SET phase='idle',lock_id=NULL WHERE singleton=1 AND lock_id=?").bind(id),...(status==='complete'?[db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) SELECT ?,?,?,'data.erasure_completed','data_operation',id,?,?,? FROM data_operations WHERE id=? AND kind='erase' AND status='complete' AND changes()>0`).bind(createUlid(),authority?'operator':'system',authority?.operatorId??'data.operations',new Date().toISOString(),new Date().toISOString(),new Date().toISOString(),id)]:[])],authority)
}
export const applyStart=(db:D1Database,id:string)=>[db.prepare("INSERT INTO data_apply_claims(operation_id) VALUES((SELECT lock_id FROM data_state WHERE singleton=1 AND lock_id=? AND phase='locked'))").bind(id),db.prepare("UPDATE data_state SET phase='applying' WHERE singleton=1 AND lock_id=?").bind(id),db.prepare('PRAGMA defer_foreign_keys=ON')]
export const audit=(db:D1Database,action:string,id:string,authority?:DataAuthority,details:string|null=null)=>{const now=new Date().toISOString();return db.prepare("INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,details_json,created_at,updated_at) VALUES(?,?,?,?,'data_operation',?,?,?,?,?)").bind(createUlid(),authority?'operator':'system',authority?.operatorId??'data.operations',action,id,now,details,now,now)}
export async function exportArchive(db:D1Database,bucket:R2Bucket,authority?:DataAuthority):Promise<{archive:Archive;journal:ErasureJournal}>{
 const id=await reserve(db,'export',{},authority)
 try {
  await assertPlatformLedger(db)
  const tables=await schema(db);let data=await rows(db,tables);limits(data);validateNativeIdentity(data);await validateTeamsArchive(data);await validateDiscordArchive(data);await validateHelpScoutArchive(data);validateMailIdentityArchive(data);validateFeedbackArchive(data);await validateLearningArchive(data)
  if(await eraseExportedSourceOptions(db,id,data,authority)){data=await rows(db,tables);limits(data);validateNativeIdentity(data);await validateTeamsArchive(data);await validateDiscordArchive(data);await validateHelpScoutArchive(data);validateMailIdentityArchive(data);validateFeedbackArchive(data);await validateLearningArchive(data)}
  if(data.request_attachment_uploads?.length||data.evidence_attachment_uploads?.length)fail('unfinished_attachment_uploads')
  const journal=await readErasureJournal(db)
  if(data.release_attachments.some(row=>row.state==='writing'))fail('unfinished_attachment_uploads')
  const attachments=[...data.attachments,...data.release_attachments]
  await assertOriginalFiles(db,bucket)
  const files:Archive['files']=[];let total=0
  for(const attachment of attachments){
   const object=await bucket.get(String(attachment.storage_key));if(!object)fail('missing_attachment',503)
   if(object.size!==attachment.byte_size||object.size>DATA_LIMITS.fileBytes)fail('attachment_size',413)
   total+=object.size;if(total>DATA_LIMITS.filesBytes)fail('archive_limit',413)
   const bytes=new Uint8Array(await object.arrayBuffer());if(attachment.sha256&&await bytesHash(bytes)!==attachment.sha256)fail('attachment_hash',503);let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte)
   files.push({key:String(attachment.storage_key),bytes:btoa(binary),sha256:await bytesHash(bytes),contentType:String(attachment.content_type),size:bytes.byteLength})
  }
  const body={format:'penny-data' as const,version:1 as const,schemaHash:await schemaHash(tables),origin:journal.origin,epoch:journal.epoch,journalHash:journal.sha256,tables:Object.fromEntries(tables.map(table=>[table.name,data[table.name].map(row=>normalize(table.name,row))])),files}
  const archive={...body,sha256:await hash(body)};if(new TextEncoder().encode(canonical(archive)).byteLength>DATA_LIMITS.archiveBytes)fail('archive_limit',413)
  await finish(db,id,'complete',authority);return {archive,journal}
 }catch(error){await finish(db,id,'aborted');throw error}
}
async function bytesHash(bytes:Uint8Array):Promise<string>{return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>))].map(value=>value.toString(16).padStart(2,'0')).join('')}
// The migration seeds roadmap defaults before any business data exists; an
// otherwise empty restore replaces that configuration with the archived choice.
const bootstrapTables=new Set(['penny_triage_settings','penny_mail_identity','penny_status_roadmap_settings','operators','operator_sessions','native_magic_links','local_auth_outbox','native_rate_limits'])
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
 await assertPlatformLedger(db)
 const tables=await schema(db)
 if(await schemaHash(tables)!==archive.schemaHash||canonical(Object.keys(archive.tables).sort())!==canonical(tables.map(table=>table.name).sort()))fail('unsupported_archive_schema')
 limits(archive.tables);validateNativeIdentity(archive.tables);await validateTeamsArchive(archive.tables);await validateDiscordArchive(archive.tables);await validateHelpScoutArchive(archive.tables);validateCategoryArchive(archive.tables);validateMailIdentityArchive(archive.tables);validateFeedbackArchive(archive.tables);await validateLearningArchive(archive.tables)
 if(archive.tables.request_attachment_uploads.length||archive.tables.evidence_attachment_uploads.length)fail('unfinished_attachment_uploads')
 for(const table of tables){
  const keys=new Set<string>()
  for(const row of archive.tables[table.name]){
   if(canonical(Object.keys(row).sort())!==canonical(table.columns.map(column=>column.name).sort()))fail('invalid_archive_columns',400)
   const key=rowKey(table,row);if(keys.has(key))fail('duplicate_archive_key',400);keys.add(key)
  }
 }
 // Tombstones compare opaque primary-key hashes, never original private wording.
 for(const item of journal.tombstones){if(item.table_name===GRANT_REVOCATION_CHECKPOINT)continue;const table=tables.find(table=>table.name===item.table_name);if(!table)fail('unsupported_journal_schema');for(const row of archive.tables[table.name])if(await hash([journal.origin,table.name,rowKey(table,row)])===item.key_hash)fail('erased_archive_record')}
 if(archive.tables.release_attachments.some(row=>row.state==='writing'))fail('unfinished_attachment_uploads')
 const attachments=[...archive.tables.attachments,...archive.tables.release_attachments]
 const files=new Map(archive.files.map(file=>[file.key,file]));if(files.size!==archive.files.length||files.size!==attachments.length)fail('invalid_archive_files',400)
 let total=0;const bytes:Uint8Array[]=[]
 for(const file of archive.files){
  const attachment=attachments.find(row=>row.storage_key===file.key)
  if(!attachment||attachment.byte_size!==file.size||attachment.content_type!==file.contentType||file.size>DATA_LIMITS.fileBytes)fail('invalid_archive_files',400)
  if(file.bytes.length!==Math.ceil(file.size/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(file.bytes))fail('archive_corrupt',400)
  let buffer:Uint8Array;try{buffer=Uint8Array.from(atob(file.bytes),character=>character.charCodeAt(0))}catch{fail('archive_corrupt',400)}
  if(buffer!.byteLength!==file.size||await bytesHash(buffer!)!==file.sha256||(attachment.sha256&&attachment.sha256!==file.sha256))fail('archive_corrupt',400)
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
/** The validated backup waits here while its restore runs on the server, so a
 * closed tab or a stopped step can continue. Restore, export and the empty-store
 * check never treat it as an original file; it is deleted when the restore ends. */
export const restoreStagingKey=(id:string)=>`penny-data-staging/restore-${id}.json`
const isStaging=(key:string)=>key.startsWith('penny-data-staging/')
type RestorePayload={archiveHash:string;journalHash:string;keys:string[];r2Owned?:boolean}
/** Checks the backup, takes the data lock and stages the backup for the server.
 * Resuming an existing restore with the same backup re-stages it if needed. */
export async function startRestore(db:D1Database,bucket:R2Bucket,value:unknown,journalValue:unknown,resumeId?:string,authority?:DataAuthority):Promise<string>{
 const existing=resumeId?await dataOperation(db,resumeId):null
 if(resumeId&&(!existing||existing.kind!=='restore'))fail('invalid_data_operation',400)
 if(existing?.status==='complete')return existing.id
 if(existing?.status==='aborted')fail('data_operation_aborted')
 const {archive,journal,tables}=await validated(db,value,journalValue)
 validateReferences(tables,archive.tables)
 const payload={archiveHash:archive.sha256,journalHash:journal.sha256,keys:archive.files.map(file=>file.key)}
 if(existing){
  const {r2Owned:ignored,...identity}=JSON.parse(existing.payload_json) as RestorePayload;void ignored
  if(canonical(identity)!==canonical(payload)||(await state(db))?.lock_id!==existing.id)fail('data_operation_mismatch')
  if(!await bucket.head(restoreStagingKey(existing.id)))await bucket.put(restoreStagingKey(existing.id),JSON.stringify({archive,journal}))
  await dataBatch(db,[registerWork(db,existing.id,'operation',authority)],authority)
  return existing.id
 }
 const id=await reserve(db,'restore',payload,authority)
 try{await bucket.put(restoreStagingKey(id),JSON.stringify({archive,journal}))}catch(error){await finish(db,id,'aborted');throw error}
 return id
}
/** One restore step: the staged backup's files and records, applied once. */
export async function applyRestore(db:D1Database,bucket:R2Bucket,id:string,authority?:DataAuthority):Promise<{operationId:string;status:string}>{
 const staged=await bucket.get(restoreStagingKey(id))
 // The upload stopped before the backup was saved: nothing was restored.
 if(!staged){await finish(db,id,'aborted');fail('restore_upload_incomplete')}
 const {archive:value,journal:journalValue}=JSON.parse(await staged.text()) as {archive:unknown;journal:unknown}
 const input=await validated(db,value,journalValue),{archive,journal,tables,bytes}=input
 const payload:RestorePayload={archiveHash:archive.sha256,journalHash:journal.sha256,keys:archive.files.map(file=>file.key)}
 const saved=JSON.parse((await dataOperation(db,id))!.payload_json) as RestorePayload
 await claimRunner(db,id,'pending','running',authority)
 let ownsR2=saved.r2Owned===true
 try{
  const occupied=await db.batch(tables.map(table=>db.prepare(`SELECT 1 AS occupied FROM ${ident(table.name)} LIMIT 1`)))
  if(tables.some((table,index)=>!bootstrapTables.has(table.name)&&occupied[index].results.length))fail('restore_requires_empty_target')
  if(!ownsR2){
   if((await bucket.list({limit:2})).objects.some(object=>!isStaging(object.key)))fail('restore_requires_empty_bucket')
   const [ownership]=await dataBatch(db,[db.prepare("UPDATE data_operations SET payload_json=?,updated_at=? WHERE id=? AND status='running' AND EXISTS(SELECT 1 FROM data_state WHERE lock_id=?) RETURNING 1").bind(canonical({...payload,r2Owned:true}),new Date().toISOString(),id,id)],authority)
   if(ownership.results.length!==1)fail('data_operation_changed')
   ownsR2=true
  }
  for(let index=0;index<archive.files.length;index++){const file=archive.files[index];await assertDataAuthority(db,authority);await bucket.put(file.key,bytes[index],{httpMetadata:{contentType:file.contentType}})}
  eraseArchivedSourceOptions(archive.tables)
  const importCustody=await feedbackRestoreCustody(db,archive.tables)
  const statements=[...applyStart(db,id),...importCustody.before,...tables.map(table=>db.prepare(`DELETE FROM ${ident(table.name)}`))]
  for(const table of tables)for(const original of parentsFirst(table,archive.tables[table.name])){
   const row=normalize(table.name,original),columns=table.columns.map(column=>column.name)
   statements.push(db.prepare(`INSERT INTO ${ident(table.name)}(${columns.map(ident).join(',')}) VALUES(${columns.map(()=>'?').join(',')})`).bind(...columns.map(column=>row[column])))
  }
  statements.push(...importCustody.after)
  // Never delete a destination erasure journal. Validation requires a superset.
  for(const item of journal.tombstones)statements.push(db.prepare('INSERT OR IGNORE INTO data_tombstones(epoch,table_name,key_hash) VALUES(?,?,?)').bind(item.epoch,item.table_name,item.key_hash))
  statements.push(db.prepare('UPDATE data_state SET origin=?,epoch=? WHERE singleton=1 AND lock_id=?').bind(journal.origin,journal.epoch,id),audit(db,'data.restored',id,authority),db.prepare("UPDATE data_operations SET status='complete',payload_json='{}',updated_at=? WHERE id=?").bind(new Date().toISOString(),id),db.prepare('UPDATE data_runner_claims SET finished_at=COALESCE(finished_at,?),updated_at=? WHERE work_id=?').bind(Date.now(),Date.now(),id),db.prepare("UPDATE data_state SET phase='idle',lock_id=NULL WHERE singleton=1 AND lock_id=?").bind(id))
  await dataBatch(db,statements,authority)
  await bucket.delete(restoreStagingKey(id)).catch(()=>undefined)
  return {operationId:id,status:'complete'}
 }catch(error){
  // A response fault after commit must not delete successfully restored files.
  const operation=await dataOperation(db,id)
  if(operation?.status==='complete')return {operationId:id,status:'complete'}
  // A superseded runner leaves everything to the runner that took over.
  if(error instanceof NativeError&&error.code==='data_runner_superseded')throw error
  // Compensation may release this runner's lock and staged originals after
  // authority is lost, but never applies the archive or authorizes new work.
  try{if(ownsR2)await deleteFiles(bucket,payload.keys);await bucket.delete(restoreStagingKey(id));await finish(db,id,'aborted')}catch{await releaseRunner(db,id,'running','pending');if(error instanceof NativeError&&error.status===401)throw error;return {operationId:id,status:'pending'}}
  throw error
 }
}
export async function abortRestore(db:D1Database,bucket:R2Bucket,id:string,authority?:DataAuthority):Promise<void>{
 const operation=await dataOperation(db,id)
 if(!operation||operation.kind!=='restore'||operation.status!=='pending'||(await state(db))?.lock_id!==id)fail('invalid_data_operation')
 await claimRunner(db,id,'pending','running',authority)
 try{const payload=JSON.parse(operation.payload_json) as {keys:string[];r2Owned?:boolean};if(payload.r2Owned===true){await assertDataAuthority(db,authority);await deleteFiles(bucket,payload.keys)}await bucket.delete(restoreStagingKey(id));await finish(db,id,'aborted',authority)}catch(error){await releaseRunner(db,id,'running','pending');throw error}
}
const roots=new Set(['requesters','requests','evidence_items','accounts'])
type ErasurePlan={table:string;id:string;planHash:string;counts:Record<string,number>;files:string[];blockedCopies:BlockedCopy[];redactions:Redaction[];selected:Record<string,Row[]>;audit:Row[];tables:ErasureTable[];rows:Map<string,Row>;literals:string[]}
type ErasureReview=Omit<ErasurePlan,'tables'|'rows'|'literals'>
type CachedErasure={phase:'native';scope:NativeScope}|{phase:'prepare'|'copy';current:State;plan:Omit<ErasureReview,'planHash'>;literals?:string[]}
const emptyCopy=()=>({jobs:[],identities:[],values:[],holds:[]})
async function advancePreview(db:D1Database,saved:CopyCheckpoint<CachedErasure>,context:{secret:string;subject:string;table:string;id:string}):Promise<ErasureReview>{
 if(saved.native.phase==='native'){
  if(await stepNativeScope(db,saved.native.scope,true))return deferCopyScan(db,saved,context)
  const {plan,literals}=finishNativeScope(saved.native.scope),{tables:definitions,rows,...cached}=plan;void definitions;void rows
  saved.native={phase:'prepare',current:(await state(db))!,plan:cached,literals}
  return deferCopyScan(db,saved,context)
 }
 if(saved.native.phase==='prepare'){
  saved.copy=await prepareCopyScope(db,saved.native.plan.selected.feedback_import_records,new Set(saved.native.literals))
  delete saved.native.literals;saved.native.phase='copy'
  return deferCopyScan(db,saved,context)
 }
 const holds=await scanCopyPages(db,saved,job=>readCopyPage(db,saved.copy,job),context)
 const {current,plan}=saved.native,blockedCopies=[...plan.blockedCopies,...holds]
 const planHash=await hash({origin:current.origin,epoch:current.epoch,table:plan.table,id:plan.id,selected:plan.selected,audits:plan.audit,files:plan.files,blockedCopies,redactions:plan.redactions})
 if(await copySnapshot(db)!==saved.snapshot)fail('erasure_plan_changed')
 return {...plan,blockedCopies,planHash}
}
export function planErasure(db:D1Database,tableName:string,id:string):Promise<ErasurePlan>
export function planErasure(db:D1Database,tableName:string,id:string,copyScan:CopyScanOptions):Promise<ErasureReview>
export async function planErasure(db:D1Database,tableName:string,id:string,copyScan?:CopyScanOptions):Promise<ErasurePlan|ErasureReview>{
 if(!roots.has(tableName))fail('unsupported_erasure_entity',400)
 const context=copyScan?{...copyScan,table:tableName,id}:undefined
 if(copyScan?.continuation)return advancePreview(db,await resumeCopyScan<CachedErasure>(db,context!,copyScan.continuation),context!)
 const fence=copyScan?await readCopyFence(db):undefined,snapshot=fence?.snapshot
 const retained=copyScan?await db.prepare("SELECT count(*) count FROM ik_jobs WHERE destination='penny-feedback'").first<number>('count'):0
 const scope=await startNativeScope(db,tableName,id,retained!>32?fence!.tables:undefined)
 if(copyScan){
  if(retained!>32)return deferCopyScan(db,{version:1,snapshot:snapshot!,native:{phase:'native',scope},copy:emptyCopy(),next:0,expires:Date.now()+60*60*1000},context!)
 }
 while(await stepNativeScope(db,scope)){ /* The destructive path independently closes the complete graph. */ }
 const {plan,literals}=finishNativeScope(scope),current=(await state(db))!
 if(copyScan){
  const copy=await prepareCopyScope(db,plan.selected.feedback_import_records,new Set(literals)),{tables:definitions,rows,...cached}=plan;void definitions;void rows
  const saved:CopyCheckpoint<CachedErasure>={version:1,snapshot:snapshot!,native:{phase:'copy',current,plan:cached},copy,next:0,expires:Date.now()+60*60*1000}
  return advancePreview(db,saved,context!)
 }
 plan.blockedCopies.push(...await importCopyHolds(db,plan.selected.feedback_import_records,new Set(literals)))
 const planHash=await hash({origin:current.origin,epoch:current.epoch,table:tableName,id,selected:plan.selected,audits:plan.audit,files:plan.files,blockedCopies:plan.blockedCopies,redactions:plan.redactions})
 return {...plan,planHash,literals}
}
/** R2 deletes 1 to 1,000 keys per call: an operation without files deletes none. */
async function deleteFiles(bucket:R2Bucket,keys:string[]):Promise<void>{
 for(let start=0;start<keys.length;start+=1000)await bucket.delete(keys.slice(start,start+1000))
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
  await assertDataAuthority(db,authority);await deleteFiles(bucket,payload.keys)
  await finish(db,id,'complete',authority);return {operationId:id,status:'complete'}
 }catch(error){
  await releaseRunner(db,id,'running_r2','pending_r2')
  if(error instanceof NativeError&&error.status===401)throw error
  return {operationId:id,status:'pending_r2'}
 }
}
type ErasurePayload={table:string;id:string;planHash:string;admission:D1Sql[];resolutions?:CopyResolution[]}
/** Checks the reviewed plan and admits every saved-import step, then takes the
 * data lock. From here the erasure is server work that runs to completion. */
export async function startErasure(db:D1Database,tableName:string,entityId:string,planHash:string,authority?:DataAuthority,resolutions:CopyResolution[]=[]):Promise<string>{
 const reviewed=await planErasure(db,tableName,entityId)
 if(reviewed.planHash!==planHash)fail('erasure_plan_changed')
 checkCopyResolutions(reviewed.blockedCopies,resolutions,reviewed.literals)
 await assertDataAuthority(db,authority)
 const admission=await admitFlatImportErasure(db,reviewed.selected.feedback_import_records,authority)
 return reserve(db,'erase',{table:tableName,id:entityId,planHash,admission,resolutions} satisfies ErasurePayload,authority)
}
/** The erasure's one transaction over the product graph, inside the lock. */
export async function applyErasure(db:D1Database,id:string,payload:Partial<ErasurePayload>,authority?:DataAuthority):Promise<void>{
 const {table:tableName,id:entityId,planHash,admission:importAdmission,resolutions=[]}=payload
 // Started by an earlier version that kept no plan: nothing was erased yet.
 if(!tableName||!entityId||!planHash||!importAdmission){await finish(db,id,'aborted');fail('erasure_not_started')}
 try{
  const plan=await planErasure(db,tableName,entityId)
  if(plan.planHash!==planHash)fail('erasure_plan_changed')
  checkCopyResolutions(plan.blockedCopies,resolutions,plan.literals)
  const current=(await state(db))!,epoch=current.epoch+1,journal=await readErasureJournal(db)
  if(journal.tombstones.length+Object.values(plan.selected).reduce((n,rows)=>n+rows.length,0)>ERASURE_LIMITS.rows)fail('journal_limit',413)
  const statements=[...applyStart(db,id),...importAdmission.map(query=>db.prepare(query.sql).bind(...query.params??[])),db.prepare('DELETE FROM ik_d1_assertions'),...await portabilityErasureStatements(db),...redactionStatements(db,plan.tables,plan,resolutions,plan.literals)]
  statements.push(...retainErasureWork(db,id,plan.selected.feedback_import_records),...importErasureStatements(db,plan.selected),...await hostErasureStatements(db,plan.selected),...await learningErasureStatements(db,plan.selected))
  // Development mail contains credentials, is never portable, and loses captures
  // for each erased identity in the same transaction as the product graph.
  const hasLocalOutbox = await db.prepare("SELECT 1 present FROM sqlite_master WHERE type='table' AND name='rer_mail_development_outbox'").first()
  // A capture is removed when the address appears anywhere in it, as a recipient or in a body.
  for (const address of hasLocalOutbox ? plan.selected.requester_addresses ?? [] : []) statements.push(db.prepare('DELETE FROM rer_mail_development_outbox WHERE instr(lower(message),lower(?))>0').bind(address.email))
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
  // A system row's actor is the feature that acted (BASE-OPS-005), never a person; it stays.
  for(const row of plan.audit)statements.push(db.prepare("UPDATE audit_entries SET entity_id=?,actor_id=CASE WHEN actor_type='system' THEN actor_id END,details_json=NULL,updated_at=? WHERE id=?").bind(anonymousReference,new Date().toISOString(),row.id))
  statements.push(audit(db,'data.erased',id,authority,JSON.stringify({phase:'native_rows_erased',targetType:tableName,targetReference:await hash([current.origin,tableName,entityId]),recordsKeptWithoutWords:plan.redactions.length,copiesRedacted:resolutions.filter(item=>item.resolution==='redact').length,copiesRenamed:resolutions.filter(item=>item.resolution==='rename').length})),db.prepare('UPDATE data_state SET epoch=?,phase=\'locked\' WHERE singleton=1 AND lock_id=?').bind(epoch,id),db.prepare("UPDATE data_operations SET status=?,payload_json=?,updated_at=? WHERE id=?").bind(plan.selected.feedback_import_records.length?'pending_import':'pending_r2',canonical({keys:plan.files}),new Date().toISOString(),id))
  await dataBatch(db,statements,authority)
 }catch(error){
  const operation=await dataOperation(db,id)
  if(['pending_r2','pending_import'].includes(operation?.status??''))return
  // A superseded runner leaves the operation to the runner that took it over.
  if(!(error instanceof NativeError&&error.code==='data_runner_superseded'))await finish(db,id,'aborted')
  throw error
 }
}


async function claimRunner(db:D1Database,id:string,from:string,to:string,authority?:DataAuthority):Promise<void>{
 const [result]=await dataBatch(db,[db.prepare('UPDATE data_operations SET status=?,updated_at=? WHERE id=? AND status=? AND EXISTS(SELECT 1 FROM data_state WHERE lock_id=?) RETURNING 1').bind(to,new Date().toISOString(),id,from,id)],authority)
 if(result.results.length!==1)fail('data_runner_busy')
}
async function releaseRunner(db:D1Database,id:string,from:string,to:string,authority?:DataAuthority):Promise<void>{
 await dataBatch(db,[db.prepare('UPDATE data_operations SET status=?,updated_at=? WHERE id=? AND status=? AND EXISTS(SELECT 1 FROM data_state WHERE lock_id=?) RETURNING 1').bind(to,new Date().toISOString(),id,from,id)],authority)
}
export async function recoverInterruptedRunner(db:D1Database,id:string,expectedStatus:'running'|'running_r2'|'running_import',authority?:DataAuthority):Promise<void>{
 const operation=await dataOperation(db,id),payload=operation?.kind==='export'?JSON.parse(operation.payload_json) as {portabilityActor?:string}:null
 if(payload?.portabilityActor)await requirePortabilityOwner(db,payload.portabilityActor,authority)
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
 const payload=JSON.parse(operation.payload_json) as {portabilityActor?:string}
 if(payload.portabilityActor){
  await requirePortabilityOwner(db,payload.portabilityActor,authority)
  const runner=await claimPortabilityRunner(db,id,authority)
  try{await abortPortabilityActor(runner.db,payload.portabilityActor);await finish(runner.db,id,'aborted',authority)}finally{await runner.release()}
 }else await finish(db,id,'aborted',authority)
}

export function validateNativeIdentity(data:Record<string,Row[]>):void{
 const nativeIds=new Set([...data.request_submission_keys.map(row=>row.request_id),...data.audit_entries.filter(row=>row.action==='request.submitted'&&row.entity_type==='request').map(row=>row.entity_id)])
 for(const request of data.requests)if(nativeIds.has(request.id)&&(!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(String(request.id))||request.slug!==`feedback-${String(request.id).toLowerCase()}`))fail('unsafe_native_public_identity',400)
}

export async function abortPendingErasure(db:D1Database,id:string,authority?:DataAuthority):Promise<void>{
 const result=await dataBatch(db,[
  db.prepare("UPDATE data_operations SET status='aborted',payload_json='{}',updated_at=? WHERE id=? AND kind='erase' AND status='pending' AND NOT EXISTS(SELECT 1 FROM data_apply_claims WHERE operation_id=?) AND EXISTS(SELECT 1 FROM data_state WHERE lock_id=?) RETURNING 1").bind(new Date().toISOString(),id,id,id),
  db.prepare("UPDATE data_runner_claims SET finished_at=COALESCE(finished_at,?),updated_at=? WHERE work_id=? AND EXISTS(SELECT 1 FROM data_operations WHERE id=? AND status='aborted')").bind(Date.now(),Date.now(),id,id),
  db.prepare("UPDATE data_state SET phase='idle',lock_id=NULL WHERE singleton=1 AND lock_id=? AND EXISTS(SELECT 1 FROM data_operations WHERE id=? AND status='aborted')").bind(id,id),
 ],authority)
 if(result[0].results.length!==1)fail('data_operation_changed')
}
