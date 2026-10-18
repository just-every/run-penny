import {NativeError} from '../auth/native-tokens'
/** Every object must have exactly one native owner before an export starts.
 * The archive's staged checks separately bind sizes, types and original hashes. */
export async function assertOriginalFiles(db:D1Database,bucket:R2Bucket){
 const rows=await db.prepare('SELECT storage_key FROM attachments UNION ALL SELECT storage_key FROM release_attachments').all<{storage_key:string}>()
 const keys=new Set(rows.results.map(row=>row.storage_key)),seen=new Set<string>()
 if(keys.size!==rows.results.length)throw new NativeError('duplicate_attachment_reference',503)
 let cursor:string|undefined
 do{
  const page=await bucket.list({limit:1000,...(cursor?{cursor}:{})})
  for(const object of page.objects){
   if(!keys.has(object.key))throw new NativeError('untracked_attachment_objects',503)
   seen.add(object.key)
  }
  cursor=page.truncated?page.cursor:undefined
 }while(cursor)
 if(seen.size!==keys.size)throw new NativeError('missing_attachment',503)
}
