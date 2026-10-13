import { boundedIds } from '@/core/features/workspace/list-query'
import type { OperatorRequestCard } from '@/core/shared/api/operator'
import type { DatabaseConnection } from '@/core/platform/database'

export class RequestsReadRepository {
  private readonly connection: DatabaseConnection

  constructor(connection: DatabaseConnection) {
    this.connection = connection
  }

  async list(ids?: readonly string[]): Promise<readonly OperatorRequestCard[]> {
    const result = await this.connection.binding.prepare(`
      SELECT
        r.id AS id, r.slug AS slug, r.title AS title, r.description AS description,
        r.moderation_state AS moderationState, r.public_state AS publicState,
        b.slug AS boardSlug, b.name AS boardName, b.visibility AS boardVisibility,
        author.id AS authorId, author.display_name AS authorName,
        (
          SELECT requester_address.email
          FROM requester_addresses requester_address
          WHERE requester_address.requester_id = author.id
          ORDER BY
            CASE
              WHEN requester_address.verified_at IS NOT NULL AND requester_address.suppressed_at IS NULL THEN 0
              WHEN requester_address.suppressed_at IS NULL THEN 1
              ELSE 2
            END,
            requester_address.created_at ASC,
            requester_address.id ASC
          LIMIT 1
        ) AS authorEmail,
        (SELECT COUNT(*) FROM request_votes rv JOIN requesters voter ON voter.id=rv.requester_id AND voter.blocked_at IS NULL WHERE rv.request_id = r.id AND r.withdrawn_at IS NULL) AS voteCount,
        (SELECT COUNT(*) FROM request_evidence_links rel WHERE rel.request_id = r.id) AS evidenceCount
      FROM requests r
      INNER JOIN boards b ON b.id = r.board_id
      LEFT JOIN requesters author ON author.id = r.author_requester_id
      ${boundedIds('r', ids)}
      ORDER BY r.updated_at DESC, r.id ASC
      LIMIT 25
    `).bind(...(ids ?? [])).all<{
      readonly id: string; readonly slug: string; readonly title: string; readonly description: string
      readonly moderationState: OperatorRequestCard['moderationState']; readonly publicState: OperatorRequestCard['publicState']
      readonly boardSlug: string; readonly boardName: string; readonly boardVisibility: 'public' | 'internal'
      readonly authorId: string | null; readonly authorName: string | null; readonly authorEmail: string | null
      readonly voteCount: number; readonly evidenceCount: number
    }>()
    return result.results.map((row) => ({
      id: row.id, slug: row.slug, title: row.title, description: row.description,
      moderationState: row.moderationState, publicState: row.publicState,
      board: { slug: row.boardSlug, name: row.boardName, visibility: row.boardVisibility },
      author: row.authorId && row.authorName ? { id: row.authorId, displayName: row.authorName, email: row.authorEmail } : null,
      voteCount: Number(row.voteCount), evidenceCount: Number(row.evidenceCount),
    }))
  }
}
