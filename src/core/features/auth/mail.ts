import { createMailSender, type NotificationMessage, type PennyMailSender } from '../../../base-mail'
import { localOutbox } from './local-outbox'
import type { PennyRuntime } from '@/core/app/runtime'

/** Shared Base owns all provider serialization, validation and transport. */
export function authMail(runtime: PennyRuntime): PennyMailSender | undefined {
  const { mailFrom, mailProvider, mailApiKey } = runtime.configuration
  const outbox = localOutbox(runtime)
  if (mailFrom && outbox) return createMailSender({provider:'development',mode:'development'}, {outbox})
  if (!mailFrom || (mailProvider !== 'sendgrid' && mailProvider !== 'resend') || !mailApiKey) return undefined
  return createMailSender({ provider: mailProvider, mode: 'production', apiKey: mailApiKey })
}
export function mailReady(runtime: PennyRuntime): boolean { return authMail(runtime) !== undefined }
export function mailTransport(runtime: PennyRuntime): string { return mailReady(runtime) ? runtime.configuration.mailProvider! : 'unavailable' }

/** Loopback captures keep their working body link; one-click mail headers require HTTPS. */
export function mailUnsubscribe(runtime: PennyRuntime, url: string): NotificationMessage['unsubscribe'] {
  return localOutbox(runtime) ? undefined : {url,oneClick:true}
}
