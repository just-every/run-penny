import { requestSuggestions } from './suggestions'
import { resumeRequestEmailStatement } from '@/core/features/notifications/link-epochs'
import { readRequesterActivity } from './activity-repository'
import { publicRequestPredicate } from './publication-predicate'
import { requesterWrite, publishedAdmission, votingAdmission, ownRequestAdmission } from './write-admission'
import { projectContributions, contributionScope } from './contributions'
import { submitNativeRequest } from './native-submission'
import type { DatabaseConnection } from '@/core/platform/database'
import { createRequestId } from './lifecycle-ids'
import type { DuplicateSuggestion, PublicMutationResult, RequestEditInput, RequesterReference, SubmissionInput } from './lifecycle-types'
import { RequestLifecycleError } from './lifecycle-types'

export class RequestWriteRepository {
  private readonly connection: DatabaseConnection

  constructor(connection: DatabaseConnection) {
    this.connection = connection
  }

  async suggest(title: string): Promise<readonly DuplicateSuggestion[]> {
    return requestSuggestions(this.connection.binding,title)
  }

  async submit(identity: RequesterReference, input: SubmissionInput, _now: string): Promise<PublicMutationResult> {
    const addressId = await this.findVerifiedAddress(identity)
    return await submitNativeRequest(this.connection, { id: identity.requesterId, addressId, email: identity.verifiedEmail, displayName: identity.displayName,sessionId:identity.sessionId }, { ...input, proposedSolution: input.proposedSolution ?? undefined, impactStatement: input.impactStatement ?? undefined }) as PublicMutationResult
  }

  async vote(identity: RequesterReference, slug: string, emailUpdates: boolean, now: string): Promise<void> {
    const request = await this.findVotableRequest(slug)
    if (!request) throw new RequestLifecycleError(404, 'not_found', 'The published request does not exist.')
    if (request.status === 'declined' || request.status === 'shipped') throw new RequestLifecycleError(409, 'voting_closed', 'Voting is closed for this request.')
    const requesterAddressId = emailUpdates ? await this.findVerifiedAddress(identity) : null
    const statements = [
      this.connection.binding.prepare(`
        INSERT INTO request_vote_contributions (request_id, requester_id, created_at, updated_at)
        VALUES (?, ?, ?, ?) ON CONFLICT(request_id, requester_id) DO UPDATE SET updated_at = excluded.updated_at
      `).bind(request.id, identity.requesterId, now, now),
    ]
    if (emailUpdates) statements.push(...this.followStatements(request.id, identity, requesterAddressId!, 'vote', now))
    await requesterWrite(this.connection,identity,[...statements, ...projectContributions(this.connection, [request.id])],{sql:votingAdmission,values:[request.id,request.id]})
  }

  async removeVote(identity: RequesterReference, slug: string): Promise<void> {
    const request = await this.findPublicRequest(slug)
    if (!request) throw new RequestLifecycleError(404, 'not_found', 'The published request does not exist.')
    await requesterWrite(this.connection,identity,[
      this.connection.binding.prepare(`DELETE FROM request_vote_contributions WHERE request_id IN (${contributionScope}) AND requester_id=?`).bind(request.id,identity.requesterId),
      ...projectContributions(this.connection,[request.id]),
    ],{sql:publishedAdmission,values:[request.id]})
  }

  async follow(identity: RequesterReference, slug: string, now: string): Promise<void> {
    const request = await this.findPublicRequest(slug)
    if (!request) throw new RequestLifecycleError(404, 'not_found', 'The published request does not exist.')
    const addressId = await this.findVerifiedAddress(identity)
    await requesterWrite(this.connection,identity,[
      ...this.followStatements(request.id,identity,addressId,'follow',now),
      ...projectContributions(this.connection,[request.id]),
    ],{sql:publishedAdmission,values:[request.id]})
  }

  private followStatements(requestId:string, identity:RequesterReference, addressId:string, source:'follow'|'vote', now:string) {
    const db=this.connection.binding
    return [
      db.prepare(`INSERT INTO request_follow_contributions(request_id,requester_id,permission_granted_at,muted_at,created_at,updated_at)
        VALUES(?,?,?,NULL,?,?) ON CONFLICT(request_id,requester_id) DO UPDATE SET muted_at=NULL,updated_at=excluded.updated_at`).bind(requestId,identity.requesterId,now,now,now),
      // This predicate executes in the write transaction, including concurrent replays.
      db.prepare(`INSERT INTO requester_update_permissions(id,requester_id,requester_address_id,request_id,source,granted_at,created_at,updated_at)
        SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM requester_update_permissions WHERE requester_id=? AND requester_address_id=? AND request_id=? AND revoked_at IS NULL)`)
        .bind(createRequestId(),identity.requesterId,addressId,requestId,source,now,now,now,identity.requesterId,addressId,requestId),
    ]
  }

