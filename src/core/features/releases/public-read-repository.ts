import type { PublicRelease } from '@/core/shared/api/public'
import type { DatabaseConnection } from '@/core/platform/database'

export type CurrentPublicRelease=PublicRelease & {versionNumber:number;isCurrent:true}

export class PublicReleasesReadRepository {
  private readonly connection: DatabaseConnection

  constructor(connection: DatabaseConnection) {
    this.connection = connection
  }

  async list(): Promise<readonly CurrentPublicRelease[]> {
    const result = await this.connection.binding.prepare(`
      SELECT r.slug AS slug, rv.version_number AS versionNumber, rv.title AS title, rv.release_type AS releaseType, rv.body AS body,
        rv.publication_date AS publicationDate, rv.setup_url AS setupUrl, rv.author_name AS authorName
      FROM releases r
      INNER JOIN release_versions rv ON rv.id = r.current_version_id AND rv.is_portal_current = 1
      WHERE r.state = 'published' AND r.published_at IS NOT NULL AND rv.publication_date IS NOT NULL
      ORDER BY rv.publication_date DESC, r.slug ASC
    `).all<Omit<CurrentPublicRelease,'isCurrent'>>()
    return result.results.map(row=>({...row,isCurrent:true as const}))
  }

  async find(slug: string): Promise<CurrentPublicRelease | null> {
    const result = await this.connection.binding.prepare(`
      SELECT r.slug AS slug, rv.version_number AS versionNumber, rv.title AS title, rv.release_type AS releaseType, rv.body AS body,
        rv.publication_date AS publicationDate, rv.setup_url AS setupUrl, rv.author_name AS authorName
      FROM releases r
      INNER JOIN release_versions rv ON rv.id = r.current_version_id AND rv.is_portal_current = 1
      WHERE r.slug = ? AND r.state = 'published' AND r.published_at IS NOT NULL AND rv.publication_date IS NOT NULL
      LIMIT 1
    `).bind(slug).all<Omit<CurrentPublicRelease,'isCurrent'>>()
    const row=result.results[0];return row?{...row,isCurrent:true}:null
  }
}
