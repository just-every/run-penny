import type { BlobStore } from '@/core/platform/blobs'
import type { DatabaseConnection } from '@/core/platform/database'
import { RequestLifecycleError } from './lifecycle-types'

export interface UploadRecord {
  id:string;request_id:string;storage_key:string;original_filename:string
  content_type:string;byte_size:number;sha256:string;created_at:string;updated_at:string
}
export async function fileDigest(bytes:ArrayBuffer):Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('')
}

export async function finishAttachment(database:DatabaseConnection,upload:UploadRecord):Promise<void> {
  const db=database.binding
  const results=await db.batch([
    db.prepare(`INSERT INTO attachments(id,request_id,evidence_id,storage_key,original_filename,content_type,byte_size,public_state,rejection_reason,created_at,updated_at)
      SELECT id,request_id,NULL,storage_key,original_filename,content_type,byte_size,'operator_only',NULL,created_at,updated_at
      FROM request_attachment_uploads WHERE id=? AND writing=0 ON CONFLICT(id) DO NOTHING`).bind(upload.id),
    db.prepare('DELETE FROM request_attachment_uploads WHERE id=? AND writing=0 AND EXISTS(SELECT 1 FROM attachments WHERE id=? AND storage_key=?) RETURNING 1 AS affected').bind(upload.id,upload.id,upload.storage_key),
  ])
  if(results[1].results.length!==1)throw new RequestLifecycleError(409,'upload_custody_changed','The upload could not be finalized from its reservation.')
}

export async function recoverAttachment(database:DatabaseConnection,blobs:BlobStore,id:string,original?:File):Promise<void> {
  const upload=await database.binding.prepare('SELECT * FROM request_attachment_uploads WHERE id=?').bind(id).first<UploadRecord>()
  if(!upload)throw new RequestLifecycleError(404,'upload_not_found','The pending upload does not exist.')
  if(original && (original.size!==upload.byte_size || await fileDigest(await original.arrayBuffer())!==upload.sha256))throw new RequestLifecycleError(409,'upload_bytes_mismatch','Choose the same original file that was reserved.')
  const claimed=await database.binding.prepare('UPDATE request_attachment_uploads SET writing=1 WHERE id=? AND writing=0 RETURNING 1 AS affected').bind(id).all()
  if(claimed.results.length!==1)throw new RequestLifecycleError(409,'attachment_writer_active','Wait for the original upload to finish, or stop its process before releasing its writer.')
  try {
  let object=await blobs.get(upload.storage_key)
  if(!object && original){
    // The existing reservation keeps the same id, filename, hash and custody.
    await blobs.put(upload.storage_key,original.stream(),upload.content_type)
    object=await blobs.get(upload.storage_key)
  }
  if(!object)throw new RequestLifecycleError(409,'upload_bytes_missing','The upload has no stored bytes. Reattach the original file.')
  if(object.size!==upload.byte_size || await fileDigest(await object.arrayBuffer())!==upload.sha256)throw new RequestLifecycleError(409,'upload_bytes_mismatch','The stored bytes do not match the reserved upload.')
  } finally {await releaseAttachmentWriter(database,id)}
  await finishAttachment(database,upload)
}

/** Release only after the storage promise settles. No lease or elapsed-time takeover. */
async function releaseAttachmentWriter(database:DatabaseConnection,id:string):Promise<void> {
  const released=await database.binding.prepare('UPDATE request_attachment_uploads SET writing=0 WHERE id=? AND writing=1 RETURNING 1 AS affected').bind(id).all()
  if(released.results.length!==1)throw new RequestLifecycleError(409,'upload_custody_changed','The upload writer no longer owns its reservation.')
}
export async function putReservedAttachment(database:DatabaseConnection,blobs:BlobStore,upload:UploadRecord,file:File):Promise<void> {
  try {await blobs.put(upload.storage_key,file.stream(),upload.content_type)}
  finally {await releaseAttachmentWriter(database,upload.id)}
}
/** Operator-only recovery after explicit confirmation that the old process stopped. */
export async function releaseInterruptedAttachmentWriter(database:DatabaseConnection,id:string):Promise<void> {
  await releaseAttachmentWriter(database,id)
}
