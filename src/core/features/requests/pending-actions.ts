import type { DatabaseConnection } from '@/core/platform/database'
import { createRequestId, digest } from './lifecycle-ids'
import type { RequesterReference, SubmissionInput } from './lifecycle-types'
import { NativeError } from '@/core/features/auth/native-tokens'
import { RequestLifecycleError } from './lifecycle-types'
import { RequestWriteRepository } from './write-repository'

export type PendingRequesterAction =
  | { readonly type: 'submission'; readonly input: SubmissionInput }
  | { readonly type: 'vote'; readonly slug: string; readonly emailUpdates: boolean; readonly subscriptionVersion?:number }
  | { readonly type: 'follow'; readonly slug: string }
  | { readonly type: 'comment'; readonly slug: string; readonly body: string }

export type PendingActionReplayState = 'not_requested' | 'replayed' | 'rejected'
export interface PendingActionReplayResult {
  readonly state: PendingActionReplayState
  readonly reason?: 'action_rejected'
}

export async function hashPendingRequesterActionToken(pendingToken: string): Promise<string> {
  return digest(pendingToken)
}

export async function bindPendingRequesterActions(
  database: DatabaseConnection,
  pendingToken: string,
  verificationEmailHash: string,
  now: string,
): Promise<'bound' | 'not_requested' | 'identity_mismatch'> {
  const pendingTokenHash = await hashPendingRequesterActionToken(pendingToken)
  const expiresAt = new Date(new Date(now).getTime() + 24 * 60 * 60 * 1000).toISOString()
  const binding = await database.binding.prepare(`
    INSERT INTO requester_pending_action_bindings (
      pending_token_hash, verification_email_hash, expires_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(pending_token_hash) DO UPDATE SET
      verification_email_hash = CASE
        WHEN requester_pending_action_bindings.expires_at <= excluded.created_at THEN excluded.verification_email_hash
        ELSE requester_pending_action_bindings.verification_email_hash
      END,
      expires_at = CASE
        WHEN requester_pending_action_bindings.expires_at <= excluded.created_at THEN excluded.expires_at
        ELSE requester_pending_action_bindings.expires_at
      END,
      updated_at = excluded.updated_at
    RETURNING verification_email_hash AS verificationEmailHash
  `).bind(pendingTokenHash, verificationEmailHash, expiresAt, now, now).first<{ verificationEmailHash: string }>()
  if (!binding) return 'not_requested'
  return binding.verificationEmailHash === verificationEmailHash ? 'bound' : 'identity_mismatch'
}

export async function holdPendingRequesterAction(
  database: DatabaseConnection,
  pendingToken: string,
  action: PendingRequesterAction,
  now: string,
): Promise<void> {
  const expiresAt = new Date(new Date(now).getTime() + 24 * 60 * 60 * 1000).toISOString()
  // Replacement is a new immutable action identity. An earlier in-flight replay
  // can only claim, complete or release its captured id, never this new version.
  await database.binding.prepare(`
    INSERT INTO requester_pending_actions (id, pending_token_hash, action_type, payload_json, expires_at, claimed_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
    ON CONFLICT(pending_token_hash, action_type) DO UPDATE SET
      id = excluded.id, payload_json = excluded.payload_json, expires_at = excluded.expires_at, claimed_at = NULL, updated_at = excluded.updated_at
  `).bind(createRequestId(), await hashPendingRequesterActionToken(pendingToken), action.type, JSON.stringify(action), expiresAt, now, now).run()
}

export async function replayPendingRequesterAction(
  database: DatabaseConnection,
  identity: RequesterReference,
  pendingTokenHash: string | null,
  verificationEmailHash: string | null,
  now = new Date().toISOString(),
): Promise<PendingActionReplayResult> {
  await database.binding.prepare('DELETE FROM requester_pending_actions WHERE expires_at<=?').bind(now).run()
  if (!pendingTokenHash || !verificationEmailHash) return { state: 'not_requested' }
  const action = await database.binding.prepare(`
    SELECT requester_pending_actions.id AS id, requester_pending_actions.payload_json AS payloadJson FROM requester_pending_actions
    INNER JOIN requester_pending_action_bindings binding ON binding.pending_token_hash = requester_pending_actions.pending_token_hash
    WHERE requester_pending_actions.pending_token_hash = ?
      AND binding.verification_email_hash = ?
      AND requester_pending_actions.expires_at > ?
      AND binding.expires_at > ?
      AND requester_pending_actions.claimed_at IS NULL
    ORDER BY requester_pending_actions.created_at ASC LIMIT 1
  `).bind(pendingTokenHash, verificationEmailHash, now, now).first<{ id: string; payloadJson: string }>()
  if (!action) return { state: 'not_requested' }
  const claimed = await database.binding.prepare(`
    UPDATE requester_pending_actions SET claimed_at = ?, updated_at = ? WHERE id = ? AND claimed_at IS NULL RETURNING 1 AS affected
  `).bind(now, now, action.id).all()
  if (claimed.results.length !== 1) return { state: 'not_requested' }
  try {
    await applyPendingAction(new RequestWriteRepository(database), identity, parsePendingAction(action.payloadJson), now)
  } catch (error) {
    if (error instanceof RequestLifecycleError || (error instanceof NativeError && [400,403,404,409].includes(error.status))) {
      await database.binding.prepare('DELETE FROM requester_pending_actions WHERE id=?').bind(action.id).run()
      return {state:'rejected',reason:'action_rejected'}
    }
    await database.binding.prepare(`UPDATE requester_pending_actions SET claimed_at = NULL, updated_at = ? WHERE id = ?`).bind(now, action.id).run()
    throw error
  }
  await database.binding.prepare('DELETE FROM requester_pending_actions WHERE id=?').bind(action.id).run()
  return { state: 'replayed' }
}

async function applyPendingAction(repository: RequestWriteRepository, identity: RequesterReference, action: PendingRequesterAction, now: string): Promise<void> {
  switch (action.type) {
    case 'submission':
      await repository.submit(identity, action.input, now)
      return
    case 'vote':
      await repository.vote(identity, action.slug, action.emailUpdates, now,action.subscriptionVersion)
      return
    case 'follow':
      await repository.follow(identity, action.slug, now)
      return
    case 'comment':
      await repository.comment(identity, action.slug, action.body, now)
      return
  }
}

function parsePendingAction(value: string): PendingRequesterAction {
  try {
    const action = JSON.parse(value) as PendingRequesterAction
    if (!action || !['submission', 'vote', 'follow', 'comment'].includes(action.type)) throw new Error('unknown action')
    return action
  } catch {
    throw new RequestLifecycleError(409, 'pending_action_invalid', 'The held requester action is invalid.')
  }
}
