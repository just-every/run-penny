import { publicationGuard } from './publication-policy'
import { audit } from '../decisions/write-support'
import seed from '../../../../seed.json'
import type { BlobStore } from '@/core/platform/blobs'
import { MutationError } from '@/core/app/operator-mutations'
import { createUlid } from '@/core/shared/ulid'
import { fileDigest } from '../requests/attachment-upload'
import { releaseImagePath } from './rich-content'
interface ReleaseFile {id:string;release_id:string;storage_key:string;original_filename:string;content_type:string;byte_size:number;sha256:string;state:string;approved_at:string|null}
async function releaseId(db:D1Database,slug:string){
 const row=await db.prepare('SELECT id FROM releases WHERE slug=?').bind(slug).first<{id:string}>()
 if(!row)throw new MutationError(404,'Release not found.')
 return row.id
}
function imageType(bytes:Uint8Array):string|null {
 const starts=(values:number[])=>values.every((v,i)=>bytes[i]===v)
 if(starts([137,80,78,71,13,10,26,10]))return 'image/png'
 if(starts([255,216,255]))return 'image/jpeg'
 const text=new TextDecoder('ascii').decode(bytes.slice(0,12))
 if(text.startsWith('GIF87a')||text.startsWith('GIF89a'))return 'image/gif'
 if(text.startsWith('RIFF')&&text.slice(8)==='WEBP')return 'image/webp'
 return null
}
export async function listReleaseAttachments(db:D1Database,slug:string){
 const id=await releaseId(db,slug)
 const rows=await db.prepare('SELECT id,original_filename AS filename,state FROM release_attachments WHERE release_id=? ORDER BY created_at,id').bind(id).all<{id:string;filename:string;state:string}>()
 return rows.results.map(row=>({...row,url:releaseImagePath(slug,row.id)}))
}
export async function uploadReleaseAttachment(db:D1Database,raw:D1Database,blobs:BlobStore,slug:string,file:File){
 const rid=await releaseId(db,slug)
 if(!file.size||file.size>seed.limits.uploadBytesPerFile||file.name.length>255)throw new MutationError(400,'The image exceeds the attachment limits.')
 const bytes=await file.arrayBuffer(),type=imageType(new Uint8Array(bytes))
 if(!type||type!==file.type||!seed.limits.uploadTypes.includes(type))throw new MutationError(400,'Choose a supported image with matching file contents.')
 const id=createUlid(),key=`releases/${rid}/${id}`,now=new Date().toISOString(),hash=await fileDigest(bytes)
 const reserved=await db.prepare(`INSERT INTO release_attachments(id,release_id,storage_key,original_filename,content_type,byte_size,sha256,state,created_at,updated_at)
 SELECT ?,?,?,?,?,?,?,'writing',?,? WHERE COALESCE((SELECT SUM(byte_size) FROM release_attachments WHERE release_id=?),0)+?<=? RETURNING id`).bind(id,rid,key,file.name,type,file.size,hash,now,now,rid,file.size,seed.limits.uploadBytesPerRequest).all()
 if(!reserved.results.length)throw new MutationError(400,'The release attachment total exceeds the limit.')
 try{await blobs.put(key,bytes,type)}finally{await finishWriter(raw,id)}
 return {id,url:releaseImagePath(slug,id)}
}
export async function approveReleaseAttachment(db:D1Database,blobs:BlobStore,slug:string,id:string,actor:string){
 const rid=await releaseId(db,slug),row=await db.prepare('SELECT * FROM release_attachments WHERE id=? AND release_id=?').bind(id,rid).first<ReleaseFile>()
 if(!row)throw new MutationError(404,'Release attachment not found.')
 if(row.state==='writing')throw new MutationError(409,'The image writer is active. Stop the original upload before recovering it.')
 if(row.state==='approved')return {id,url:releaseImagePath(slug,id)}
 const object=await blobs.get(row.storage_key)
 if(!object||object.size!==row.byte_size||await fileDigest(await object.arrayBuffer())!==row.sha256)throw new MutationError(409,'The original image bytes are missing or changed. Approval refused.')
 const now=new Date().toISOString(),guard=createUlid()
 try{await db.batch([publicationGuard(db,guard,"EXISTS(SELECT 1 FROM release_attachments WHERE id=? AND release_id=? AND state='pending')",[id,rid]),db.prepare("UPDATE release_attachments SET state='approved',approved_at=?,updated_at=? WHERE id=? AND release_id=? AND state='pending'").bind(now,now,id,rid),audit(db,actor,'release_attachment',id,'release.image_approved',now),db.prepare('DELETE FROM requester_write_guards WHERE id=?').bind(guard)])}catch(error){if(String(error).includes('requester_write_admitted'))throw new MutationError(409,'The image upload changed. Refresh before approval.');throw error}
 return {id,url:releaseImagePath(slug,id)}
}
export async function releaseAttachmentResponse(db:D1Database,blobs:BlobStore,slug:string,id:string){
 const row=await db.prepare(`SELECT a.* FROM release_attachments a JOIN releases r ON r.id=a.release_id WHERE r.slug=? AND a.id=? AND a.state='approved' AND r.state='published' AND r.published_at IS NOT NULL AND EXISTS(SELECT 1 FROM release_versions v WHERE v.release_id=r.id AND v.snapshot_sealed_at IS NOT NULL AND instr(v.body,?)>0)`).bind(slug,id,releaseImagePath(slug,id)).first<ReleaseFile>()
 if(!row)throw new MutationError(404,'Published image not found.')
 const object=await blobs.get(row.storage_key)
 if(!object)throw new MutationError(404,'Published image bytes not found.')
 return new Response(object.body,{headers:{'Content-Type':row.content_type,'Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(row.original_filename)}`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}})
}

async function finishWriter(raw:D1Database,id:string){
 await raw.prepare("UPDATE release_attachments SET state='pending',updated_at=? WHERE id=? AND state='writing'").bind(new Date().toISOString(),id).run()
}
export async function recoverReleaseImage(db:D1Database,raw:D1Database,blobs:BlobStore,slug:string,id:string,file:File,writerStopped:boolean){
 const rid=await releaseId(db,slug),row=await db.prepare('SELECT * FROM release_attachments WHERE id=? AND release_id=?').bind(id,rid).first<ReleaseFile>()
 if(!row)throw new MutationError(404,'Release image not found.')
 if(row.state==='approved')throw new MutationError(409,'An approved image cannot be replaced.')
 if(row.state==='writing'&&!writerStopped)throw new MutationError(409,'Confirm the original upload process has stopped before recovery.')
 if(file.size!==row.byte_size||await fileDigest(await file.arrayBuffer())!==row.sha256)throw new MutationError(409,'Choose the same original image. Bytes cannot be replaced.')
 const claimed=await db.prepare("UPDATE release_attachments SET state='writing' WHERE id=? AND state=? RETURNING id").bind(id,row.state).all()
 if(!claimed.results.length)throw new MutationError(409,'The upload state changed. Refresh before recovery.')
 try{await blobs.put(row.storage_key,await file.arrayBuffer(),row.content_type)}finally{await finishWriter(raw,id)}
 return {id}
}
