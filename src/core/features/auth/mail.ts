import { demoEffect } from '../../../../base/modules/demo/index.mjs'
import { createMailSender, type NotificationMessage, type PennyMailSender } from '../../../base-mail'
import type { PennyRuntime } from '@/core/app/runtime'

/** Shared Base owns all provider serialization, validation and transport. */
export function authMail(runtime: PennyRuntime): PennyMailSender | undefined {
  const { mailFrom, mailProvider, mailApiKey } = runtime.configuration
  if (mailFrom && suppressesMail(runtime)) {
    const sender = createMailSender({provider:'development',mode:'development'})
    return runtime.configuration.demo ? {send: message => demoEffect(() => sender.send(message), () => ({provider:'development',status:'accepted' as const,providerMessageId:null}))} : sender
  }
  if (!mailFrom || (mailProvider !== 'sendgrid' && mailProvider !== 'resend') || !mailApiKey) return undefined
  return createMailSender({ provider: mailProvider, mode: 'production', apiKey: mailApiKey })
}
export function mailReady(runtime: PennyRuntime): boolean { return authMail(runtime) !== undefined }
export function mailTransport(runtime: PennyRuntime): string { return mailReady(runtime) ? runtime.configuration.mailProvider! : 'unavailable' }

/** Mail never leaves a local development session or throwaway demo. */
function suppressesMail(runtime: PennyRuntime): boolean {
  const { demo, environment, appOrigin } = runtime.configuration
  return demo || environment === 'local' && Boolean(appOrigin && new URL(appOrigin).protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(new URL(appOrigin).hostname))
}

/** One-click mail headers require HTTPS. */
export function mailUnsubscribe(runtime: PennyRuntime, url: string): NotificationMessage['unsubscribe'] {
  return suppressesMail(runtime) ? undefined : {url,oneClick:true}
}