  private async followedRequest(identity:RequesterReference,slug:string) {
    // A caller may manage an existing permission even after publication is removed.
    return this.connection.binding.prepare(`SELECT r.id AS id FROM requests r
      JOIN request_canonical_roots root ON root.origin_id=r.id WHERE r.slug=? AND (
      EXISTS(SELECT 1 FROM request_follows f WHERE f.request_id=root.canonical_id AND f.requester_id=?) OR
      EXISTS(SELECT 1 FROM requester_update_permissions p JOIN request_canonical_roots pr ON pr.origin_id=p.request_id
        WHERE pr.canonical_id=root.canonical_id AND p.requester_id=? AND p.revoked_at IS NULL))`)
      .bind(slug,identity.requesterId,identity.requesterId).first<{id:string}>()
  }

  async unfollow(identity: RequesterReference, slug: string): Promise<void> {
    const request = await this.followedRequest(identity,slug)
    if (!request) {await requesterWrite(this.connection,identity,[]);return} // Idempotent, but never a stale identity success.
    const now=new Date().toISOString()
    await requesterWrite(this.connection,identity,[
      this.connection.binding.prepare(`DELETE FROM request_follow_contributions WHERE request_id IN (${contributionScope}) AND requester_id=?`).bind(request.id,identity.requesterId),
      this.connection.binding.prepare(`UPDATE requester_update_permissions SET revoked_at=?,updated_at=? WHERE request_id IN (${contributionScope}) AND requester_id=? AND revoked_at IS NULL`).bind(now,now,request.id,identity.requesterId),
      ...projectContributions(this.connection,[request.id]),
    ])
  }

  async setFollowMute(identity: RequesterReference, slug: string, muted: boolean, now: string): Promise<void> {
    const request = await this.followedRequest(identity,slug)
    if (!request) throw new RequestLifecycleError(404,'not_following','This requester is not following the request.')
    await requesterWrite(this.connection,identity,[
      // Discover every current canonical origin inside the same transaction
      // that clears its mute; a concurrent request merge cannot escape fencing.
      ...(muted?[]:[resumeRequestEmailStatement(this.connection.binding,identity.requesterId,request.id,now)]),
      this.connection.binding.prepare(`UPDATE request_follow_contributions SET muted_at=?,updated_at=? WHERE request_id IN (${contributionScope}) AND requester_id=?`).bind(muted?now:null,now,request.id,identity.requesterId),
      this.connection.binding.prepare(`DELETE FROM request_notification_mutes WHERE requester_id=? AND request_id IN (${contributionScope})`).bind(identity.requesterId,request.id),
      ...projectContributions(this.connection,[request.id]),
    ])
  }

  async comment(identity: RequesterReference, slug: string, body: string, now: string): Promise<{ readonly id: string; readonly moderationState: 'awaiting_review' }> {
    const request = await this.findVotableRequest(slug)
    if (!request) throw new RequestLifecycleError(404, 'not_found', 'The published request does not exist.')
    if (request.status === 'declined') throw new RequestLifecycleError(409, 'comments_closed', 'Comments are closed for this request.')
    const id = createRequestId()
    await requesterWrite(this.connection,identity,[this.connection.binding.prepare(`
      INSERT INTO request_comments (id, request_id, requester_id, operator_id, body, moderation_state, published_at, created_at, updated_at)
      VALUES (?, ?, ?, NULL, ?, 'awaiting_review', NULL, ?, ?)
    `).bind(id, request.id, identity.requesterId, body, now, now)],{sql:`${publishedAdmission} AND NOT EXISTS(SELECT 1 FROM requests WHERE id=? AND public_state='declined')`,values:[request.id,request.id]})
    return { id, moderationState: 'awaiting_review' }
  }

