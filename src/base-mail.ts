// Base owns provider validation, serialization, headers and HTTP transport.
// @ts-expect-error Base mail ships JavaScript without a declaration file.
import { createMailSender as sender } from '../base/modules/mail/index.mjs'
import type { MailSender } from '../base/modules/operator-auth/index.mjs'
export interface NotificationMessage {
  deliveryId: string; from: string; to: string[]; subject: string; text: string
  customArgs?: Record<string,string>; headers?: Record<string,string>; unsubscribe?: {url:string;oneClick?:boolean}
}
export interface PennyMailSender extends MailSender {
  send(message: NotificationMessage): Promise<{provider:string;status:'accepted'|'rejected'|'rate_limited'|'uncertain'|'development';providerMessageId:string|null;code?:string}>
}
export const createMailSender = sender as (config: {provider: 'sendgrid'|'resend'; mode: 'production'; apiKey: string} | {provider:'rer';mode:'production';apiKey:string;relayUrl:string} | {provider:'development';mode:'development'}, dependencies?: { fetch?: typeof fetch }) => PennyMailSender
