import {createUlid} from '@/core/shared/ulid'
import type { DatabaseConnection } from '@/core/platform/database'

export interface TagWriteRecord {
  readonly id: string
  readonly name: string
}

export class CatalogWriteRepository {
  private readonly connection: DatabaseConnection
  private readonly actorId: string

  constructor(connection: DatabaseConnection, actorId: string) {
    this.connection = connection
    this.actorId = actorId
  }

  async findTag(id: string): Promise<TagWriteRecord | null> {
    return this.connection.binding.prepare('SELECT id, name FROM tags WHERE id = ? LIMIT 1').bind(id).first<TagWriteRecord>()
  }

  async hasTagName(name: string, exceptId?: string): Promise<boolean> {
    const statement = exceptId
      ? this.connection.binding.prepare('SELECT 1 AS present FROM tags WHERE LOWER(name) = LOWER(?) AND id != ? LIMIT 1').bind(name, exceptId)
      : this.connection.binding.prepare('SELECT 1 AS present FROM tags WHERE LOWER(name) = LOWER(?) LIMIT 1').bind(name)
    return (await statement.first()) !== null
  }

  async createTag(record: TagWriteRecord, now: string): Promise<void> {
    await this.connection.binding.prepare('INSERT INTO tags (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').bind(record.id, record.name, now, now).run()
  }

  async renameTag(id: string, name: string, now: string): Promise<void> {
    await this.connection.binding.batch([this.assert('EXISTS(SELECT 1 FROM tags WHERE id=?)',[id]),this.audit('tag.renamed','tag',id,now,'EXISTS(SELECT 1 FROM tags WHERE id=?)',[id]),this.connection.binding.prepare('UPDATE tags SET name = ?, updated_at = ? WHERE id = ?').bind(name, now, id)])
  }

  async mergeTags(sourceId: string, targetId: string, now: string): Promise<void> {
    await this.connection.binding.batch([
      this.assert('EXISTS(SELECT 1 FROM tags WHERE id=?) AND EXISTS(SELECT 1 FROM tags WHERE id=?)',[sourceId,targetId]),
      this.audit('tag.merged','tag',sourceId,now,'EXISTS(SELECT 1 FROM tags WHERE id=?) AND EXISTS(SELECT 1 FROM tags WHERE id=?)',[sourceId,targetId],JSON.stringify({targetId})),
      this.connection.binding.prepare(`
        INSERT OR IGNORE INTO evidence_tag_assignments (evidence_id, tag_id, created_at)
        SELECT evidence_id, ?, ? FROM evidence_tag_assignments WHERE tag_id = ?
      `).bind(targetId, now, sourceId),
      this.connection.binding.prepare(`
        INSERT OR IGNORE INTO request_tag_assignments (request_id, tag_id, created_at)
        SELECT request_id, ?, ? FROM request_tag_assignments WHERE tag_id = ?
      `).bind(targetId, now, sourceId),
      this.connection.binding.prepare('DELETE FROM evidence_tag_assignments WHERE tag_id = ?').bind(sourceId),
      this.connection.binding.prepare('DELETE FROM request_tag_assignments WHERE tag_id = ?').bind(sourceId),
      this.connection.binding.prepare('DELETE FROM tags WHERE id = ?').bind(sourceId),
    ])
  }

  async deleteTag(id: string): Promise<void> {
    const now=new Date().toISOString()
    await this.connection.binding.batch([
      this.assert('EXISTS(SELECT 1 FROM tags WHERE id=?)',[id]),
      this.audit('tag.deleted','tag',id,now,'EXISTS(SELECT 1 FROM tags WHERE id=?)',[id]),
      this.connection.binding.prepare('DELETE FROM evidence_tag_assignments WHERE tag_id = ?').bind(id),
      this.connection.binding.prepare('DELETE FROM request_tag_assignments WHERE tag_id = ?').bind(id),
      this.connection.binding.prepare('DELETE FROM tags WHERE id = ?').bind(id),
    ])
  }

  async hasEvidence(id: string): Promise<boolean> {
    return (await this.connection.binding.prepare('SELECT 1 AS present FROM evidence_items WHERE id = ? LIMIT 1').bind(id).first()) !== null
  }

  async hasRequest(id: string): Promise<boolean> {
    return (await this.connection.binding.prepare('SELECT 1 AS present FROM requests WHERE id = ? LIMIT 1').bind(id).first()) !== null
  }

  async applyEvidenceTag(evidenceId: string, tagId: string, now: string): Promise<void> {
    await this.connection.binding.prepare('INSERT OR IGNORE INTO evidence_tag_assignments (evidence_id, tag_id, created_at) VALUES (?, ?, ?)').bind(evidenceId, tagId, now).run()
  }

  async removeEvidenceTag(evidenceId: string, tagId: string): Promise<void> {
    const db=this.connection.binding,now=new Date().toISOString()
    await db.batch([this.audit('tag.detached','evidence',evidenceId,now,'EXISTS(SELECT 1 FROM evidence_tag_assignments WHERE evidence_id=? AND tag_id=?)',[evidenceId,tagId],JSON.stringify({tagId})),db.prepare('DELETE FROM evidence_tag_assignments WHERE evidence_id = ? AND tag_id = ?').bind(evidenceId, tagId)])
  }

  async applyRequestTag(requestId: string, tagId: string, now: string): Promise<void> {
    await this.connection.binding.prepare('INSERT OR IGNORE INTO request_tag_assignments (request_id, tag_id, created_at) VALUES (?, ?, ?)').bind(requestId, tagId, now).run()
  }

  async removeRequestTag(requestId: string, tagId: string): Promise<void> {
    const db=this.connection.binding,now=new Date().toISOString()
    await db.batch([this.audit('tag.detached','request',requestId,now,'EXISTS(SELECT 1 FROM request_tag_assignments WHERE request_id=? AND tag_id=?)',[requestId,tagId],JSON.stringify({tagId})),db.prepare('DELETE FROM request_tag_assignments WHERE request_id = ? AND tag_id = ?').bind(requestId, tagId)])
  }
  private assert(predicate:string,values:string[]) {
    // The existing transient authority check rejects false and rolls back D1's batch.
    return this.connection.binding.prepare(`INSERT INTO penny_integration_guards(id,allowed) SELECT ?,0 WHERE NOT (${predicate})`).bind(createUlid(),...values)
  }

  private audit(action:string,entity:string,id:string,now:string,predicate:string,values:string[],details:string|null=null) {
    return this.connection.binding.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,details_json,created_at,updated_at)
      SELECT ?,'operator',?,?,?,?,?,?,?,? WHERE ${predicate}`).bind(createUlid(),this.actorId,action,entity,id,now,details,now,now,...values)
  }

}
