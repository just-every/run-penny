import type { PublicRequestCard, PublicRequestComment, PublicRequestDetail, PublicRequestStatus } from '@/core/shared/api/public'
import type { DatabaseConnection } from '@/core/platform/database'

interface PublicRequestRow extends Omit<PublicRequestCard, 'board' | 'status' | 'voteCount' | 'commentCount'> {
  readonly authorDisplayName: string | null
  readonly boardSlug: string
  readonly boardName: string
  readonly status: PublicRequestStatus
  readonly voteCount: number
  readonly commentCount: number
}

export interface PublicRequestFilters {
  readonly board?: string
  readonly q?: string
  readonly status?: PublicRequestStatus
  readonly sort?: 'recent' | 'votes'
}

const statusExpression = `
  CASE
    WHEN r.public_state = 'declined' THEN 'declined'
    WHEN ri.status = 'exploring' THEN 'under_review'
    WHEN ri.status IN ('planned', 'in_progress', 'shipped') THEN ri.status
    WHEN r.public_state = 'under_review' THEN 'under_review'
    ELSE 'open'
  END
`

const publicRequestFrom = `
  FROM requests r
  INNER JOIN boards b ON b.id = r.board_id AND b.visibility = 'public'
  LEFT JOIN requesters author ON author.id = r.author_requester_id
  LEFT JOIN roadmap_request_mappings rrm
    ON rrm.request_id = r.id
    AND rrm.approved_at IS NOT NULL
    AND rrm.withdrawn_at IS NULL
  LEFT JOIN roadmap_publications rp
    ON rp.roadmap_item_id = rrm.roadmap_item_id
    AND rp.withdrawn_at IS NULL AND (rp.board_id IS NULL OR EXISTS(SELECT 1 FROM boards pb WHERE pb.id=rp.board_id AND pb.visibility='public' AND pb.archived_at IS NULL))
  LEFT JOIN roadmap_items ri
    ON ri.id = rp.roadmap_item_id
    AND ri.status != 'dropped'
  WHERE r.moderation_state = 'approved'
    AND r.published_at IS NOT NULL
    AND r.withdrawn_at IS NULL AND r.merged_into_request_id IS NULL
    AND (author.id IS NULL OR author.blocked_at IS NULL)
`

function requestSelect(): string {
  return `
    SELECT
      r.slug AS slug, b.slug AS boardSlug, b.name AS boardName,
      r.public_title AS title, r.public_description AS description, r.public_author_display_name AS authorDisplayName,
      ${statusExpression} AS status, r.published_at AS publishedAt,
      (
        SELECT COUNT(*) FROM request_votes rv
        INNER JOIN requesters voter ON voter.id = rv.requester_id AND voter.blocked_at IS NULL
        WHERE rv.request_id = r.id
      ) AS voteCount,
      (
        SELECT COUNT(*) FROM request_comments rc
        LEFT JOIN requesters commenter ON commenter.id = rc.requester_id
        WHERE rc.request_id = r.id AND rc.moderation_state = 'approved' AND rc.published_at IS NOT NULL
          AND (commenter.id IS NULL OR commenter.blocked_at IS NULL)
      ) AS commentCount,
      MAX(
        r.published_at,
        COALESCE((SELECT MAX(u.published_at) FROM request_status_updates u WHERE u.request_id=r.id),r.published_at),
        COALESCE((SELECT MAX(v.published_at) FROM roadmap_update_histories h JOIN roadmap_update_versions v ON v.id=h.version_id WHERE h.request_id=r.id),r.published_at),
        COALESCE((SELECT MAX(rv.updated_at) FROM request_votes rv INNER JOIN requesters voter ON voter.id = rv.requester_id AND voter.blocked_at IS NULL WHERE rv.request_id = r.id), r.published_at),
        COALESCE((SELECT MAX(rc.published_at) FROM request_comments rc LEFT JOIN requesters commenter ON commenter.id = rc.requester_id WHERE rc.request_id = r.id AND rc.moderation_state = 'approved' AND rc.published_at IS NOT NULL AND (commenter.id IS NULL OR commenter.blocked_at IS NULL)), r.published_at)
      ) AS recentActivityAt
  `
}

function mapRequest(row: PublicRequestRow): PublicRequestCard {
  return {
    slug: row.slug,
    board: { slug: row.boardSlug, name: row.boardName },
    title: row.title,
    description: row.description,
    status: row.status,
    voteCount: Number(row.voteCount),
    commentCount: Number(row.commentCount),
    publishedAt: row.publishedAt,
    recentActivityAt: row.recentActivityAt,
  }
}

export class PublicRequestsReadRepository {
  private readonly connection: DatabaseConnection

  constructor(connection: DatabaseConnection) {
    this.connection = connection
  }

  async listBoards(): Promise<readonly { readonly slug: string; readonly name: string; readonly requestCount: number }[]> {
    const result = await this.connection.binding.prepare(`
      SELECT b.slug AS slug, b.name AS name, COUNT(CASE WHEN author.id IS NULL OR author.blocked_at IS NULL THEN r.id END) AS requestCount
      FROM boards b
      LEFT JOIN requests r ON r.board_id = b.id AND r.moderation_state = 'approved' AND r.published_at IS NOT NULL AND r.withdrawn_at IS NULL AND r.merged_into_request_id IS NULL
      LEFT JOIN requesters author ON author.id = r.author_requester_id
      WHERE b.visibility = 'public' AND b.archived_at IS NULL
      GROUP BY b.id, b.slug, b.name
      ORDER BY b.position ASC, b.name ASC
    `).all<{ readonly slug: string; readonly name: string; readonly requestCount: number }>()
    return result.results.map((row) => ({ ...row, requestCount: Number(row.requestCount) }))
  }

