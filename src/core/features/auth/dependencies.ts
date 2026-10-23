import { createDependencies } from '../../../../base/modules/dependencies/index.mjs'
import type { Hono } from 'hono'
import type { AppBindings } from '@/core/shared/bindings'
import type { PennyRuntime } from '@/core/app/runtime'
import { authConfig, operatorAuth } from './operator'
import branding from '@/branding.json'

type Environment = { Bindings: AppBindings; Variables: { runtime: PennyRuntime } }

/** Base's pull-link protocol, so an Auth install can offer single sign-on. The optional
 * `oidc-provider@1` dependency stays off until the owner supplies IDENTITY_PROVIDER and
 * approves the link; email links keep working throughout. */
export function registerDependencyRoutes(app: Hono<Environment>): void {
  app.all('/.well-known/rer-dependencies', handle)
  app.all('/.well-known/rer-link/*', handle)
  app.all('/auth/dependencies/*', handle)
}

async function handle(context: { req: { raw: Request }; get(key: 'runtime'): PennyRuntime }): Promise<Response> {
  const runtime = context.get('runtime'), config = authConfig(runtime)
  const dependencies = createDependencies({ db: runtime.database.binding, origin: config.origin, name: branding.name, provider: runtime.bindings.IDENTITY_PROVIDER || undefined, local: config.local, INSTALLATION_KEY: config.INSTALLATION_KEY, INSTALLATION_KEY_PREVIOUS: config.INSTALLATION_KEY_PREVIOUS, auth: operatorAuth(runtime) })
  return (await dependencies.handle(context.req.raw)) ?? new Response('Not found', { status: 404 })
}
