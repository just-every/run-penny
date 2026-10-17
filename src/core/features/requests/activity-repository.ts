import type { DatabaseConnection } from '@/core/platform/database'
import type { RequesterReference } from './lifecycle-types'
import { publicRequestPredicate } from './publication-predicate'

export async function readRequesterActivity(connection: DatabaseConnection, identity: RequesterReference) {
  const [requests, votes, follows, comments] = await Promise.all([
    connection.binding.prepare(`
      SELECT id, slug, title, description, proposed_solution AS proposedSolution, impact_statement AS impactStatement,
        moderation_state AS moderationState, (SELECT status FROM penny_request_status WHERE request_id=requests.id) AS publicState, withdrawn_at AS withdrawnAt,
        CASE WHEN moderation_state = 'rejected' THEN (
          SELECT event.reason FROM request_moderation_events event
          WHERE event.subject_type = 'request' AND event.subject_id = requests.id
          ORDER BY event.created_at DESC, event.id DESC LIMIT 1
        ) ELSE NULL END AS rejectionReason
      FROM requests WHERE author_requester_id = ? AND EXISTS(SELECT 1 FROM boards WHERE boards.id=requests.board_id AND visibility='public') ORDER BY updated_at DESC, id ASC
    `).bind(identity.requesterId).all<{ id: string; slug: string; title: string; description: string; proposedSolution: string | null; impactStatement: string | null; moderationState: string; publicState: string; withdrawnAt: string | null; rejectionReason: string | null }>(),
    connection.binding.prepare(`
      SELECT DISTINCT CASE WHEN ${publicRequestPredicate} THEN r.slug ELSE original.slug END AS slug,
        CASE WHEN ${publicRequestPredicate} THEN r.public_title END AS title,
        CASE WHEN ${publicRequestPredicate} THEN 1 ELSE 0 END AS available
      FROM request_vote_contributions contribution JOIN requests original ON original.id=contribution.request_id
      JOIN request_canonical_roots root ON root.origin_id=original.id
      JOIN requests r ON r.id=root.canonical_id JOIN boards b ON b.id=r.board_id
      LEFT JOIN requesters author ON author.id=r.author_requester_id
      JOIN request_votes rv ON rv.request_id=r.id AND rv.requester_id=contribution.requester_id
      WHERE contribution.requester_id=? AND original.withdrawn_at IS NULL ORDER BY slug ASC
    `).bind(identity.requesterId).all<{ slug: string; title: string | null; available: number }>(),
    connection.binding.prepare(`
      SELECT DISTINCT CASE WHEN ${publicRequestPredicate} THEN r.slug ELSE original.slug END AS slug,
        CASE WHEN ${publicRequestPredicate} THEN r.public_title END AS title,
        COALESCE(rf.muted_at,(SELECT m.created_at FROM request_notification_mutes m JOIN request_canonical_roots mute_root ON mute_root.origin_id=m.request_id WHERE m.requester_id=rf.requester_id AND mute_root.canonical_id=r.id)) AS mutedAt,CASE WHEN ${publicRequestPredicate} THEN 1 ELSE 0 END AS available
      FROM request_follow_contributions c JOIN requests original ON original.id=c.request_id
      JOIN request_canonical_roots root ON root.origin_id=c.request_id
      JOIN requests r ON r.id=root.canonical_id JOIN boards b ON b.id=r.board_id
      LEFT JOIN requesters author ON author.id=r.author_requester_id
      JOIN request_follows rf ON rf.request_id=root.canonical_id AND rf.requester_id=c.requester_id
      WHERE c.requester_id=? ORDER BY slug ASC
    `).bind(identity.requesterId).all<{ slug: string; title: string | null; mutedAt: string | null;available:number }>(),
    connection.binding.prepare(`
      SELECT c.id, CASE WHEN ${publicRequestPredicate} THEN r.id ELSE original.id END AS requestId,
        CASE WHEN ${publicRequestPredicate} THEN r.slug ELSE original.slug END AS slug,
        CASE WHEN ${publicRequestPredicate} THEN 1 ELSE 0 END AS available,
        c.body, c.moderation_state AS moderationState, c.rejection_reason AS rejectionReason
      FROM request_comments c JOIN requests original ON original.id=c.origin_request_id
      JOIN requests r ON r.id=c.request_id JOIN boards b ON b.id=r.board_id
      LEFT JOIN requesters author ON author.id=r.author_requester_id
      WHERE c.requester_id=? ORDER BY c.updated_at DESC,c.id ASC
    `).bind(identity.requesterId).all<{ id: string; requestId: string; slug: string; body: string; moderationState: string; rejectionReason: string | null; available: number }>(),
  ])
  const [edits,commentEdits]=await Promise.all([
    connection.binding.prepare(`SELECT e.id,r.slug,e.title,e.description,e.moderation_state AS moderationState,e.rejection_reason AS rejectionReason FROM request_content_submissions e JOIN requests r ON r.id=e.request_id JOIN boards b ON b.id=r.board_id WHERE e.requester_id=? AND b.visibility='public' AND e.is_initial=0 ORDER BY e.created_at DESC,e.id DESC`).bind(identity.requesterId).all(),
    connection.binding.prepare(`SELECT e.id,
      CASE WHEN ${publicRequestPredicate} THEN r.slug ELSE original.slug END AS slug,
      CASE WHEN ${publicRequestPredicate} THEN 1 ELSE 0 END AS available,
      e.body,e.moderation_state AS moderationState,e.rejection_reason AS rejectionReason
      FROM request_comment_edits e JOIN request_comments c ON c.id=e.comment_id
      JOIN requests original ON original.id=c.origin_request_id
      JOIN requests r ON r.id=c.request_id JOIN boards b ON b.id=r.board_id
      LEFT JOIN requesters author ON author.id=r.author_requester_id
      WHERE e.requester_id=? ORDER BY e.created_at DESC,e.id DESC`).bind(identity.requesterId).all(),
  ])
  return { requests: requests.results, votes: votes.results, follows: follows.results, comments: comments.results, edits:edits.results,commentEdits:commentEdits.results }
  }