  async list(filters: PublicRequestFilters): Promise<readonly PublicRequestCard[]> {
    const conditions: string[] = []
    const values: string[] = []
    if (filters.board) {
      conditions.push('b.slug = ?')
      values.push(filters.board)
    }
    if (filters.q) {
      // Bound parameters stay literal; INSTR avoids D1's short LIKE-pattern limit.
      conditions.push('(INSTR(LOWER(r.public_title), LOWER(?)) > 0 OR INSTR(LOWER(r.public_description), LOWER(?)) > 0)')
      values.push(filters.q, filters.q)
    }
    if (filters.status) {
      conditions.push(`(${statusExpression}) = ?`)
      values.push(filters.status)
    }
    const where = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : ''
    const order = filters.sort === 'votes' ? 'voteCount DESC, recentActivityAt DESC, slug ASC' : 'recentActivityAt DESC, slug ASC'
    const result = await this.connection.binding.prepare(`
      ${requestSelect()}
      ${publicRequestFrom}
      ${where}
      ORDER BY ${order}
    `).bind(...values).all<PublicRequestRow>()
    return result.results.map(mapRequest)
  }

  async find(slug: string): Promise<PublicRequestDetail | null> {
    // D1 batch reads one database snapshot: a later private-board update cannot
    // be joined to an earlier public admission check, including in Start SSR.
    const [request,comments,statusUpdates,attachments] = await this.connection.binding.batch([
      this.connection.binding.prepare(`${requestSelect()} ${publicRequestFrom} AND r.slug=? LIMIT 1`).bind(slug),
      this.connection.binding.prepare(`SELECT rc.id,rc.public_author_display_name AS displayName,
        rc.public_author_kind AS kind,rc.body,rc.published_at AS publishedAt
        FROM request_comments rc LEFT JOIN requesters requester ON requester.id=rc.requester_id
        WHERE rc.request_id=(SELECT id FROM requests WHERE slug=?) AND rc.moderation_state='approved'
        AND rc.published_at IS NOT NULL AND (requester.id IS NULL OR requester.blocked_at IS NULL)
        ORDER BY rc.published_at,rc.id`).bind(slug),
      this.connection.binding.prepare(`SELECT id,public_status AS status,body,pinned,published_at AS publishedAt
        FROM request_status_updates WHERE request_id=(SELECT id FROM requests WHERE slug=?)
        UNION ALL SELECT h.id,v.public_status AS status,v.body,0 AS pinned,v.published_at AS publishedAt
        FROM roadmap_update_histories h JOIN roadmap_update_versions v ON v.id=h.version_id
        WHERE h.request_id=(SELECT id FROM requests WHERE slug=?) AND v.published_at IS NOT NULL
        ORDER BY pinned DESC,publishedAt DESC,id DESC`).bind(slug,slug),
      this.connection.binding.prepare(`SELECT id,original_filename AS filename,content_type AS contentType FROM attachments
        WHERE request_id=(SELECT id FROM requests WHERE slug=?) AND public_state='published'`).bind(slug),
    ])
    const row=request.results[0] as PublicRequestRow|undefined
    if(!row)return null
    return {
      ...mapRequest(row),authorDisplayName:row.authorDisplayName,
      statusUpdates:statusUpdates.results as {id:string;status:PublicRequestStatus|'withdrawn';body:string;pinned:number;publishedAt:string}[],
      attachments:attachments.results as {id:string;filename:string;contentType:string}[],
      comments:(comments.results as (PublicRequestComment & {displayName:string;kind:'requester'|'operator'})[]).map(comment=>({
        id:comment.id,author:{displayName:comment.displayName,kind:comment.kind},body:comment.body,publishedAt:comment.publishedAt,
      })),
    }
  }

  async canonical(slug: string): Promise<string|null> {
    const seen=new Set<string>()
    let current=slug
    while(!seen.has(current)) {
      seen.add(current)
      const row=await this.connection.binding.prepare(`SELECT target.slug FROM requests source JOIN boards source_board ON source_board.id=source.board_id LEFT JOIN requesters source_author ON source_author.id=source.author_requester_id JOIN requests target ON target.id=source.merged_into_request_id JOIN boards b ON b.id=target.board_id LEFT JOIN requesters author ON author.id=target.author_requester_id WHERE source.slug=? AND source_board.visibility='public' AND source.moderation_state='approved' AND source.published_at IS NOT NULL AND source.withdrawn_at IS NULL AND (source_author.id IS NULL OR source_author.blocked_at IS NULL) AND b.visibility='public' AND target.moderation_state='approved' AND target.published_at IS NOT NULL AND target.withdrawn_at IS NULL AND (author.id IS NULL OR author.blocked_at IS NULL)`).bind(current).first<{slug:string}>()
      if(!row)return current===slug?null:(await this.find(current)?current:null)
      current=row.slug
    }
    return null
  }

  async isWithdrawn(slug: string): Promise<boolean> {
    const result = await this.connection.binding.prepare(`
      SELECT 1 AS withdrawn
      FROM requests r
      INNER JOIN boards b ON b.id = r.board_id AND b.visibility = 'public'
      LEFT JOIN requesters author ON author.id = r.author_requester_id
      WHERE r.slug = ? AND r.moderation_state = 'approved' AND r.published_at IS NOT NULL AND r.withdrawn_at IS NOT NULL
        AND (author.id IS NULL OR author.blocked_at IS NULL)
      LIMIT 1
    `).bind(slug).first<{ readonly withdrawn: number }>()
    return result !== null
  }
}
