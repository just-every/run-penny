import { createMailSender, type NotificationMessage, type PennyMailSender } from '../../../base-mail'
import type { PennyRuntime } from '@/core/app/runtime'
import { mailRelayFetch } from '@/core/platform/mail-fetch'

/** Shared Base owns all provider serialization, validation and transport. */
export function authMail(runtime: PennyRuntime): PennyMailSender | undefined {
  const { mailFrom, mailProvider, mailApiKey, mailRelayUrl } = runtime.configuration
  if (mailFrom && suppressesMail(runtime)) {
    const sender = createMailSender({provider:'development',mode:'development'})
    return runtime.configuration.demo ? {send: async message => (await import('../../../../base/modules/demo/index.mjs')).demoEffect(() => sender.send(message), () => ({provider:'development',status:'accepted' as const,providerMessageId:null}))} : sender
  }
  if (mailFrom && mailProvider === 'rer' && mailApiKey && mailRelayUrl) {
    const sender = createMailSender({provider:'rer',mode:'production',apiKey:mailApiKey,relayUrl:mailRelayUrl}, {fetch:mailRelayFetch})
    // The relay owns transport headers. Penny's unsubscribe links stay in text;
    // remove only the automatic-mail header Penny and Base identity add.
    return {send: message => sender.send({...message, headers: message.headers?.['Auto-Submitted'] === 'auto-generated' && Object.keys(message.headers).length === 1 ? undefined : message.headers})}
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
  return suppressesMail(runtime) || runtime.configuration.mailProvider === 'rer' ? undefined : {url,oneClick:true}
}
