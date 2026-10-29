import seed from '../../../../seed.json'
import type { BlobStore } from '@/core/platform/blobs'
import { MutationError } from '@/core/app/operator-mutations'
import { createUlid } from '@/core/shared/ulid'
import { fileDigest } from '../requests/attachment-upload'
import { exists } from '../decisions/write-support'
interface Upload {id:string;evidence_id:string;storage_key:string;original_filename:string;content_type:string;byte_size:number;sha256:string;writing:number}
export async function listEvidenceAttachments(db:D1Database,id:string){
 await exists(db,'evidence_items',id)
 const [files,uploads]=await Promise.all([
 db.prepare('SELECT id,original_filename AS filename,content_type AS contentType,byte_size AS byteSize FROM attachments WHERE evidence_id=? ORDER BY created_at,id').bind(id).all(),
 db.prepare('SELECT id,original_filename AS filename,writing FROM evidence_attachment_uploads WHERE evidence_id=? ORDER BY created_at,id').bind(id).all(),
 ])
 return {files:files.results,uploads:uploads.results}
}
export async function uploadEvidenceAttachment(db:D1Database,raw:D1Database,blobs:BlobStore,id:string,file:File,now:string,stableId?:string){
 await exists(db,'evidence_items',id)
 if(!seed.limits.uploadTypes.includes(file.type)||!file.size||file.size>seed.limits.uploadBytesPerFile||file.name.length>255)throw new MutationError(400,'The file does not meet the attachment limits.')
 const uploadId=stableId??createUlid(),key=`evidence/${id}/${uploadId}`,hash=await fileDigest(await file.arrayBuffer())
 const reserved=await db.prepare(`INSERT INTO evidence_attachment_uploads(id,evidence_id,storage_key,original_filename,content_type,byte_size,sha256,writing,created_at,updated_at)
 SELECT ?,?,?,?,?,?,?,1,?,? WHERE COALESCE((SELECT SUM(byte_size) FROM attachments WHERE evidence_id=?),0)+COALESCE((SELECT SUM(byte_size) FROM evidence_attachment_uploads WHERE evidence_id=?),0)+?<=? RETURNING 1 AS affected`).bind(uploadId,id,key,file.name,file.type,file.size,hash,now,now,id,id,file.size,seed.limits.uploadBytesPerRequest).all()
 if(reserved.results.length!==1)throw new MutationError(400,'The evidence attachment total exceeds the upload limit.')
 try{await blobs.put(key,file.stream(),file.type)}finally{await releaseWriter(raw,uploadId)}
 await finish(db,uploadId)
 return {id:uploadId}
}
async function releaseWriter(raw:D1Database,id:string){
 const result=await raw.prepare('UPDATE evidence_attachment_uploads SET writing=0 WHERE id=? AND writing=1 RETURNING 1 AS affected').bind(id).all()
 if(result.results.length!==1)throw new MutationError(409,'The upload reservation changed.')
}
async function finish(db:D1Database,id:string){
 const result=await db.batch([
 db.prepare(`INSERT INTO attachments(id,request_id,evidence_id,storage_key,original_filename,content_type,byte_size,public_state,created_at,updated_at)
 SELECT id,NULL,evidence_id,storage_key,original_filename,content_type,byte_size,'operator_only',created_at,updated_at FROM evidence_attachment_uploads WHERE id=? AND writing=0 ON CONFLICT(id) DO NOTHING`).bind(id),
 db.prepare('DELETE FROM evidence_attachment_uploads WHERE id=? AND writing=0 AND EXISTS(SELECT 1 FROM attachments a WHERE a.id=evidence_attachment_uploads.id AND a.storage_key=evidence_attachment_uploads.storage_key) RETURNING 1 AS affected').bind(id),
 ])
 if(result[1].results.length!==1)throw new MutationError(409,'The upload could not be finalized. Refresh pending uploads.')
}
export async function recoverEvidenceAttachment(db:D1Database,raw:D1Database,blobs:BlobStore,id:string,original?:File){
 const upload=await db.prepare('SELECT * FROM evidence_attachment_uploads WHERE id=?').bind(id).first<Upload>()
 if(!upload)throw new MutationError(404,'Pending upload not found.')
 if(original&&(original.size!==upload.byte_size||await fileDigest(await original.arrayBuffer())!==upload.sha256))throw new MutationError(409,'Choose the reserved original file.')
 const claimed=await db.prepare('UPDATE evidence_attachment_uploads SET writing=1 WHERE id=? AND writing=0 RETURNING 1 AS affected').bind(id).all()
 if(claimed.results.length!==1)throw new MutationError(409,'The attachment writer is still active.')
 try{
  let object=await blobs.get(upload.storage_key)
  if(!object&&original){await blobs.put(upload.storage_key,original.stream(),upload.content_type);object=await blobs.get(upload.storage_key)}
  if(!object)throw new MutationError(409,'Stored bytes are missing. Reattach the original file.')
  if(object.size!==upload.byte_size||await fileDigest(await object.arrayBuffer())!==upload.sha256)throw new MutationError(409,'Stored bytes do not match the original upload.')
 }finally{await releaseWriter(raw,id)}
 await finish(db,id)
 return {id}
}
export async function releaseEvidenceWriter(db:D1Database,id:string){await releaseWriter(db,id)}
export async function evidenceAttachmentResponse(db:D1Database,blobs:BlobStore,id:string){
 const file=await db.prepare('SELECT storage_key,content_type,original_filename FROM attachments WHERE id=? AND evidence_id IS NOT NULL AND request_id IS NULL').bind(id).first<{storage_key:string;content_type:string;original_filename:string}>()
 if(!file)throw new MutationError(404,'Attachment not found.')
 const object=await blobs.get(file.storage_key)
 if(!object)throw new MutationError(404,'Attachment bytes not found.')
 return new Response(object.body,{headers:{'Content-Type':file.content_type,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.original_filename)}`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})
}
