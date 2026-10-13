import { createAuthHandler, createOperatorAuth } from '../base/modules/operator-auth/index.mjs'
import type { AppBindings } from '../src/core/shared/bindings'

// A separate native installation for tests of current product authority. This does
// not convert, copy or authorize any of the predecessor's historical sessions.
export const nativeAuthoritySettings = {
 APP_ORIGIN: 'https://penny.test',
 AUTH_SECRET: 'synthetic-predecessor-native-auth-secret',
 SETUP_TOKEN: 'synthetic-predecessor-native-setup-token',
 OPERATOR_EMAIL: 'owner@penny.invalid',
} as const

// Populated upgrades name their retained native owner explicitly; the default
// belongs to the separate fixture installation bootstrapped below.
export async function nativeOwnerCookie(bindings: AppBindings, currentCookie = '', ownerEmail: string = nativeAuthoritySettings.OPERATOR_EMAIL): Promise<string> {
 let deliveredLink: URL | undefined
 const auth = createOperatorAuth({
  db: bindings.DB,
  config: {
   origin: nativeAuthoritySettings.APP_ORIGIN,
   SESSION_SECRET: nativeAuthoritySettings.AUTH_SECRET,
   SETUP_TOKEN: nativeAuthoritySettings.SETUP_TOKEN,
   OWNER_EMAIL: ownerEmail,
   MAIL_FROM: 'native-fixture@example.test',
   allowList: [ownerEmail],
  },
  // Only the delivery edge is captured. Base creates and consumes the actual
  // one-use sign-in token against the retained installation's authority.
  mailSender: { async send(message) {
   const link = message.text.match(/https:\/\/\S+/)?.[0]
   if (!link) throw new Error('Native fixture mail did not contain a sign-in link')
   deliveredLink = new URL(link)
   return { status: 'accepted', provider: 'test-mail-edge', providerMessageId: message.deliveryId }
  } },
  clientIp: () => '192.0.2.1',
 })
 const handle = createAuthHandler(auth)
 const request = (path: string, body?: unknown) => new Request(nativeAuthoritySettings.APP_ORIGIN + path, {
  method: body === undefined ? 'GET' : 'POST',
  headers: { Origin: nativeAuthoritySettings.APP_ORIGIN, Cookie: currentCookie, 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
 })
 if (currentCookie && (await handle(request('/auth/session')))?.status === 200) return currentCookie
 let response: Response | null
 if (!await bindings.DB.prepare('SELECT id FROM oa_operators LIMIT 1').first()) {
  response = await handle(request('/auth/bootstrap', { token: nativeAuthoritySettings.SETUP_TOKEN, displayName: 'Native fixture owner' }))
 } else {
  const sent = await handle(request('/auth/magic-link', { email: ownerEmail }))
  if (sent?.status !== 202) throw new Error(`Native fixture sign-in mail failed: ${sent?.status}`)
  if (!deliveredLink) throw new Error('Native fixture sign-in was accepted without mail delivery')
  response = await handle(request('/auth/confirm', { token: deliveredLink.searchParams.get('token') }))
 }
 if (response?.status !== 303) throw new Error(`Native fixture sign-in failed: ${response?.status}`)
 const cookie = response.headers.get('Set-Cookie')?.split(';')[0]
 if (!cookie) throw new Error('Native fixture sign-in did not issue a session')
 return cookie
}
