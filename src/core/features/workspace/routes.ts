import { pagedUpdates } from './update-list'
import { validateListSearch, ListQueryError, type ListEntity } from './list-query'
import { pagedList, pagedModeration } from './paged-service'
import { searchRecords } from './search-repository'
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

  for (const entity of ['evidence','requests','decisions','roadmap','releases','accounts','requesters'] as ListEntity[]) {
    app.get(`/api/operator/${entity}`, async context => {
      try { return context.json(await pagedList(context.get('runtime').database, entity, validateListSearch(context.req.query()))) }
      catch(error) { if(error instanceof ListQueryError)return context.json({error:error.message},400);throw error }
    })
  }
  app.get('/api/operator/moderation', async context => {
    try { return context.json(await pagedModeration(context.get('runtime').database,validateListSearch(context.req.query()))) }
    catch(error) { if(error instanceof ListQueryError)return context.json({error:error.message},400);throw error }
  })
  app.get('/api/operator/roadmap-updates', async context => {
    try { return context.json(await pagedUpdates(context.get('runtime').database,validateListSearch(context.req.query()))) }
    catch(error) { if(error instanceof ListQueryError)return context.json({error:error.message},400);throw error }
  })
  app.get('/api/operator/search', async context => {
    try { return context.json(await searchRecords(context.get('runtime').database,validateListSearch(context.req.query()))) }
    catch(error) { if(error instanceof ListQueryError)return context.json({error:error.message},400);throw error }
  })
  app.get('/api/operator/overview', async (context) => {
    try { return context.json(await workspaceReadService(context.get('runtime').database).getOverview(validateListSearch(context.req.query()))) }
    catch(error) { if(error instanceof ListQueryError)return context.json({error:error.message},400);throw error }
  })
  app.get('/api/operator/decisions/:slug', async (context) => {
    const decision = await workspaceReadService(context.get('runtime').database).findDecision(context.req.param('slug'))
    return decision ? context.json(decision) : context.json({ error: 'not_found' }, 404)
  })
  app.get('/api/operator/releases/:slug', async (context) => {
    const release = await workspaceReadService(context.get('runtime').database).findRelease(context.req.param('slug'))
    return release ? context.json(release) : context.json({ error: 'not_found' }, 404)
  })
  app.get('/api/operator/accounts/:slug', async (context) => {
    const account = await workspaceReadService(context.get('runtime').database).findAccount(context.req.param('slug'))
    return account ? context.json(account) : context.json({ error: 'not_found' }, 404)
  })
}