  async editOwnRequest(identity: RequesterReference, slug: string, input: RequestEditInput, now: string): Promise<PublicMutationResult> {
    const request = await this.connection.binding.prepare(`
      SELECT id
      FROM requests WHERE slug = ? AND author_requester_id = ? AND withdrawn_at IS NULL AND merged_into_request_id IS NULL
      LIMIT 1
    `).bind(slug, identity.requesterId).first<{ id: string }>()
    if (!request) throw new RequestLifecycleError(404, 'not_found', 'The requester-owned request does not exist.')
    const contentId = createRequestId()
    const statements = [
      this.connection.binding.prepare(`
        INSERT INTO request_content_submissions (
          id, request_id, requester_id, title, description, proposed_solution, impact_statement,
          moderation_state, rejection_reason, approved_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'awaiting_review', NULL, NULL, ?, ?)
      `).bind(contentId, request.id, identity.requesterId, input.title, input.description, input.proposedSolution, input.impactStatement, now, now),
    ]
    // Publication may commit after the ownership read. Only update the private
    // initial draft if it is still unpublished inside this transaction.
    statements.push(this.connection.binding.prepare(`
        UPDATE requests SET title = ?, description = ?, proposed_solution = ?, impact_statement = ?, moderation_state = 'awaiting_review', updated_at = ?
        WHERE id = ? AND published_at IS NULL
      `).bind(input.title, input.description, input.proposedSolution, input.impactStatement, now, request.id))
    await requesterWrite(this.connection,identity,statements,{sql:ownRequestAdmission,values:[request.id,identity.requesterId]})
    return { slug, moderationState: 'awaiting_review' }
  }

  async editOwnComment(identity: RequesterReference, commentId: string, body: string, now: string): Promise<{ readonly moderationState: 'awaiting_review' }> {
    const comment = await this.connection.binding.prepare(`
      SELECT id FROM request_comments WHERE id = ? AND requester_id = ? LIMIT 1
    `).bind(commentId, identity.requesterId).first<{ id: string }>()
    if (!comment) throw new RequestLifecycleError(404, 'not_found', 'The requester-owned comment does not exist.')
    await requesterWrite(this.connection,identity,[this.connection.binding.prepare(`
      INSERT INTO request_comment_edits (id, comment_id, requester_id, body, moderation_state, rejection_reason, approved_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'awaiting_review', NULL, NULL, ?, ?)
    `).bind(createRequestId(), comment.id, identity.requesterId, body, now, now)],{sql:'EXISTS(SELECT 1 FROM request_comments WHERE id=? AND requester_id=?)',values:[comment.id,identity.requesterId]})
    return { moderationState: 'awaiting_review' }
  }

