import { requestDeliveryCounts,requestVersionDeliveryCounts } from '../releases/counts'
import type { DatabaseConnection } from '@/core/platform/database'
import { MutationError } from '@/core/app/operator-mutations'
import { createUlid } from '@/core/shared/ulid'
import { createRequestSlug } from './lifecycle-ids'

// A UserVoice proxy vote stays visibly proxy; a supporter with any unmarked
// origin vote is shown unmarked. Native and Canny votes have no source type.
const supporterOrigins = (type: string) => `EXISTS(SELECT 1 FROM request_vote_supporter_types t JOIN request_canonical_roots root ON root.origin_id = t.request_id WHERE root.canonical_id = v.request_id AND t.requester_id = v.requester_id AND t.supporter_type = '${type}')`
const supporterType = `CASE WHEN ${supporterOrigins('unmarked')} THEN 'unmarked' WHEN ${supporterOrigins('proxy')} THEN 'proxy' END`

export async function requestContext(database: DatabaseConnection, slug: string) {
  const db = database.binding
  const request = await db.prepare('SELECT id FROM requests WHERE slug = ?').bind(slug).first<{ id: string }>()
  if (!request) throw new MutationError(404, 'Request not found.')
  const [voters, accounts, notes, comments, edits, attachments, commentEdits, appeals, uploads] = await Promise.all([
    db.prepare(`SELECT r.id, r.display_name AS displayName, v.created_at AS votedAt, ${supporterType} AS supporterType, a.email, account.id AS accountId,account.slug AS accountSlug,account.name AS accountName FROM request_votes v JOIN requesters r ON r.id = v.requester_id AND r.blocked_at IS NULL LEFT JOIN requester_addresses a ON a.requester_id = r.id AND a.verified_at IS NOT NULL LEFT JOIN requester_account_links ral ON ral.requester_id=r.id LEFT JOIN accounts account ON account.id=ral.account_id WHERE v.request_id = ? ORDER BY r.id, a.id,account.id`).bind(request.id).all(),
    db.prepare(`SELECT DISTINCT a.id, a.slug, a.name FROM accounts a WHERE EXISTS (SELECT 1 FROM evidence_items e JOIN request_evidence_links l ON l.evidence_id=e.id WHERE e.account_id=a.id AND l.request_id=?) OR EXISTS (SELECT 1 FROM requester_account_links l JOIN request_votes v ON v.requester_id=l.requester_id WHERE l.account_id=a.id AND v.request_id=?) ORDER BY a.name`).bind(request.id, request.id).all(),
    db.prepare('SELECT * FROM request_notes WHERE request_id = ? ORDER BY created_at, id').bind(request.id).all(),
    db.prepare('SELECT * FROM request_comments WHERE request_id = ? ORDER BY created_at, id').bind(request.id).all(),
    db.prepare('SELECT * FROM request_content_submissions WHERE is_initial=0 AND request_id = ? ORDER BY created_at, id').bind(request.id).all(),
    db.prepare("SELECT * FROM attachments WHERE request_id = ? ORDER BY created_at, id").bind(request.id).all(),
    db.prepare('SELECT edits.* FROM request_comment_edits edits JOIN request_comments comments ON comments.id = edits.comment_id WHERE comments.request_id = ? ORDER BY edits.created_at, edits.id').bind(request.id).all(),
    db.prepare('SELECT * FROM request_moderation_appeals WHERE request_id = ? ORDER BY created_at, id').bind(request.id).all(),
    db.prepare('SELECT id,original_filename,writing FROM request_attachment_uploads WHERE request_id=? ORDER BY created_at').bind(request.id).all(),
  ])
  const votesByAccount=await db.prepare('SELECT a.id AS accountId,a.slug,a.name,count(DISTINCT v.requester_id) AS voteCount FROM request_votes v JOIN requesters r ON r.id=v.requester_id AND r.blocked_at IS NULL JOIN requester_account_links l ON l.requester_id=r.id JOIN accounts a ON a.id=l.account_id WHERE v.request_id=? GROUP BY a.id ORDER BY a.name').bind(request.id).all()
  return { statusVersions:await requestVersionDeliveryCounts(db,request.id), deliveryCounts:await requestDeliveryCounts(db,request.id), votesByAccount:votesByAccount.results,requestId: request.id, voters: voters.results, accounts: accounts.results, notes: notes.results, comments: comments.results, edits: edits.results, attachments: attachments.results, commentEdits: commentEdits.results, appeals: appeals.results, uploads:uploads.results }
}

export async function createOperatorRequest(database: DatabaseConnection, input: { title: string; description: string; boardSlug: string; evidenceIds: string[] }, operatorId: string) {
  const db = database.binding
  const board = await db.prepare('SELECT id FROM boards WHERE slug = ? AND archived_at IS NULL').bind(input.boardSlug).first<{ id: string }>()
  if (!board) throw new MutationError(404, 'Board not found.')
  for (const evidenceId of input.evidenceIds) if (!await db.prepare('SELECT id FROM evidence_items WHERE id = ?').bind(evidenceId).first()) throw new MutationError(404, 'Evidence not found.')
  const id = createUlid(); const slug = createRequestSlug(input.title, id); const now = new Date().toISOString()
  await db.batch([
    db.prepare(`INSERT INTO requests (id,slug,board_id,author_requester_id,author_operator_id,title,description,moderation_state,public_state,created_at,updated_at) VALUES (?,?,?,NULL,?,?,?,'approved','unpublished',?,?)`).bind(id,slug,board.id,operatorId,input.title,input.description,now,now),
    ...input.evidenceIds.flatMap(evidenceId => ['request_evidence_links','request_evidence_contributions'].map(table=>db.prepare(`INSERT INTO ${table} (request_id,evidence_id,created_at) VALUES (?,?,?)`).bind(id,evidenceId,now))),
    db.prepare(`INSERT INTO audit_entries (id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) VALUES (?,'operator',?,'request.created','request',?,?,?,?)`).bind(createUlid(),operatorId,id,now,now,now),
  ])
  return { id, slug }
}

export async function postOperatorComment(database:DatabaseConnection,slug:string,body:string,operator:{id:string;displayName:string}){
 const db=database.binding
 const request=await db.prepare("SELECT r.id FROM requests r JOIN boards b ON b.id=r.board_id WHERE r.slug=? AND b.visibility='public' AND r.moderation_state='approved' AND r.published_at IS NOT NULL AND r.withdrawn_at IS NULL AND r.merged_into_request_id IS NULL").bind(slug).first<{id:string}>()
 if(!request)throw new MutationError(404,'Published request not found.')
 const id=createUlid();const now=new Date().toISOString()
 await db.prepare("INSERT INTO request_comments (id,request_id,operator_id,requester_id,body,moderation_state,published_at,public_author_display_name,public_author_kind,created_at,updated_at) VALUES (?,?,?,NULL,?,'approved',?,?,'operator',?,?)").bind(id,request.id,operator.id,body,now,operator.displayName,now,now).run()
 return {id}
}
