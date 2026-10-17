import type { RequesterReference } from './lifecycle-types'
import { RequestLifecycleError } from './lifecycle-types'
import { createUlid } from '@/core/shared/ulid'
export interface BoardConsent {id:string;enabled:number;version:number}
export const consentColumns='b.id,b.vote_subscriptions AS enabled,b.vote_subscription_version AS version'
export async function boardConsent(db:D1Database,boardId:string,displayedVersion?:number):Promise<BoardConsent> {
 const board=await db.prepare(`SELECT ${consentColumns} FROM boards b WHERE b.id=?`).bind(boardId).first<BoardConsent>()
 if(!board)throw new RequestLifecycleError(409,'board_unavailable','The board is unavailable.')
 if(board.enabled&&displayedVersion!==board.version)throw new RequestLifecycleError(409,'subscription_disclosure_changed','Refresh to read the current subscription disclosure before continuing.')
 if(board.enabled&&!await db.prepare("SELECT 1 FROM penny_mail_identity WHERE singleton=1 AND trim(postal_address)!=''").first())throw new RequestLifecycleError(409,'postal_address_required','The business postal address is required for automatic subscriptions.')
 return board
}
/** Compare the complete disclosed setting in the business transaction, including off -> on races. */
export function consentScope(board:BoardConsent) {
 return {sql:`EXISTS(SELECT 1 FROM boards WHERE id=? AND vote_subscriptions=? AND vote_subscription_version=?) AND (?=0 OR EXISTS(SELECT 1 FROM penny_mail_identity WHERE singleton=1 AND trim(postal_address)!=''))`,values:[board.id,board.enabled,board.version,board.enabled]}
}
export function grantRequestPermission(db:D1Database,requestId:string,identity:RequesterReference,addressId:string,source:'follow'|'vote'|'submission',origin:'explicit'|'vote_subscription'|'author_subscription',now:string,board?:BoardConsent) {
 return [
  db.prepare(`INSERT INTO request_follow_contributions(request_id,requester_id,permission_granted_at,muted_at,created_at,updated_at)
   VALUES(?,?,?,NULL,?,?) ON CONFLICT(request_id,requester_id) DO UPDATE SET muted_at=CASE WHEN ?='explicit' THEN NULL ELSE request_follow_contributions.muted_at END,updated_at=excluded.updated_at`).bind(requestId,identity.requesterId,now,now,now,origin),
  db.prepare(`INSERT INTO requester_update_permissions(id,requester_id,requester_address_id,request_id,source,grant_origin,board_id,setting_version,granted_at,created_at,updated_at)
   SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM requester_update_permissions WHERE requester_id=? AND requester_address_id=? AND request_id=? AND grant_origin=? AND revoked_at IS NULL)`)
   .bind(createUlid(),identity.requesterId,addressId,requestId,source,origin,board?.id??null,board?.version??null,now,now,now,identity.requesterId,addressId,requestId,origin),
 ]
}
