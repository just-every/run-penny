import { nativeProxyPredicate } from './proxy-votes'
import { publicBoards } from '../categories/public-boards'
import { publicRequestPredicate } from './publication-predicate'
import { requestStatusExpression, requestStatusLabelExpression } from './status-sql'
import type { PublicBoard, PublicRequestCard, PublicRequestComment, PublicRequestDetail, PublicRequestStatus } from '@/core/shared/api/public'
import type { DatabaseConnection } from '@/core/platform/database'

interface PublicRequestRow extends Omit<PublicRequestCard, 'board' | 'status' | 'voteCount' | 'commentCount' | 'category'> {
  readonly authorDisplayName: string | null
  readonly categoryId:string|null
  readonly categoryName:string|null
  readonly parentId:string|null
  readonly parentName:string|null
  readonly showVoteCounts:number
  readonly showVoters:number
  readonly commentsAllowed:number
  readonly boardSlug: string
  readonly boardName: string
  readonly status: PublicRequestStatus
  readonly voteCount: number
  readonly commentCount: number
  readonly publicEta: string|null
  readonly statusLabel: string|null
}

export interface PublicRequestFilters {
  readonly board?: string
  readonly q?: string
  readonly status?: PublicRequestStatus
  readonly category?: string
  readonly sort?: 'recent' | 'votes' | 'newest' | 'trending'
}

const statusExpression = requestStatusExpression

const publicRequestFrom = `
  FROM requests r
  INNER JOIN boards b ON b.id = r.board_id AND b.visibility = 'public'
  LEFT JOIN requesters author ON author.id = r.author_requester_id
  LEFT JOIN request_categories category ON category.id=r.category_id
  LEFT JOIN request_categories parent ON parent.id=category.parent_id
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
  WHERE ${publicRequestPredicate}
`

function requestSelect(): string {
  return `
    SELECT
      r.slug AS slug, b.slug AS boardSlug, b.name AS boardName,
      r.public_title AS title, r.public_description AS description,
      CASE WHEN b.anonymous_requesters=1 AND r.author_operator_id IS NULL THEN 'Anonymous' ELSE r.public_author_display_name END AS authorDisplayName,
      category.id AS categoryId,category.name AS categoryName,parent.id AS parentId,parent.name AS parentName,
      b.show_vote_counts AS showVoteCounts,b.show_voters AS showVoters,b.comments_allowed AS commentsAllowed,
      ${statusExpression} AS status, r.public_eta AS publicEta, ${requestStatusLabelExpression} AS statusLabel, r.published_at AS publishedAt,
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
    publicEta: row.publicEta, statusLabel: row.statusLabel,
    category:row.categoryId?{id:row.categoryId,name:row.categoryName!,parent:row.parentId?{id:row.parentId,name:row.parentName!}:null}:null,
    ...(row.showVoteCounts?{voteCount:Number(row.voteCount)}:{}),
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

  async listBoards(): Promise<readonly PublicBoard[]> {
    const boards=await publicBoards(this.connection)
    const result=await this.connection.binding.prepare(`SELECT slug,vote_subscriptions AS enabled,vote_subscription_version AS version
      FROM boards WHERE visibility='public' AND archived_at IS NULL`).all<{slug:string;enabled:number;version:number}>()
    const policies=new Map(result.results.map(policy=>[policy.slug,policy]))
    // Keep category, participation and privacy projections from the board directory.
    // A board made private after that read must not regain exposure here.
    return boards.flatMap(board=>{
      const policy=policies.get(board.slug)
      if(!policy)return []
      return [{...board,subscriptionDisclosure:{enabled:Boolean(policy.enabled),version:policy.version,
        vote:policy.enabled?'Voting subscribes you to updates on this request. Remove your vote, unfollow, or use the unsubscribe link in any email to stop.':null,
        submission:policy.enabled?'Submitting subscribes you to updates on your request. Unfollow, withdraw your request, or use the unsubscribe link in any email to stop.':null}}]
    })
  }

  async list(filters: PublicRequestFilters): Promise<readonly PublicRequestCard[]> {
    const conditions: string[] = []
    const values: string[] = []
    if (filters.board) {
      conditions.push('b.slug = ?')
      values.push(filters.board)
    }
    if(filters.category){conditions.push('(r.category_id=? OR category.parent_id=?)');values.push(filters.category,filters.category)}
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
    const order = filters.sort === 'votes' ? 'voteCount DESC, recentActivityAt DESC, slug ASC' : filters.sort==='newest'?'r.created_at DESC, slug ASC':filters.sort==='trending'?`${trendingScore} DESC, recentActivityAt DESC, slug ASC`:'recentActivityAt DESC, slug ASC'
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
    const [request,comments,statusUpdates,attachments,voters] = await this.connection.binding.batch([
      this.connection.binding.prepare(`${requestSelect()} ${publicRequestFrom} AND r.slug=? LIMIT 1`).bind(slug),
      this.connection.binding.prepare(`SELECT rc.id,CASE WHEN b.anonymous_requesters=1 AND rc.operator_id IS NULL THEN 'Anonymous' ELSE rc.public_author_display_name END AS displayName,
        rc.public_author_kind AS kind,rc.body,rc.published_at AS publishedAt
        FROM request_comments rc JOIN requests r ON r.id=rc.request_id JOIN boards b ON b.id=r.board_id LEFT JOIN requesters requester ON requester.id=rc.requester_id
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
      this.connection.binding.prepare(`SELECT CASE WHEN b.anonymous_requesters=1 THEN 'Anonymous' ELSE voter.display_name END AS displayName
       FROM request_votes v JOIN requesters voter ON voter.id=v.requester_id JOIN requests r ON r.id=v.request_id JOIN boards b ON b.id=r.board_id
       WHERE r.slug=? AND b.show_voters=1 AND voter.blocked_at IS NULL AND NOT ${nativeProxyPredicate()} ORDER BY v.created_at,v.requester_id`).bind(slug),
    ])
    const row=request.results[0] as PublicRequestRow|undefined
    if(!row)return null
    return {
      ...mapRequest(row),authorDisplayName:row.authorDisplayName,commentsAllowed:!!row.commentsAllowed,showVoters:!!row.showVoters,
      ...(row.showVoters?{voters:voters.results as {displayName:string}[]}:{}),
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

// One current vote per requester and approved comment, scored over a rolling 14-day
// window. Each event decays as 1/(1+age in days); private/held activity has no effect.
const trendingScore=`(
 COALESCE((SELECT SUM(1.0/(1.0+MAX(0,julianday('now')-julianday(v.created_at)))) FROM request_votes v
 JOIN requesters voter ON voter.id=v.requester_id AND voter.blocked_at IS NULL
 WHERE v.request_id=r.id AND julianday(v.created_at) BETWEEN julianday('now')-14 AND julianday('now')),0)
 +COALESCE((SELECT SUM(1.0/(1.0+MAX(0,julianday('now')-julianday(c.published_at)))) FROM request_comments c
 LEFT JOIN requesters commenter ON commenter.id=c.requester_id
 WHERE c.request_id=r.id AND c.moderation_state='approved' AND c.published_at IS NOT NULL
 AND (commenter.id IS NULL OR commenter.blocked_at IS NULL)
 AND julianday(c.published_at) BETWEEN julianday('now')-14 AND julianday('now')),0))`
