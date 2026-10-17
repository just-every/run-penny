import { insertSampleRows } from '../sample-data/insert'
import { drizzle } from 'drizzle-orm/d1'
import type { DatabaseConnection } from '../../platform/database'
import {
  requestComments,
  requestEvidenceLinks,
  requestFollows,
  requestTagAssignments,
  requestVotes,
  requests,
} from '../../shared/schema'
import type { PennySample } from '../sample-data/schema'

export class RequestsRepository {
  private readonly connection: DatabaseConnection
  private readonly database

  constructor(connection: DatabaseConnection) {
    this.connection = connection
    this.database = drizzle(connection.binding)
  }

  async insertRequests(records: PennySample['requests'], now: string): Promise<void> {
    if (records.length === 0) return
    await insertSampleRows(this.connection.binding,requests,records.map((record) => ({
      id: record.id,
      slug: record.slug,
      boardId: record.boardId,
      authorRequesterId: record.authorRequesterId,
      title: record.title,
      description: record.description,
      proposedSolution: record.proposedSolution,
      impactStatement: record.impactStatement,
      moderationState: record.moderationState,
      publicState: record.publicState,
      publicTitle: record.publicTitle,
      publicDescription: record.publicDescription,
      publishedAt: record.publishedAt,
      declinedReason: record.declinedReason,
      withdrawnAt: record.withdrawnAt,
      createdAt: now,
      updatedAt: now,
    })))

    const evidenceLinks = records.flatMap((record) => record.evidenceIds.map((evidenceId) => ({ requestId: record.id, evidenceId, createdAt: now })))
    const tagAssignments = records.flatMap((record) => record.tagIds.map((tagId) => ({ requestId: record.id, tagId, createdAt: now })))
    const votes = records.flatMap((record) => record.voterIds.map((requesterId) => ({ requestId: record.id, requesterId, createdAt: now, updatedAt: now })))
    const follows = records.flatMap((record) => record.followerIds.map((requesterId) => ({ requestId: record.id, requesterId, permissionGrantedAt: now, mutedAt: null, createdAt: now, updatedAt: now })))
    const comments = records.flatMap((record) => record.comments.map((comment) => ({ ...comment, requestId: record.id, createdAt: now, updatedAt: now })))

    if (evidenceLinks.length > 0) await insertSampleRows(this.connection.binding, requestEvidenceLinks, evidenceLinks)
    if (tagAssignments.length > 0) await this.database.insert(requestTagAssignments).values(tagAssignments).onConflictDoNothing().run()
    if (votes.length > 0) await this.database.insert(requestVotes).values(votes).onConflictDoNothing().run()
    if (follows.length > 0) await this.database.insert(requestFollows).values(follows).onConflictDoNothing().run()
    const db=this.connection.binding
    const contributions=[
      ...evidenceLinks.map(row=>db.prepare('INSERT OR IGNORE INTO request_evidence_contributions(request_id,evidence_id,created_at) VALUES(?,?,?)').bind(row.requestId,row.evidenceId,row.createdAt)),
      ...votes.map(row=>db.prepare('INSERT OR IGNORE INTO request_vote_contributions(request_id,requester_id,created_at,updated_at) VALUES(?,?,?,?)').bind(row.requestId,row.requesterId,row.createdAt,row.updatedAt)),
      ...follows.map(row=>db.prepare('INSERT OR IGNORE INTO request_follow_contributions(request_id,requester_id,permission_granted_at,muted_at,created_at,updated_at) VALUES(?,?,?,NULL,?,?)').bind(row.requestId,row.requesterId,row.permissionGrantedAt,row.createdAt,row.updatedAt)),
    ]
    if(contributions.length)await db.batch(contributions)
    if (comments.length > 0) {
      await this.database.insert(requestComments).values(comments).onConflictDoNothing().run()
      // The sample import explicitly publishes these comments. Snapshot its approved names,
      // just as moderation does; future profile edits must not change public attribution.
      await this.connection.binding.batch(comments.filter(c=>c.moderationState==='approved').map(c=>this.connection.binding.prepare(`UPDATE request_comments SET public_author_display_name=CASE WHEN requester_id IS NOT NULL THEN (SELECT display_name FROM requesters WHERE id=requester_id) ELSE (SELECT display_name FROM operators WHERE id=operator_id) END,public_author_kind=CASE WHEN requester_id IS NULL THEN 'operator' ELSE 'requester' END WHERE id=? AND public_author_display_name IS NULL`).bind(c.id)))
    }
  }
}
