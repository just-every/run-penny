import type { DatabaseConnection } from '@/core/platform/database'
import { MutationError } from '@/core/app/operator-mutations'
import { createUlid } from '@/core/shared/ulid'
import { createRequestSlug } from './lifecycle-ids'
import { requestContexts } from './request-context-read'
export { requestContexts, type RequestContext } from './request-context-read'

export async function requestContext(database: DatabaseConnection, slug: string) {
  const contexts = await requestContexts(database, [slug])
  const context = Object.hasOwn(contexts, slug) ? contexts[slug] : undefined
  if (!context) throw new MutationError(404, 'Request not found.')
  return context
}

export async function createOperatorRequest(database: DatabaseConnection, input: { title: string; description: string; boardSlug: string; evidenceIds: string[] }, operatorId: string) {
  const db = database.binding
  const board = await db.prepare('SELECT id FROM boards WHERE slug = ? AND archived_at IS NULL').bind(input.boardSlug).first<{ id: string }>()
  if (!board) throw new MutationError(404, 'Board not found.')
  for (const evidenceId of input.evidenceIds) if (!await db.prepare('SELECT id FROM evidence_items WHERE id = ?').bind(evidenceId).first()) throw new MutationError(404, 'Evidence not found.')
  const id = createUlid(); const slug = createRequestSlug(input.title, id); const now = new Date().toISOString()
  await db.batch([
    db.prepare(`INSERT INTO requests (id,slug,board_id,author_requester_id,author_operator_id,title,description,moderation_state,public_state,created_at,updated_at) VALUES (?,?,?,NULL,?,?,?,'awaiting_review','unpublished',?,?)`).bind(id,slug,board.id,operatorId,input.title,input.description,now,now),
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
