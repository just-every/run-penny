import seed from '../../../../seed.json'
import { requesterAdmission, ownRequestAdmission } from './write-admission'
import { fileDigest,finishAttachment,putReservedAttachment,type UploadRecord } from './attachment-upload'
import type { BlobStore } from '@/core/platform/blobs'
import type { DatabaseConnection } from '@/core/platform/database'
import { createRequestId } from './lifecycle-ids'
import type { RequesterReference } from './lifecycle-types'
import { RequestLifecycleError } from './lifecycle-types'

const allowedContentTypes = new Set(['image/png', 'image/jpeg', 'image/gif', 'application/pdf'])
const maximumFileBytes = 10 * 1024 * 1024
// Finished files and outstanding reservations both count, so concurrent uploads cannot overbook a request.
const requestBytesFit = 'COALESCE((SELECT SUM(byte_size) FROM attachments WHERE request_id=?),0)+COALESCE((SELECT SUM(byte_size) FROM request_attachment_uploads WHERE request_id=?),0)+?<=?'

export class RequestAttachmentService {
  private readonly database: DatabaseConnection
  private readonly blobs: BlobStore

  constructor(database: DatabaseConnection, blobs: BlobStore) {
    this.database = database
    this.blobs = blobs
  }

  async upload(identity: RequesterReference, slug: string, file: File, now: string): Promise<{ readonly id: string }> {
    if (!allowedContentTypes.has(file.type) || file.size > maximumFileBytes || file.size === 0 || file.name.length > 255) {
      throw new RequestLifecycleError(400, 'attachment_invalid', 'The attachment does not meet the portal file limits.')
    }
    const request = await this.database.binding.prepare(`
      SELECT id FROM requests WHERE slug = ? AND author_requester_id = ? AND withdrawn_at IS NULL AND merged_into_request_id IS NULL LIMIT 1
    `).bind(slug, identity.requesterId).first<{ id: string }>()
    if (!request) throw new RequestLifecycleError(404, 'not_found', 'The requester-owned request does not exist.')
    const id = createRequestId()
    const key = `requests/${request.id}/${id}`
    const upload:UploadRecord={id,request_id:request.id,storage_key:key,original_filename:file.name,content_type:file.type,byte_size:file.size,sha256:await fileDigest(await file.arrayBuffer()),created_at:now,updated_at:now}
    const actor=requesterAdmission(identity)
    const total=[request.id,request.id,file.size,seed.limits.uploadBytesPerRequest]
    const reserved=await this.database.binding.prepare(`INSERT INTO request_attachment_uploads(id,request_id,storage_key,original_filename,content_type,byte_size,sha256,created_at,updated_at,writing) SELECT ?,?,?,?,?,?,?,?,?,1 WHERE ${actor.sql} AND ${ownRequestAdmission} AND ${requestBytesFit} RETURNING 1 AS affected`)
      .bind(id,request.id,key,file.name,file.type,file.size,upload.sha256,now,now,...actor.values,request.id,identity.requesterId,...total).all()
    if(reserved.results.length!==1){
      if(!await this.database.binding.prepare(`SELECT ${requestBytesFit} AS fits`).bind(...total).first('fits'))throw new RequestLifecycleError(400, 'attachment_invalid', 'The attachment does not meet the portal file limits.')
      throw new RequestLifecycleError(409,'requester_action_changed','Your identity or request changed. Refresh before uploading.')
    }
    // Keep the durable reservation and bytes when either service's outcome is
    // uncertain. Operators can verify and finish it through the recovery route.
    await putReservedAttachment(this.database,this.blobs,upload,file)
    try {
      await finishAttachment(this.database,upload)
    } catch (error) {
      const committed=await this.database.binding.prepare('SELECT id FROM attachments WHERE id=? AND storage_key=?').bind(id,key).first()
      if(!committed)throw error
    }

    return { id }
  }

  async publicResponse(id: string): Promise<Response | null> {
    const attachment = await this.database.binding.prepare(`
      SELECT attachment.storage_key AS storageKey, attachment.content_type AS contentType, attachment.original_filename AS filename
      FROM attachments attachment
      INNER JOIN requests r ON r.id = attachment.request_id
      INNER JOIN boards b ON b.id = r.board_id
      LEFT JOIN requesters requester ON requester.id = r.author_requester_id
      WHERE attachment.id = ? AND attachment.public_state = 'published'
        AND r.moderation_state = 'approved' AND r.published_at IS NOT NULL
        AND r.withdrawn_at IS NULL AND r.merged_into_request_id IS NULL AND r.public_state != 'unpublished'
        AND b.visibility = 'public' AND (requester.id IS NULL OR requester.blocked_at IS NULL)
      LIMIT 1
    `).bind(id).first<{ storageKey: string; contentType: string; filename: string }>()
    if (!attachment) return null
    const object = await this.blobs.get(attachment.storageKey)
    if (!object) return null
    const disposition = attachment.contentType.startsWith('image/')
      ? `inline; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`
      : `attachment; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`
    return new Response(object.body, { headers: { 'Content-Type': attachment.contentType, 'Content-Disposition': disposition, 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' } })
  }
}
