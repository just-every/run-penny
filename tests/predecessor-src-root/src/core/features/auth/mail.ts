import type { PennyRuntime } from '@/core/app/runtime'
import type { MailMessage, MailSender } from '../../../../../../../base/modules/operator-auth/index.mjs'
import { localAuthReady } from './native-service'
export const mailReady = localAuthReady
export function mailTransport(runtime: PennyRuntime): string { return mailReady(runtime) ? 'local-outbox' : 'unavailable' }
export function authMail(runtime: PennyRuntime): MailSender | undefined {
 if (!mailReady(runtime)) return undefined
 return { async send(message: MailMessage) {
  const token = new URL(message.text.split('\n').at(-1)!).hash.slice(1), now = new Date().toISOString()
  await runtime.database.binding.prepare('INSERT INTO local_auth_outbox(id,recipient,purpose,token,expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(message.deliveryId,message.to[0],'requester',token,new Date(Date.now()+1800000).toISOString(),now,now).run()
  return {status:'development',provider:'development',providerMessageId:null}
 } }
}
