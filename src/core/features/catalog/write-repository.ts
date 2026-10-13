import type { DatabaseConnection } from '@/core/platform/database'

export interface TagWriteRecord {
  readonly id: string
  readonly name: string
}

export class CatalogWriteRepository {
  private readonly connection: DatabaseConnection

  constructor(connection: DatabaseConnection) {
    this.connection = connection
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
    await this.connection.binding.prepare('UPDATE tags SET name = ?, updated_at = ? WHERE id = ?').bind(name, now, id).run()
  }

  async mergeTags(sourceId: string, targetId: string, now: string): Promise<void> {
    await this.connection.binding.batch([
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
    await this.connection.binding.batch([
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
    await this.connection.binding.prepare('DELETE FROM evidence_tag_assignments WHERE evidence_id = ? AND tag_id = ?').bind(evidenceId, tagId).run()
  }

  async applyRequestTag(requestId: string, tagId: string, now: string): Promise<void> {
    await this.connection.binding.prepare('INSERT OR IGNORE INTO request_tag_assignments (request_id, tag_id, created_at) VALUES (?, ?, ?)').bind(requestId, tagId, now).run()
  }

  async removeRequestTag(requestId: string, tagId: string): Promise<void> {
    await this.connection.binding.prepare('DELETE FROM request_tag_assignments WHERE request_id = ? AND tag_id = ?').bind(requestId, tagId).run()
  }
}
