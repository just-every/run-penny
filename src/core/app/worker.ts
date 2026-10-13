import { type Context } from 'hono'
import { createPennyApi } from './api'
import { hasOperatorSession } from '@/core/features/auth/operator'
import { portalReadService } from '@/core/features/portal/service'
import { invalidListQuery } from '@/core/features/workspace/list-query'
import type { PennyRuntime } from './runtime'
import { isDeclaredSessionlessPath, isLocalViteModulePath, isPublicAssetPath, isPublicDocumentPath } from './public-paths'
import type { RuntimeConfigurationSource } from '@/core/platform/configuration'
import type { AppBindings } from '@/core/shared/bindings'

type PennyWorkerEnvironment = {
  Bindings: AppBindings
  Variables: {
    runtime: PennyRuntime
    renderDocument?: (request: Request) => Promise<Response>
  }
}

type PennyWorkerContext = Context<PennyWorkerEnvironment>

export interface PennyAppOptions {
  runtimeConfiguration?: RuntimeConfigurationSource
  renderDocument?: (request: Request) => Promise<Response>
}

export function createPennyApp(options: PennyAppOptions = {}) {
  const app = createPennyApi(options)
  app.use('*', async (context, next) => {
    context.set('renderDocument', options.renderDocument)
    await next()
  })

  app.get('/', renderDocument)
  app.all('/portal', (context) => context.redirect('/' + new URL(context.req.url).search, 302))
  app.all('/portal/', (context) => context.redirect('/' + new URL(context.req.url).search, 302))
  app.get('/portal/feedback', renderDocument)
  app.get('/portal/feedback/', renderDocument)
  app.get('/portal/feedback/activity', renderDocument)
  app.get('/portal/feedback/new', renderDocument)
  app.get('/portal/verify', renderDocument)
  app.get('/portal/roadmap', renderDocument)
  app.get('/portal/roadmap/', renderDocument)
  app.get('/portal/updates', renderDocument)
  app.get('/portal/updates/', renderDocument)
  app.get('/portal/feedback/:slug', servePublicRequestDetail)
  app.get('/portal/feedback/:slug/', servePublicRequestDetail)
  app.get('/portal/updates/:slug', servePublicReleaseDetail)
  app.get('/portal/updates/:slug/', servePublicReleaseDetail)
  app.get('/portal/roadmap/:slug', servePublicRoadmapDetail)
  app.get('/portal/roadmap/:slug/', servePublicRoadmapDetail)
  app.get('/portal/*', (context) => renderDocumentWithStatus(context, 404))

  app.all('/app', serveOperatorWorkspace)
  app.all('/app/*', serveOperatorWorkspace)

  app.all('*', async (context) => {
    const pathname = new URL(context.req.url).pathname
    const localViteModule = context.get('runtime').configuration.environment === 'local' && isLocalViteModulePath(pathname)

    if ((!isDeclaredSessionlessPath(pathname) && !localViteModule) || (!isPublicDocumentPath(pathname) && !isPublicAssetPath(pathname) && !localViteModule)) {
      return !pathname.startsWith('/api/') && ['GET','HEAD'].includes(context.req.method) ? renderDocumentWithStatus(context,404) : context.json({ error: 'not_found' }, 404)
    }

    return isPublicDocumentPath(pathname) ? renderDocument(context) : fetchAsset(context)
  })

  return app
}

async function serveOperatorWorkspace(context: PennyWorkerContext) {
  if (context.req.method !== 'GET') {
    return context.json({ error: 'not_found' }, 404)
  }

  const operator = await hasOperatorSession(context.get('runtime'), context.req.raw)
  if (!operator) {
    if (context.req.header('Accept')?.includes('text/html')) {
      return context.redirect('/signin', 302)
    }

    return context.json({ authenticated: false }, 401)
  }

  const response = await renderDocument(context)
  // A list page renders its refusal for a filter or page it does not have; that is the address's fault, not the server's.
  const query = Object.fromEntries(new URL(context.req.url).searchParams)
  return response.status === 500 && invalidListQuery(query) ? new Response(response.body, { status: 400, headers: response.headers }) : response
}

async function renderDocument(context: PennyWorkerContext) {
  const render = context.get('renderDocument')
  if (!render) throw new Error('Missing TanStack Start document handler.')
  const response = await render(context.req.raw)
  const headers = new Headers(response.headers)
  const cache = headers.get('cache-control')
  headers.set('cache-control', [cache, 'no-transform'].filter(Boolean).join(', '))
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

function fetchAsset(context: PennyWorkerContext) {
  if (!context.env.ASSETS || typeof context.env.ASSETS.fetch !== 'function') {
    throw new Error('Missing required ASSETS Fetcher binding.')
  }

  return context.env.ASSETS.fetch(context.req.raw)
}

async function servePublicRequestDetail(context: PennyWorkerContext): Promise<Response> {
  const slug = context.req.param('slug')
  if (!slug) return renderDocumentWithStatus(context, 404)
  const result = await portalReadService(context.get('runtime').database).getRequest(slug)
  if (result.kind === 'redirect') return context.redirect(`/portal/feedback/${result.slug}`,301)
  if (result.kind === 'found') return renderDocument(context)
  return renderDocumentWithStatus(context, result.kind === 'withdrawn' ? 410 : 404)
}

async function servePublicReleaseDetail(context: PennyWorkerContext): Promise<Response> {
  const slug = context.req.param('slug')
  if (!slug) return renderDocumentWithStatus(context, 404)
  const release = await portalReadService(context.get('runtime').database).getRelease(slug)
  return release ? renderDocument(context) : renderDocumentWithStatus(context, 404)
}

async function servePublicRoadmapDetail(context: PennyWorkerContext): Promise<Response> {
  const slug = context.req.param('slug')
  if (!slug) return renderDocumentWithStatus(context, 404)
  const { PublicRoadmapReadRepository } = await import('@/core/features/roadmap/public-read-repository')
  const item = await new PublicRoadmapReadRepository(context.get('runtime').database).find(slug)
  return item ? renderDocument(context) : renderDocumentWithStatus(context, 404)
}

async function renderDocumentWithStatus(context: PennyWorkerContext, status: 404 | 410): Promise<Response> {
  const asset = await renderDocument(context)
  return new Response(asset.body, { status, headers: asset.headers })
}
