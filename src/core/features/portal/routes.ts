import type { Hono } from 'hono'
import { z } from 'zod'
import type { PennyRuntime } from '@/core/app/runtime'
import type { AppBindings } from '@/core/shared/bindings'
import { portalReadService } from './service'

interface PortalRouteEnvironment {
  Bindings: AppBindings
  Variables: { runtime: PennyRuntime }
}

const publicRequestFiltersSchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  board: z.string().trim().min(1).max(128).optional(),
  status: z.enum(['open', 'under_review', 'planned', 'in_progress', 'shipped', 'declined']).optional(),
  sort: z.enum(['recent', 'votes']).optional(),
}).strict()

const publicSlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase kebab-case').max(128)

export function registerPortalRoutes(app: Hono<PortalRouteEnvironment>): void {
  app.get('/api/public/boards', async (context) => context.json(await portalReadService(context.get('runtime').database).listBoards()))
  app.get('/api/public/requests', async (context) => {
    const filters = publicRequestFiltersSchema.safeParse(Object.fromEntries(Object.entries(context.req.query()).filter(([,value])=>value!=='')))
    if (!filters.success) return context.json({ error: 'validation_failed', message: 'Invalid public request filters.' }, 400)
    return context.json(await portalReadService(context.get('runtime').database).listRequests(filters.data))
  })
  app.get('/api/public/requests/:slug', async (context) => {
    const slug = publicSlugSchema.safeParse(context.req.param('slug'))
    if (!slug.success) return context.json({ error: 'validation_failed', message: 'Invalid public request slug.' }, 400)
    const result = await portalReadService(context.get('runtime').database).getRequest(slug.data)
    if (result.kind === 'redirect') return context.redirect(`/api/public/requests/${result.slug}`,301)
    if (result.kind === 'found') return context.json(result.request)
    return result.kind === 'withdrawn' ? context.json({ error: 'withdrawn' }, 410) : context.json({ error: 'not_found' }, 404)
  })
  app.get('/api/public/roadmap', async (context) => context.json(await portalReadService(context.get('runtime').database).listRoadmap()))
  app.get('/api/public/releases', async (context) => context.json(await portalReadService(context.get('runtime').database).listReleases()))
  app.get('/api/public/releases/:slug', async (context) => {
    const slug = publicSlugSchema.safeParse(context.req.param('slug'))
    if (!slug.success) return context.json({ error: 'validation_failed', message: 'Invalid public release slug.' }, 400)
    const release = await portalReadService(context.get('runtime').database).getRelease(slug.data)
    return release ? context.json(release) : context.json({ error: 'not_found' }, 404)
  })
}
