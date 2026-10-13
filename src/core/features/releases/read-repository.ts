import { boundedIds } from '@/core/features/workspace/list-query'
import { releaseDeliveryCounts } from './counts'
import type { OperatorReleaseCard, OperatorReleaseDetail } from '@/core/shared/api/operator'
import type { DatabaseConnection } from '@/core/platform/database'
import { parseTagNamesJson } from '@/core/shared/tag-names'

export class ReleasesReadRepository {
  private readonly connection: DatabaseConnection

  constructor(connection: DatabaseConnection) {
    this.connection = connection
  }

  async list(ids?: readonly string[]): Promise<readonly OperatorReleaseCard[]> {
    const result = await this.connection.binding.prepare(`
      SELECT
        r.id AS id, r.slug AS slug, r.state AS state, rv.title AS title, rv.release_type AS releaseType,
        rv.publication_date AS publicationDate, r.published_at AS publishedAt,
        author.id AS authorId, CASE WHEN rv.snapshot_sealed_at IS NOT NULL THEN rv.author_name ELSE author.display_name END AS authorName,
        CASE WHEN rv.snapshot_sealed_at IS NOT NULL THEN rv.tag_names_json ELSE (
          SELECT COALESCE(json_group_array(tag.name), '[]')
          FROM tags tag
          INNER JOIN json_each(rv.subject_tags_json) subject ON subject.value = tag.id
        ) END AS tagNamesJson,
        CASE WHEN r.state = 'published' THEN (SELECT COUNT(*) FROM release_recipient_snapshots rrs WHERE rrs.release_version_id = COALESCE(rv.original_publication_version_id,rv.id)) ELSE NULL END AS recipientSnapshotCount,
        CASE WHEN r.state = 'published' THEN (
          SELECT COUNT(*)
          FROM release_outcomes outcome
          WHERE outcome.release_version_id = COALESCE(rv.original_publication_version_id,rv.id)
            AND outcome.revision_number = (
              SELECT MAX(current_outcome.revision_number)
              FROM release_outcomes current_outcome
              WHERE current_outcome.release_version_id = outcome.release_version_id
                AND current_outcome.requester_id = outcome.requester_id
                AND current_outcome.roadmap_item_id = outcome.roadmap_item_id
            )
        ) ELSE NULL END AS outcomeTotal
      FROM releases r
      INNER JOIN release_versions rv ON rv.id = r.current_version_id
      INNER JOIN operators author ON author.id = r.author_operator_id
      ${boundedIds('r', ids)}
      ORDER BY COALESCE(rv.publication_date, r.created_at) DESC, r.slug ASC
      LIMIT 25
    `).bind(...(ids ?? [])).all<{
      readonly id: string; readonly slug: string; readonly state: OperatorReleaseCard['state']; readonly title: string; readonly releaseType: OperatorReleaseCard['releaseType']
      readonly publicationDate: string | null; readonly publishedAt: string | null; readonly authorId: string; readonly authorName: string; readonly tagNamesJson: string; readonly recipientSnapshotCount: number | null; readonly outcomeTotal: number | null
    }>()
    return result.results.map((row) => ({
      id: row.id, slug: row.slug, state: row.state, title: row.title, releaseType: row.releaseType, publicationDate: row.publicationDate, publishedAt: row.publishedAt,
      author: { id: row.authorId, displayName: row.authorName }, tagNames: parseTagNamesJson(row.tagNamesJson),
      recipientSnapshotCount: row.recipientSnapshotCount === null ? null : Number(row.recipientSnapshotCount),
      outcomeTotal: row.outcomeTotal === null ? null : Number(row.outcomeTotal),
    }))
  }

  async find(slug: string): Promise<OperatorReleaseDetail | null> {
    const record = await this.connection.binding.prepare('SELECT id FROM releases WHERE slug=? LIMIT 1').bind(slug).first<{id:string}>()
    const release = record ? (await this.list([record.id]))[0] : undefined
    if (!release) return null
    const version = await this.connection.binding.prepare(`
      SELECT rv.id AS versionId,rv.subject_tags_json AS tagIdsJson, rv.body AS body, rv.setup_url AS setupUrl, rv.outcome_prompt AS outcomePrompt
      FROM releases r INNER JOIN release_versions rv ON rv.id = r.current_version_id WHERE r.slug = ? LIMIT 1
    `).bind(slug).all<{ readonly versionId: string; readonly tagIdsJson:string; readonly body: string; readonly setupUrl: string | null; readonly outcomePrompt: string }>()
    const targets = await this.connection.binding.prepare(`
      SELECT ri.slug AS roadmapSlug, ri.title AS roadmapTitle, ri.status AS roadmapStatus, d.slug AS decisionSlug, d.title AS decisionTitle
      FROM releases r
      INNER JOIN release_targets rt ON rt.release_id = r.id
      INNER JOIN roadmap_items ri ON ri.id = rt.roadmap_item_id
      INNER JOIN decisions d ON d.id = rt.decision_id
      WHERE r.slug = ? ORDER BY ri.title ASC
    `).bind(slug).all<OperatorReleaseDetail['targets'][number]>()
    const fields = version.results[0]
    const targetIds=(await this.connection.binding.prepare('SELECT roadmap_item_id AS id FROM release_targets WHERE release_id=?').bind(release.id).all<{id:string}>()).results.map(r=>r.id)
    return fields ? { ...release, ...fields, tagIds:JSON.parse(fields.tagIdsJson) as string[],targetIds, deliveryCounts:await releaseDeliveryCounts(this.connection.binding,fields.versionId), targets: targets.results } : null
  }
}
