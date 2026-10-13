import type { Hono } from 'hono'
import type { PennyRuntime } from '@/core/app/runtime'
import { hasOperatorSession } from '@/core/features/auth/operator'
import type { AppBindings } from '@/core/shared/bindings'
import { workspaceReadService } from './service'

interface WorkspaceRouteEnvironment {
  Bindings: AppBindings
  Variables: { runtime: PennyRuntime }
}

export function registerWorkspaceReadRoutes(app: Hono<WorkspaceRouteEnvironment>): void {
  app.use('/api/operator/*', async (context, next) => {
    if (!await hasOperatorSession(context.get('runtime'), context.req.raw)) return context.json({ authenticated: false }, 401)
    await next()
  })

  app.get('/api/operator/overview', async (context) => {
    return context.json(await workspaceReadService(context.get('runtime').database).getOverview())
  })
  app.get('/api/operator/evidence', async (context) => context.json(await workspaceReadService(context.get('runtime').database).listEvidence()))
  app.get('/api/operator/requests', async (context) => context.json(await workspaceReadService(context.get('runtime').database).listRequests()))
  app.get('/api/operator/decisions', async (context) => context.json(await workspaceReadService(context.get('runtime').database).listDecisions()))
  app.get('/api/operator/decisions/:slug', async (context) => {
    const decision = await workspaceReadService(context.get('runtime').database).findDecision(context.req.param('slug'))
    return decision ? context.json(decision) : context.json({ error: 'not_found' }, 404)
  })
  app.get('/api/operator/roadmap', async (context) => context.json(await workspaceReadService(context.get('runtime').database).listRoadmap()))
  app.get('/api/operator/releases', async (context) => context.json(await workspaceReadService(context.get('runtime').database).listReleases()))
  app.get('/api/operator/releases/:slug', async (context) => {
    const release = await workspaceReadService(context.get('runtime').database).findRelease(context.req.param('slug'))
    return release ? context.json(release) : context.json({ error: 'not_found' }, 404)
  })
  app.get('/api/operator/accounts', async (context) => context.json(await workspaceReadService(context.get('runtime').database).listAccounts()))
  app.get('/api/operator/accounts/:slug', async (context) => {
    const account = await workspaceReadService(context.get('runtime').database).findAccount(context.req.param('slug'))
    return account ? context.json(account) : context.json({ error: 'not_found' }, 404)
  })
}
