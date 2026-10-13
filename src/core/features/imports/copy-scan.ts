import {createHash} from 'node:crypto'
import {readCopyPlanPage,verifyCopyPlanPage,decodeCopyPlanPage} from './copy-plan'
import {copyPageHolds} from './erasure-scope'
import {NativeError} from '../auth/native-tokens'
import {openPreview,sealPreview,type PreviewTokenContext} from './preview-token'

export type CopyHold={table:string;key:string;columns:string[]}
export type CopyScanOptions={secret:string;subject:string;continuation?:string}
export type CopyScope={jobs:string[];identities:string[];values:string[];holds:CopyHold[]}
export type CopyCheckpoint<T>={version:1;snapshot:string;native:T;copy:CopyScope;next:number;expires:number;page?:{phase:'verify'|'scan';witness:string}}
export class CopyScanPending extends Error {
 readonly continuation:string
 constructor(continuation:string){super('erasure_preview_pending');this.continuation=continuation}
}
const changed=()=>new NativeError('erasure_plan_changed',409)
/** Native product and import metadata counters cover same-size edits. Base's
 * per-job counters fence plans/chunks, indexes, provenance, streams and originals.
 * Include every job: the plaintext-copy search also sees other destinations. */
const sha=(value:string)=>createHash('sha256').update(value).digest('hex')
type Fence={native:number;metadata:number;jobs:string;schema_tables?:string}
async function readFence(db:D1Database,includeSchema:boolean):Promise<Fence>{
 const revision=await db.prepare(`SELECT n.revision native,p.revision metadata,s.origin,s.epoch,s.phase,s.lock_id,
  ${includeSchema?"(SELECT json_group_array(json_array(name,sql)) FROM (SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name!='d1_migrations' AND name NOT LIKE 'rer_portability_%' ORDER BY name)) schema_tables,":''}
  (SELECT json_group_array(json_object('id',id,'revision',revision)) FROM
   (SELECT j.id,c.revision FROM ik_jobs j LEFT JOIN ik_d1_custody_states c ON c.job_id=j.id ORDER BY j.id)) jobs
  FROM feedback_import_native_revision n,feedback_import_preview_revision p,data_state s
  WHERE n.singleton=1 AND p.singleton=1 AND s.singleton=1`).first<Fence>()
 if(!revision||!Number.isSafeInteger(revision.native)||!Number.isSafeInteger(revision.metadata))throw changed()
 const jobs=JSON.parse(revision.jobs) as {id:string;revision:number|null}[]
 if(jobs.some(row=>!Number.isSafeInteger(row.revision)||row.revision!<0))throw changed()
 return revision
}
function fenceSnapshot(value:Fence):string{
 const {schema_tables,...revision}=value
 return JSON.stringify([sha(schema_tables!),sha(JSON.stringify(revision))])
}
export async function readCopyFence(db:D1Database):Promise<{snapshot:string;tables:{name:string;sql:string}[]}>{
 const revision=await readFence(db,true)
 return {snapshot:fenceSnapshot(revision),tables:(JSON.parse(revision.schema_tables!) as [string,string][]).map(([name,sql])=>({name,sql}))}
}
export async function copySnapshot(db:D1Database):Promise<string>{return fenceSnapshot(await readFence(db,true))}
export async function resumeCopyScan<T>(db:D1Database,context:PreviewTokenContext,continuation:string):Promise<CopyCheckpoint<T>>{
 const saved=await openPreview<CopyCheckpoint<T>>(continuation,context)
 let witness:unknown;try{witness=JSON.parse(saved.snapshot)}catch{throw changed()}
 if(!Array.isArray(witness)||witness.length!==2||witness.some(value=>typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value)))throw changed()
 // Check current row custody before doing work. The complete schema and row
 // witness is checked after the work, before every pending or final response.
 if(saved.version!==1||!Number.isSafeInteger(saved.expires)||saved.expires<Date.now()||!Number.isSafeInteger(saved.next)||saved.next<0||saved.next>saved.copy.jobs.length||witness[1]!==sha(JSON.stringify(await readFence(db,false))))throw changed()
 return saved
}
export async function deferCopyScan<T>(db:D1Database,saved:CopyCheckpoint<T>,context:PreviewTokenContext):Promise<never>{
 if(await copySnapshot(db)!==saved.snapshot)throw changed()
 throw new CopyScanPending(await sealPreview(saved,context))
}
/** Each decoded page is released before reading the next. Large pages receive
 * a separate request; native closure rounds have their own request budget. */
export async function scanCopyPages<T>(db:D1Database,saved:CopyCheckpoint<T>,read:(job:string)=>Promise<CopyHold[]>,context?:PreviewTokenContext):Promise<CopyHold[]>{
 if(context&&saved.copy.jobs.length>32){
  const job=saved.copy.jobs[saved.next]
  if(!saved.page){saved.page={phase:'verify',witness:(await readCopyPlanPage(db,job)).witness};return deferCopyScan(db,saved,context)}
  const page=await readCopyPlanPage(db,job,saved.page.witness)
  if(saved.page.phase==='verify'){verifyCopyPlanPage(page);saved.page.phase='scan';return deferCopyScan(db,saved,context)}
  saved.copy.holds.push(...copyPageHolds(saved.copy,job,decodeCopyPlanPage(page)))
  delete saved.page;saved.next++
  if(saved.next<saved.copy.jobs.length)return deferCopyScan(db,saved,context)
  return saved.copy.holds
 }
 let end=saved.copy.jobs.length
 if(context){
  const candidates=saved.copy.jobs.slice(saved.next,saved.next+32)
  const sizes=(await db.prepare("SELECT id,COALESCE(json_extract(plan_json,'$.size'),length(CAST(plan_json AS BLOB))) bytes FROM ik_jobs WHERE id IN (SELECT value FROM json_each(?))").bind(JSON.stringify(candidates)).all<{id:string;bytes:number}>()).results
  const bytes=new Map(sizes.map(row=>[row.id,row.bytes]));let total=0;end=saved.next
  for(const job of candidates){const size=bytes.get(job);if(size===undefined||!Number.isSafeInteger(size)||size<0)throw changed();if((end>saved.next)&&total+size>64*1024)break;total+=size;end++}
 }
 for(let i=saved.next;i<end;i++)saved.copy.holds.push(...await read(saved.copy.jobs[i]))
 saved.next=end
 if((!context||end<saved.copy.jobs.length)&&await copySnapshot(db)!==saved.snapshot)throw changed()
 if(end<saved.copy.jobs.length)throw new CopyScanPending(await sealPreview(saved,context!))
 return saved.copy.holds
}