  async withdraw(identity: RequesterReference, slug: string, now: string): Promise<void> {
    const request = await this.connection.binding.prepare(`
      SELECT id FROM requests WHERE slug = ? AND author_requester_id = ? AND withdrawn_at IS NULL LIMIT 1
    `).bind(slug, identity.requesterId).first<{ id: string }>()
    if (!request) throw new RequestLifecycleError(404, 'not_found', 'The requester-owned request does not exist.')
    await requesterWrite(this.connection,identity,[
      this.connection.binding.prepare(`UPDATE requests SET public_state = 'withdrawn', withdrawn_at = ?, updated_at = ? WHERE id = ?`).bind(now, now, request.id),
      this.connection.binding.prepare(`
        UPDATE evidence_items SET withdrawn_at = ?, updated_at = ?
        WHERE id IN (SELECT evidence_id FROM request_evidence_contributions WHERE request_id = ?) AND source_type = 'portal_request'
      `).bind(now, now, request.id),
      ...projectContributions(this.connection,[request.id]),
      this.connection.binding.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,details_json,created_at,updated_at) VALUES(?,'system',?,'request.withdrawn','request',?,?,'{"actorType":"requester","feature":"portal.withdraw"}',?,?)`).bind(createRequestId(),identity.requesterId,request.id,now,now,now),
    ],{sql:'EXISTS(SELECT 1 FROM requests WHERE id=? AND author_requester_id=? AND withdrawn_at IS NULL)',values:[request.id,identity.requesterId]})
  }

  async appeal(identity: RequesterReference, slug: string, subjectType: 'request' | 'request_edit' | 'comment' | 'comment_edit', subjectId: string, body: string, now: string): Promise<void> {
    const request = await this.connection.binding.prepare(`
      SELECT id FROM requests WHERE slug = ? LIMIT 1
    `).bind(slug).first<{ id: string }>()
    if (!request) throw new RequestLifecycleError(404, 'not_found', 'The appealed subject does not exist.')
    const subjects = {
      request: 'SELECT id, id AS requestId FROM requests WHERE id = ? AND id = ? AND author_requester_id = ? AND moderation_state = \'rejected\'',
      request_edit: 'SELECT id, request_id AS requestId FROM request_content_submissions WHERE id = ? AND request_id = ? AND requester_id = ? AND moderation_state = \'rejected\'',
      comment: 'SELECT id, request_id AS requestId FROM request_comments WHERE id = ? AND ? IN (request_id, origin_request_id) AND requester_id = ? AND moderation_state = \'rejected\'',
      comment_edit: 'SELECT e.id, c.request_id AS requestId FROM request_comment_edits e JOIN request_comments c ON c.id = e.comment_id WHERE e.id = ? AND ? IN (c.request_id, c.origin_request_id) AND e.requester_id = ? AND e.moderation_state = \'rejected\'',
    } as const
    if (!await this.connection.binding.prepare(subjects[subjectType]).bind(subjectId, request.id, identity.requesterId).first()) {
      throw new RequestLifecycleError(404, 'not_found', 'The rejected subject is not owned by this requester on this request.')
    }
    await requesterWrite(this.connection,identity,[this.connection.binding.prepare(`
      INSERT INTO request_moderation_appeals (
        id, subject_type, subject_id, request_id, requester_id, body, state, reviewed_by_operator_id, reviewed_at, created_at, updated_at
      ) SELECT ?, ?, ?, owned.requestId, ?, ?, 'open', NULL, NULL, ?, ? FROM (${subjects[subjectType]}) owned
    `).bind(createRequestId(), subjectType, subjectId, identity.requesterId, body, now, now,subjectId,request.id,identity.requesterId)],{sql:`EXISTS(${subjects[subjectType]})`,values:[subjectId,request.id,identity.requesterId]})
  }

  async requesterActivity(identity: RequesterReference) {
    return readRequesterActivity(this.connection, identity)
  }

  private async findPublicRequest(slug: string): Promise<{ readonly id: string } | null> {
    return this.connection.binding.prepare(`
      SELECT r.id AS id FROM requests r
      INNER JOIN boards b ON b.id = r.board_id
      LEFT JOIN requesters author ON author.id = r.author_requester_id
      WHERE r.slug = ? AND ${publicRequestPredicate}
      LIMIT 1
    `).bind(slug).first<{ id: string }>()
  }

  private async findVerifiedAddress(identity: RequesterReference): Promise<string> {
    const address = await this.connection.binding.prepare(`
      SELECT id FROM requester_addresses
      WHERE requester_id = ? AND email = ? AND verified_at IS NOT NULL AND suppressed_at IS NULL
      LIMIT 1
    `).bind(identity.requesterId, identity.verifiedEmail).first<{ id: string }>()
    if (!address) throw new RequestLifecycleError(403, 'requester_address_unavailable', 'The verified requester address is unavailable.')
    return address.id
  }

  private async findVotableRequest(slug: string): Promise<{ readonly id: string; readonly status: string } | null> {
    return this.connection.binding.prepare(`
      SELECT r.id AS id,
        CASE
          WHEN r.public_state = 'declined' THEN 'declined'
          WHEN ri.status = 'exploring' THEN 'under_review'
          WHEN ri.status IN ('planned', 'in_progress', 'shipped') THEN ri.status
          ELSE r.public_state
        END AS status
      FROM requests r
      INNER JOIN boards b ON b.id = r.board_id
      LEFT JOIN requesters author ON author.id = r.author_requester_id
      LEFT JOIN roadmap_request_mappings rrm ON rrm.request_id = r.id AND rrm.approved_at IS NOT NULL AND rrm.withdrawn_at IS NULL
      LEFT JOIN roadmap_publications rp ON rp.roadmap_item_id = rrm.roadmap_item_id AND rp.withdrawn_at IS NULL
      LEFT JOIN roadmap_items ri ON ri.id = rp.roadmap_item_id AND ri.status != 'dropped'
      WHERE r.slug = ? AND ${publicRequestPredicate}
      LIMIT 1
    `).bind(slug).first<{ id: string; status: string }>()
  }
}
