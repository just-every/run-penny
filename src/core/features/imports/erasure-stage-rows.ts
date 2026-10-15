import {Buffer} from 'node:buffer'
import type {D1ImportContext,D1Sql} from '../../../../base/modules/import-kit/src/d1/types'
import {NATIVE_STAGE_ROWS_BYTES,nativeRowStatements} from '../../../../base/modules/import-kit/src/d1/native-staging-rows'
import {nativeStageAtomic,type NativeStageBinding} from '../../../../base/modules/import-kit/src/d1/native-staging-state'

type Target={context:D1ImportContext;stage:NativeStageBinding;baseline:D1Sql[];table:'index'|'values';columns:string[];progress:{writes:number}}
/** Base's NativeStageRows appends from an empty stage within one request. A
 * resumed stage continues after the rows an earlier request already verified:
 * each flush still runs Base's guarded insert and exact readback. */
export class ResumedStageRows {
 revision:number
 private target:Target;private written:number;private rows:string[]=[];private bytes=2;private seen=0
 constructor(target:Target,written:number,revision:number){this.target=target;this.written=written;this.revision=revision}
 /** Rows arrive in their deterministic order; already staged ones are skipped. */
 async append(row:unknown[]):Promise<void>{
  if(this.seen++<this.written)return
  const text=JSON.stringify(row),bytes=Buffer.byteLength(text)+1
  if(bytes+2>NATIVE_STAGE_ROWS_BYTES)throw new Error('IMPORT_D1_TRANSPORT_LIMIT')
  if(this.rows.length&&this.bytes+bytes>NATIVE_STAGE_ROWS_BYTES)await this.flush()
  this.rows.push(text);this.bytes+=bytes
 }
 async flush():Promise<void>{
  if(!this.rows.length)return
  const {context,stage,baseline,table,columns}=this.target,body='['+this.rows.join(',')+']',count=this.rows.length
  const result=await nativeStageAtomic(context,stage.action,nativeRowStatements(stage,baseline,table,columns,body,count,this.written,this.revision)),read=result[result.length-4] as {results?:Record<string,unknown>[]}|Record<string,unknown>[]
  const rows=Array.isArray(read)?read:read?.results,expected=JSON.parse(body) as unknown[][]
  if(!Array.isArray(rows)||rows.length!==count||rows.some((row,i)=>columns.some((column,j)=>row[column]!==expected[i][j])))throw new Error('IMPORT_NATIVE_STAGE_CONTENT_CHANGED')
  this.rows=[];this.bytes=2;this.revision+=count;this.written+=count;this.target.progress.writes++
 }
}
