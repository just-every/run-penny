import type { PennyRuntime } from '@/core/app/runtime'
import { createUlid } from '@/core/shared/ulid'
import { digest, NativeError, opaqueToken } from './native-tokens'

/** Penny Dev sends no mail, so a customer cannot verify an address locally.
 * There the signed-in operator adds a test customer instead: Penny records the
 * address as verified and opens this browser's requester session as them. */
export function testCustomersAvailable(runtime: PennyRuntime): boolean {
  const { demo, environment, appOrigin } = runtime.configuration
  if (demo || environment !== 'local' || !appOrigin) return false
  const url = new URL(appOrigin)
  return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
}

export async function addTestCustomer(runtime: PennyRuntime, email: string, displayName: string): Promise<{ token: string; displayName: string }> {
  if (!testCustomersAvailable(runtime)) throw new NativeError('not_found', 404)
  const db = runtime.database.binding, now = new Date().toISOString(), token = opaqueToken()
  const blocked = await db.prepare('SELECT r.blocked_at AS blocked FROM requesters r JOIN requester_addresses a ON a.requester_id=r.id WHERE a.email=?').bind(email).first<{ blocked: string | null }>()
  if (blocked?.blocked) throw new NativeError('requester_blocked', 403)
  const requesterId = createUlid()
  await db.batch([
    db.prepare('INSERT INTO requesters(id,display_name,created_at,updated_at) SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM requester_addresses WHERE email=?)').bind(requesterId, displayName, now, now, email),
    db.prepare('INSERT INTO requester_addresses(id,requester_id,email,verified_at,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET verified_at=excluded.verified_at,suppressed_at=NULL,updated_at=excluded.updated_at').bind(createUlid(), requesterId, email, now, now, now),
    db.prepare('INSERT INTO native_requester_sessions(id,requester_id,address_id,token_hash,expires_at,last_used_at,created_at,updated_at) SELECT ?,requester_id,id,?,?,?,?,? FROM requester_addresses WHERE email=?').bind(createUlid(), await digest(token), new Date(Date.now() + 30 * 86400000).toISOString(), now, now, now, email),
  ])
  const saved = await db.prepare('SELECT r.display_name AS displayName FROM requesters r JOIN requester_addresses a ON a.requester_id=r.id WHERE a.email=?').bind(email).first<{ displayName: string | null }>()
  return { token, displayName: saved?.displayName ?? displayName }
}
