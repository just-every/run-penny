import { createOperatorAuth, createAuthHandler, type AuthConfig, type OperatorAuth } from '../../../../base/modules/operator-auth/index.mjs'
import type { Hono } from 'hono'
import type { PennyRuntime } from '@/core/app/runtime'
import type { AppBindings } from '@/core/shared/bindings'
import { authMail } from './mail'
import { auditedIdentityMail } from './mail-audit'
import { createUlid } from '@/core/shared/ulid'
import { NativeError } from './native-tokens'
import branding from '@/branding.json'
import { operatorDocumentReads } from '@/core/app/request-context.server'
import { fontDocumentResponse } from '@/base/font-response'
import { pennyDocumentFonts } from '@/core/ui/brand/font-head'

export interface AuthenticatedOperator { readonly id: string; readonly email: string; readonly displayName: string }
type Environment = { Bindings: AppBindings; Variables: { runtime: PennyRuntime } }
/** Penny's operator-auth configuration; local dev identity reads the same one. */
export function authConfig(runtime: PennyRuntime): AuthConfig {
  const c = runtime.configuration
  if (!c.appOrigin || !c.authSecret || !c.ownerEmail) throw new NativeError('operator_auth_unconfigured', 503)
  const local = ['local','test'].includes(c.environment) && new URL(c.appOrigin).protocol === 'http:'
  return {
    origin: c.appOrigin, OWNER_EMAIL: c.ownerEmail, SESSION_SECRET: c.authSecret,
    INSTALLATION_KEY: runtime.bindings.INSTALLATION_KEY, INSTALLATION_KEY_PREVIOUS: runtime.bindings.INSTALLATION_KEY_PREVIOUS,
    SETUP_TOKEN: c.setupToken, MAIL_FROM: authMail(runtime) ? c.mailFrom : undefined,
    branding: { productName: branding.name, accentColor: branding.accent, signInPath: '/signin', theme: '/rer-theme.css' },
    limitWindowSeconds: 3600, emailLimit: 5, ipLimit: 10, dependencies: true,
    // Persisted native membership is authoritative. Configuration never grants
    // or restores membership, and invitations may name a new email address.
    local,
  }
}
export function operatorAuth(runtime: PennyRuntime): OperatorAuth {
  const c = runtime.configuration
  return createOperatorAuth({ db: runtime.database.binding, config: authConfig(runtime),
  mailSender: auditedIdentityMail(runtime,'operator_magic_link'), clientIp: request => request.headers.get('CF-Connecting-IP') ?? (['local','test'].includes(c.environment) ? 'local' : ''),
  // Penny operators are equals. Base still preserves the last active owner.
  rolePolicy: () => true })
}
export async function hasOperatorSession(runtime: PennyRuntime, request: Request): Promise<boolean> {
  if (!request.headers.get('Cookie')) return false
  return Boolean(await operatorSession(runtime, request))
}

/** Reuse admission only while rendering this incoming app document. APIs and
 * generated functions entered over HTTP always validate their own session. */
export function operatorSession(runtime: PennyRuntime, request: Request) {
  const reads = operatorDocumentReads(request, runtime.bindings)
  const read = () => operatorAuth(runtime).getSession(request)
  return reads ? reads.session ??= read() : read()
}

export async function authenticateOperator(runtime: PennyRuntime, request: Request): Promise<AuthenticatedOperator | null> {
  if (!request.headers.get('Cookie')) return null
  const session = await operatorSession(runtime, request)
  if (!session) return null
  const { email, displayName } = session.operator
  // Product actor foreign keys keep their existing IDs and historical rows.
  let actor = await runtime.database.binding.prepare('SELECT p.id,p.email,p.display_name AS displayName FROM penny_agent_people a JOIN operators p ON p.id=a.actor_id WHERE a.native_operator_id=?').bind(session.operator.id).first<AuthenticatedOperator>()
  if (!actor) {
    const now = new Date().toISOString()
    await runtime.database.binding.prepare('INSERT INTO operators(id,email,display_name,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(email) DO NOTHING').bind(createUlid(),email,displayName,now,now).run()
    actor = await runtime.database.binding.prepare('SELECT id,email,display_name AS displayName FROM operators WHERE email=?').bind(email).first<AuthenticatedOperator>()
  }
  if (!actor) throw new NativeError('operator_auth_unavailable',503)
  await runtime.database.binding.prepare('INSERT INTO penny_agent_people(native_operator_id,actor_id) VALUES(?,?) ON CONFLICT(native_operator_id) DO NOTHING').bind(session.operator.id,actor.id).run()
  return actor
}
export function registerOperatorAuthRoutes(app: Hono<Environment>): void {
  app.all('/auth/*', async c => {
    // Penny has no roles, and review/password entry points are not exposed.
    // The provider routes answer only once the owner has linked an Auth install and enabled it.
    if (!['/auth/session','/auth/confirm','/auth/bootstrap','/auth/magic-link','/auth/signout','/auth/settings/identity','/auth/setup-complete'].includes(c.req.path) && !c.req.path.startsWith('/auth/oidc/')) return c.json({error:'not_found'},404)
    // Base's themed auth documents link only rer-theme.css; Penny's mark sizing lives in fonts.css, as on /setup.
    return pennyDocumentFonts((await fontDocumentResponse(await createAuthHandler(operatorAuth(c.get('runtime')))(c.req.raw)))!)
  })
  app.post('/api/auth/magic-link', async c => forward(c.req.raw, '/auth/magic-link', c.get('runtime')))
  app.post('/api/auth/sign-out', async c => forward(c.req.raw, '/auth/signout', c.get('runtime')))
}
async function forward(request: Request, path: string, runtime: PennyRuntime): Promise<Response> {
  const url = new URL(request.url); url.pathname = path
  return (await createAuthHandler(operatorAuth(runtime))(new Request(url, request)))!
}
