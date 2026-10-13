import type { DatabaseConnection } from '@/core/platform/database'
import { MutationError } from '@/core/app/operator-mutations'
import { createUlid } from '@/core/shared/ulid'
import { CatalogWriteRepository } from './write-repository'

export class CatalogWriteService {
  private readonly repository: CatalogWriteRepository

  constructor(database: DatabaseConnection) {
    this.repository = new CatalogWriteRepository(database)
  }

  async createTag(name: string, now = new Date().toISOString()): Promise<{ readonly id: string }> {
    if (await this.repository.hasTagName(name)) throw new MutationError(409, 'A tag with this name already exists.')
    const id = createUlid()
    await this.repository.createTag({ id, name }, now)
    return { id }
  }

  async renameTag(id: string, name: string, now = new Date().toISOString()): Promise<void> {
    await this.requireTag(id)
    if (await this.repository.hasTagName(name, id)) throw new MutationError(409, 'A tag with this name already exists.')
    await this.repository.renameTag(id, name, now)
  }

  async mergeTags(sourceId: string, targetId: string, now = new Date().toISOString()): Promise<void> {
    if (sourceId === targetId) throw new MutationError(422, 'A tag cannot merge into itself.')
    await Promise.all([this.requireTag(sourceId), this.requireTag(targetId)])
    await this.repository.mergeTags(sourceId, targetId, now)
  }

  async deleteTag(id: string): Promise<void> {
    await this.requireTag(id)
    await this.repository.deleteTag(id)
  }

  async applyEvidenceTag(evidenceId: string, tagId: string, now = new Date().toISOString()): Promise<void> {
    if (!await this.repository.hasEvidence(evidenceId)) throw new MutationError(404, 'Evidence item not found.')
    await this.requireTag(tagId)
    await this.repository.applyEvidenceTag(evidenceId, tagId, now)
  }

  async removeEvidenceTag(evidenceId: string, tagId: string): Promise<void> {
    if (!await this.repository.hasEvidence(evidenceId)) throw new MutationError(404, 'Evidence item not found.')
    await this.requireTag(tagId)
    await this.repository.removeEvidenceTag(evidenceId, tagId)
  }

  async applyRequestTag(requestId: string, tagId: string, now = new Date().toISOString()): Promise<void> {
    if (!await this.repository.hasRequest(requestId)) throw new MutationError(404, 'Request not found.')
    await this.requireTag(tagId)
    await this.repository.applyRequestTag(requestId, tagId, now)
  }

  async removeRequestTag(requestId: string, tagId: string): Promise<void> {
    if (!await this.repository.hasRequest(requestId)) throw new MutationError(404, 'Request not found.')
    await this.requireTag(tagId)
    await this.repository.removeRequestTag(requestId, tagId)
  }

  private async requireTag(id: string) {
    const tag = await this.repository.findTag(id)
    if (!tag) throw new MutationError(404, 'Tag not found.')
    return tag
  }
}

export function catalogWriteService(database: DatabaseConnection): CatalogWriteService {
  return new CatalogWriteService(database)
}
