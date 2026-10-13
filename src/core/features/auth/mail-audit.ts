import type { PennyRuntime } from '@/core/app/runtime'
import type { PennyMailSender } from '../../../base-mail'
import { authMail } from './mail'
import { digest, NativeError } from './native-tokens'
import { safeValidationCode } from '../notifications/attempt-policy'

type Feature = 'operator_magic_link' | 'requester_verification'
type Outcome = 'accepted' | 'development' | 'failed' | 'unknown'

/** Only ordinary identity mail uses this boundary. Invitation and notification
 * senders own their existing attempt records and continue using authMail. */
export function auditedIdentityMail(runtime: PennyRuntime, feature: Feature): PennyMailSender | undefined {
  const sender = authMail(runtime)
  if (!sender) return undefined
  return {send: async message => {
    const db = runtime.database.binding, now = new Date().toISOString()
    // A domain-separated, opaque reference names this specific link attempt
    // without retaining its address, credential, or deletable token identity.
    const target = await digest(`penny.auth-mail:${message.deliveryId}`)
    const id = `auth-mail:${target}`
    const transport = runtime.configuration.mailProvider
    // Unknown is truthful even if the process stops immediately after the send.
    // A duplicate delivery ID cannot acquire a second attempt or call the sender.
    const claim = await db.prepare(`INSERT INTO penny_auth_mail_attempts(id,feature,outcome,phase,transport,started_at)
      VALUES(?,?,'unknown','started',?,?) RETURNING id`)
      .bind(id,feature,transport,now).all()
    if (claim.results.length !== 1) throw new NativeError('mail_audit_unavailable',503)
    const finish = async (outcome: Outcome) => {
      // Installation custody survives both identity erasure and product
      // maintenance, just like native sign-in authority and revocation.
      const result = await db.prepare(`UPDATE penny_auth_mail_attempts SET outcome=?,phase='finished',finished_at=?
        WHERE id=? AND outcome='unknown' AND phase='started' RETURNING id`)
        .bind(outcome,new Date().toISOString(),id).all()
      if (result.results.length !== 1) throw new NativeError('mail_audit_unavailable',503)
    }
    let result: Awaited<ReturnType<PennyMailSender['send']>>
    try {
      result = await sender.send(message)
    } catch (error) {
      await finish(safeValidationCode(error) ? 'failed' : 'unknown')
      throw error
    }
    // No provider response text, message ID or other private content is copied.
    await finish(result.status === 'accepted' || result.status === 'development' ? result.status
      : result.status === 'rejected' || result.status === 'rate_limited' ? 'failed' : 'unknown')
    // A failed receipt write throws: callers revoke the link, and the durable
    // pre-send unknown record remains. Never report an unaudited acceptance.
    return result
  }}
}
