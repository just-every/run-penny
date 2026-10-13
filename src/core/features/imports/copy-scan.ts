import {Buffer} from 'node:buffer'
import {digest,NativeError} from '../auth/native-tokens'
import {base64urlDecode,base64urlEncode,equalBytes,sign} from '../auth/tokens'

export type CopyHold={table:string;key:string;columns:string[]}
export type CopyScanOptions={secret:string;subject:string;continuation?:string;scope?:string}
type Checkpoint={scope:string;next:number;holds:CopyHold[];expires:number}
export class CopyScanPending extends Error {
 readonly continuation:string
 constructor(continuation:string){super('erasure_preview_pending');this.continuation=continuation}
}
const changed=()=>new NativeError('erasure_plan_changed',409)
/** Only monotonic custody metadata enters a checkpoint, never decoded source
 * text. These Base revisions cover plans/chunks, index, provenance and pages. */
export async function copySnapshot(db:D1Database):Promise<string>{
 const rows=(await db.prepare("SELECT j.id,c.revision FROM ik_jobs j LEFT JOIN ik_d1_custody_states c ON c.job_id=j.id WHERE j.destination='penny-feedback' ORDER BY j.id").all<{id:string;revision:number|null}>()).results
 if(rows.some(row=>row.revision===null))throw changed()
 return digest(JSON.stringify(rows))
}
const signed=(secret:string,body:string)=>sign(secret,'penny-erasure-copy-scan:'+body)
async function checkpoint(options:CopyScanOptions,scope:string):Promise<Checkpoint>{
 if(!options.continuation)return {scope,next:0,holds:[],expires:Date.now()+60*60*1000}
 const [body,signature,extra]=options.continuation.split('.')
 const bytes=base64urlDecode(signature??'')
 if(extra!==undefined||!body||!bytes||!equalBytes(bytes,await signed(options.secret,body)))throw changed()
 let value:Checkpoint
 try{value=JSON.parse(Buffer.from(body,'base64url').toString('utf8'))}catch{throw changed()}
 if(value.scope!==scope||value.expires<Date.now()||!Number.isSafeInteger(value.next)||value.next<0||!Array.isArray(value.holds))throw changed()
 return value
}
/** A signed, stateless continuation works across Worker isolates. Every request
 * rechecks the native scope and all import revisions, including unapplied jobs.
 * Each page is decoded and validated by the ordinary custody reader. */
export async function scanCopyPages(db:D1Database,jobs:string[],snapshot:string,context:unknown,read:(job:string)=>Promise<CopyHold[]>,options?:CopyScanOptions):Promise<CopyHold[]>{
 const scope=await digest(JSON.stringify([options?.subject,options?.scope,snapshot,jobs,context]))
 const saved=options?await checkpoint(options,scope):{scope,next:0,holds:[],expires:0}
 if(saved.next>jobs.length)throw changed()
 let end=jobs.length
 if(options){
  // Small retained jobs fit together; large compressed pages each get their
  // own request. The bound is based on stored custody bytes, not wall time.
  const candidates=jobs.slice(saved.next,saved.next+32)
  const sizes=(await db.prepare("SELECT id,COALESCE(json_extract(plan_json,'$.size'),length(CAST(plan_json AS BLOB))) bytes FROM ik_jobs WHERE id IN (SELECT value FROM json_each(?))").bind(JSON.stringify(candidates)).all<{id:string;bytes:number}>()).results
  const bytes=new Map(sizes.map(row=>[row.id,row.bytes]));let total=0;end=saved.next
  for(const job of candidates){const size=bytes.get(job);if(size===undefined)throw changed();if(end>saved.next&&total+size>64*1024)break;total+=size;end++}
 }
 for(let i=saved.next;i<end;i++)saved.holds.push(...await read(jobs[i]))
 if(await copySnapshot(db)!==snapshot)throw changed()
 if(end<jobs.length){
  const body=Buffer.from(JSON.stringify({...saved,next:end})).toString('base64url')
  throw new CopyScanPending(body+'.'+base64urlEncode(await signed(options!.secret,body)))
 }
 return saved.holds
}
