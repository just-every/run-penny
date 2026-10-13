import {editorDocumentHeaders} from '@/core/features/editor/headers'
import { type Context } from 'hono'
import { createPennyApi } from './api'
import { hasOperatorSession } from '@/core/features/auth/operator'
import { portalReadService } from '@/core/features/portal/service'
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

/** The public board's search, status, board and sort parameters, from when the board was served at `/`. */
const oldBoardParameters = ['q', 'status', 'board', 'sort']

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

  // REQ-001: the board used to live at `/`, so a shared board link (`/?q=…`, `status`, `board` or `sort`) still reaches it
  // with the same query. Plain `/` is the product landing (HOME-002).
  app.get('/', async (context, next) => {
    const url = new URL(context.req.url)
    if (oldBoardParameters.some((name) => url.searchParams.has(name))) return context.redirect(`/portal/feedback${url.search}`, 302)
    await next()
  })
  app.all('/portal', (context) => context.redirect('/portal/feedback', 302))
  app.all('/portal/', (context) => context.redirect('/portal/feedback', 302))
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
  app.get('/portal/updates/:slug', servePublicReleaseDetail)
  app.get('/portal/roadmap/:slug',async context=>{
    const {PublicRoadmapReadRepository}=await import('@/core/features/roadmap/public-read-repository')
    const item=await new PublicRoadmapReadRepository(context.get('runtime').database).find(context.req.param('slug'))
    return item?renderDocument(context):renderDocumentWithStatus(context,404)
  })
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

  return renderDocument(context)
}

async function renderDocument(context: PennyWorkerContext) {
  const render = context.get('renderDocument')
  if (!render) throw new Error('Missing TanStack Start document handler.')
  return editorDocumentHeaders(await render(context.req.raw),context.get('runtime'),new URL(context.req.url).pathname)
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

async function renderDocumentWithStatus(context: PennyWorkerContext, status: 404 | 410): Promise<Response> {
  const asset = await renderDocument(context)
  return new Response(asset.body, { status, headers: asset.headers })
}
