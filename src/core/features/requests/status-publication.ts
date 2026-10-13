import type { DatabaseConnection } from '@/core/platform/database'
import { createRequestId } from './lifecycle-ids'
import { RequestLifecycleError } from './lifecycle-types'

export async function publishStatusUpdate(connection: DatabaseConnection, input: {
    readonly slug: string
    readonly operatorId: string
    readonly status: 'open' | 'under_review' | 'declined'
    readonly body: string
    readonly pinned: boolean
    readonly now: string
    readonly appOrigin?: string
    readonly idempotencyKey?: string
  }): Promise<void> {
    const request = await connection.binding.prepare(`
      SELECT id, public_title AS publicTitle, public_state AS publicState FROM requests
      WHERE slug = ? AND EXISTS(SELECT 1 FROM boards WHERE id=board_id AND visibility='public') AND moderation_state = 'approved' AND published_at IS NOT NULL AND withdrawn_at IS NULL AND merged_into_request_id IS NULL
      LIMIT 1
    `).bind(input.slug).first<{ id: string; publicTitle: string; publicState: string }>()
    if (!request) throw new RequestLifecycleError(404, 'not_found', 'The published request does not exist.')
    if (input.status === 'declined' && !input.body.trim()) throw new RequestLifecycleError(400, 'decline_reason_required', 'Declining a request requires a public reason.')
    const id = createRequestId()
    const nextState = input.status === 'declined' ? 'declined' : input.status
    const statements: D1PreparedStatement[] = [
      connection.binding.prepare(`
        INSERT INTO request_status_updates (id, request_id, public_status, previous_public_state, body, pinned, operator_id, published_at, created_at, updated_at, action_key, publication_version)
        SELECT ?,r.id,?,CASE WHEN ?='declined' THEN CASE WHEN r.public_state='declined' THEN
          (SELECT previous_public_state FROM request_status_updates WHERE request_id=r.id AND public_status='declined' AND previous_public_state!='declined' ORDER BY published_at DESC,id DESC LIMIT 1)
          ELSE r.public_state END ELSE NULL END,?,?,?,?,?,?,?,
          (SELECT COALESCE(MAX(publication_version),0)+1 FROM request_status_updates WHERE request_id=r.id)
        FROM requests r JOIN boards b ON b.id=r.board_id WHERE r.id=? AND b.visibility='public' AND r.moderation_state='approved' AND r.published_at IS NOT NULL AND r.withdrawn_at IS NULL AND r.merged_into_request_id IS NULL
        AND NOT EXISTS(SELECT 1 FROM request_status_updates WHERE request_id=r.id AND action_key=?)
        AND (? IS NOT NULL OR r.public_state!=? OR NOT EXISTS(
          SELECT 1 FROM request_status_updates WHERE id=(SELECT id FROM request_status_updates WHERE request_id=r.id
            ORDER BY COALESCE(publication_version,0) DESC,published_at DESC,id DESC LIMIT 1)
          AND public_status=? AND body=? AND pinned=?)) RETURNING 1 AS affected
      `).bind(id,input.status,input.status,input.body,input.pinned?1:0,input.operatorId,input.now,input.now,input.now,input.idempotencyKey??null,request.id,
        input.idempotencyKey??null,input.idempotencyKey??null,input.status,input.status,input.body,input.pinned?1:0),
      connection.binding.prepare(`
        UPDATE requests SET public_state = ?, declined_reason = CASE WHEN ? = 'declined' THEN ? ELSE declined_reason END, updated_at = ? WHERE id = ?
       AND EXISTS(SELECT 1 FROM request_status_updates WHERE id=?)`).bind(nextState, input.status, input.status === 'declined' ? input.body : null, input.now, request.id,id),
    ]
    // Read the winning action inside the write transaction. Concurrent retries
    // cannot both create a version, event or recipient intent.
    statements.push(connection.binding.prepare(`SELECT public_status AS status,body,pinned FROM request_status_updates
      WHERE request_id=? AND (? IS NULL OR action_key=?)
      ORDER BY COALESCE(publication_version,0) DESC,published_at DESC,id DESC LIMIT 1`)
      .bind(request.id,input.idempotencyKey??null,input.idempotencyKey??null))
    const results=await connection.binding.batch(statements)
    if(results[0].results.length!==0)return
    const previous=results.at(-1)?.results[0] as {status:string;body:string;pinned:number}|undefined
    if(previous?.status===input.status && previous.body===input.body && previous.pinned===(input.pinned?1:0))return
    if(input.idempotencyKey && previous)throw new RequestLifecycleError(409,'idempotency_conflict','This publication action was already used for different wording or status.')
    throw new RequestLifecycleError(404,'not_found','The published request changed before the update.')
  }
