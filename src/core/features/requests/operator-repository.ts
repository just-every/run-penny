import { mergeRequesterIdentities } from './identity-merge'
import { moderateRequest, moderateComment, moderateAttachment } from './moderation-repository'
import { moderateRequestEdit, moderateCommentEdit } from './edit-moderation'
import type { DatabaseConnection } from '@/core/platform/database'
import { createRequestId } from './lifecycle-ids'
import { publishStatusUpdate } from './status-publication'
import { RequestLifecycleError } from './lifecycle-types'

export class RequestOperatorRepository {
  private readonly connection: DatabaseConnection

  constructor(connection: DatabaseConnection) {
    this.connection = connection
  }

  async moderateRequest(input: Parameters<typeof moderateRequest>[1]): Promise<void> {
    return moderateRequest(this.connection,input)
  }

  async moderateComment(input: Parameters<typeof moderateComment>[1]): Promise<void> {
    return moderateComment(this.connection,input)
  }

  async moderateCommentEdit(input: Parameters<typeof moderateCommentEdit>[1]): Promise<void> {
    return moderateCommentEdit(this.connection,input)
  }

  async moderateRequestEdit(input: Parameters<typeof moderateRequestEdit>[1]): Promise<void> {
    return moderateRequestEdit(this.connection,input)
  }

  async publishStatusUpdate(input: Parameters<typeof publishStatusUpdate>[1]): Promise<void> {
    return publishStatusUpdate(this.connection, input)
  }

  async reverseDecline(slug: string, operatorId: string, now: string): Promise<void> {
    const decline = await this.connection.binding.prepare(`
      SELECT update_row.id AS id, update_row.request_id AS requestId, update_row.previous_public_state AS previousState
      FROM request_status_updates update_row
      INNER JOIN requests request_row ON request_row.id = update_row.request_id
      WHERE request_row.slug = ? AND request_row.public_state='declined' AND update_row.public_status = 'declined' AND update_row.previous_public_state!='declined'
      ORDER BY update_row.published_at DESC, update_row.id DESC LIMIT 1
    `).bind(slug).first<{ id: string; requestId: string; previousState: string | null }>()
    if (!decline?.previousState) throw new RequestLifecycleError(409, 'decline_not_reversible', 'There is no active decline to reverse.')
    await this.connection.binding.batch([
      this.connection.binding.prepare(`UPDATE requests SET public_state = ?, declined_reason = NULL, updated_at = ? WHERE id = ?`).bind(decline.previousState, now, decline.requestId),
      this.connection.binding.prepare(`
        INSERT INTO audit_entries (id, actor_type, actor_id, action, entity_type, entity_id, occurred_at, details_json, created_at, updated_at)
        VALUES (?, 'operator', ?, 'request.decline_reversed', 'request', ?, ?, NULL, ?, ?)
      `).bind(createRequestId(), operatorId, decline.requestId, now, now, now),
    ])
  }

  async addNote(slug: string, operatorId: string, body: string, now: string): Promise<void> {
    const request = await this.findRequest(slug)
    if (!request) throw new RequestLifecycleError(404, 'not_found', 'The request does not exist.')
    await this.connection.binding.prepare(`
      INSERT INTO request_notes (id, request_id, operator_id, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(createRequestId(), request.id, operatorId, body, now, now).run()
  }

  async setRequesterBlocked(requesterId: string, blocked: boolean, operatorId: string, now: string): Promise<void> {
    const db=this.connection.binding
    const results=await db.batch([
      db.prepare(`UPDATE requesters SET blocked_at=?,updated_at=? WHERE id=? RETURNING 1 AS affected`).bind(blocked?now:null,now,requesterId),
      db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at)
        SELECT ?,'operator',?,?,'requester',?,?,?,? WHERE changes()>0`).bind(createRequestId(),operatorId,blocked?'requester.blocked':'requester.unblocked',requesterId,now,now,now),
    ])
    if(results[0].results.length!==1)throw new RequestLifecycleError(404,'not_found','The requester does not exist.')
  }

  async mergeRequesters(sourceRequesterId: string, targetRequesterId: string, operatorId: string, now: string): Promise<void> {
    return mergeRequesterIdentities(this.connection, sourceRequesterId, targetRequesterId, operatorId, now)
  }

  async moveRequest(slug: string, boardSlug: string, now: string, actorId:string): Promise<void> {
    const board = await this.findBoard(boardSlug)
    if (!board) throw new RequestLifecycleError(404, 'board_not_found', 'The board does not exist.')
    const db=this.connection.binding,result=await db.batch([
      db.prepare(`UPDATE requests SET board_id=?,updated_at=? WHERE slug=? RETURNING 1 AS affected`).bind(board.id,now,slug),
      db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) SELECT ?,'operator',?,'request.board_changed','request',id,?,?,? FROM requests WHERE slug=? AND changes()>0`).bind(createRequestId(),actorId,now,now,now,slug),
    ])
    if (result[0].results.length !== 1) throw new RequestLifecycleError(404, 'not_found', 'The request does not exist.')
  }

  async createBoard(input: { readonly slug: string; readonly name: string; readonly visibility: 'public' | 'internal'; readonly now: string }): Promise<void> {
    const position = await this.connection.binding.prepare(`SELECT COALESCE(MAX(position), -1) + 1 AS position FROM boards`).first<{ position: number }>()
    await this.connection.binding.prepare(`
      INSERT INTO boards (id, slug, name, visibility, position, archived_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
    `).bind(createRequestId(), input.slug, input.name, input.visibility, position?.position ?? 0, input.now, input.now).run()
  }

  async updateBoard(input: { readonly operatorId: string; readonly slug: string; readonly name?: string; readonly visibility?: 'public' | 'internal'; readonly position?: number; readonly archived?: boolean; readonly now: string }): Promise<void> {
    const db=this.connection.binding
    const result=await db.batch([
      db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at)
        SELECT ?,'operator',?,?,'board',id,?,?,? FROM boards WHERE slug=?`).bind(createRequestId(),input.operatorId,input.archived===true?'board.archived':'board.settings_updated',input.now,input.now,input.now,input.slug),
      db.prepare(`UPDATE boards SET name=COALESCE(?,name),visibility=COALESCE(?,visibility),position=COALESCE(?,position),
        archived_at=CASE WHEN ? IS NULL THEN archived_at WHEN ?=1 THEN ? ELSE NULL END,updated_at=? WHERE slug=? RETURNING 1 AS affected`)
        .bind(input.name??null,input.visibility??null,input.position??null,input.archived===undefined?null:1,input.archived?1:0,input.now,input.now,input.slug),
    ])
    if(result[1].results.length!==1)throw new RequestLifecycleError(404,'board_not_found','The board does not exist.')
  }

  async moderateAttachment(input: Parameters<typeof moderateAttachment>[1]): Promise<void> {
    return moderateAttachment(this.connection,input)
  }

  private async findBoard(slug: string): Promise<{ id: string } | null> {
    return this.connection.binding.prepare('SELECT id FROM boards WHERE slug = ? LIMIT 1').bind(slug).first<{ id: string }>()
  }

  private async findRequest(slug: string): Promise<{ id: string } | null> {
    return this.connection.binding.prepare('SELECT id FROM requests WHERE slug = ? LIMIT 1').bind(slug).first<{ id: string }>()
  }
}
