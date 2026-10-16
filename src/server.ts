import { withDemo } from '../base/modules/demo/index.mjs'
import {isDeclaredSessionlessPath} from './core/app/public-paths'
import {admitPublicRequest} from './core/app/public-rate'
import {editorDocumentHeaders} from './core/features/editor/headers'
import { runNotificationSchedule } from './core/features/notifications/scheduled'
import { runNotificationQueue } from './core/features/notifications/queue'
import start from '@tanstack/react-start/server-entry'
import { createPennyRuntime } from './core/app/runtime'
import { createPennyApp } from './core/app/worker'
import { pennyRequest, requestContext } from './core/app/request-context.server'
import { withLocalOrigin } from './core/app/local-origin'
import { firstRunDocument } from './core/features/auth/first-run'
import type { AppBindings } from './core/shared/bindings'
import { staticAssetResponse } from './base/static-assets'
import { setupStateResponse } from './base/setup-state'
import { lobbyResponse } from './base/lobby'
import { identity } from './identity'
import { failureSummary } from './core/app/failure-log'
import { seedDemo, withDemoBindings } from './demo'

export default withDemo({
  async queue(batch: MessageBatch<unknown>, bindings: AppBindings): Promise<void> {
    try { await runNotificationQueue(batch, withDemoBindings(bindings)) } catch (error) {
      console.error('Penny queued mail failed', JSON.stringify(failureSummary(error)))
      throw new Error('notification_queue_failed')
    }
  },
  async scheduled(controller: ScheduledController, bindings: AppBindings): Promise<void> {
    try { await runNotificationSchedule(controller, withDemoBindings(bindings)) } catch (error) {
      // The failed invocation stays visible; its log and error carry no values.
      console.error('Penny scheduled work failed', JSON.stringify(failureSummary(error)))
      throw new Error('scheduled_work_failed')
    }
  },
  async fetch(request: Request, bindings: AppBindings, execution: ExecutionContext): Promise<Response> {
    try { return await respond(request, bindings, execution) } catch (error) {
      console.error('Penny request failed', JSON.stringify({ method: request.method, ...failureSummary(error) }))
      return Response.json({ error: 'service_unavailable', message: 'Penny could not complete the requested operation.' }, { status: 503 })
    }
  },
} satisfies ExportedHandler<AppBindings>, { seed: seedDemo })

async function respond(request: Request, bindings: AppBindings, execution: ExecutionContext): Promise<Response> {
  bindings = withLocalOrigin(withDemoBindings(bindings))
  const url = new URL(request.url)
  const configured = bindings.APP_ORIGIN
  if (configured && url.origin !== new URL(configured).origin) return new Response('Not found', { status: 404 })
  if (!configured && !['localhost', '127.0.0.1', 'penny.test'].includes(url.hostname)) return new Response('Not found', { status: 404 })
  const refusal = await admitPublicRequest(request, bindings)
  if (refusal) return refusal
  const asset = isDeclaredSessionlessPath(url.pathname) ? await staticAssetResponse(request, bindings) : null
  if (asset) return editorDocumentHeaders(asset, createPennyRuntime(bindings), url.pathname)
  // Native Base documents use the browser's conventional icon request. Point
  // it at Penny's served mark without changing those copied documents.
  if (url.pathname === '/favicon.ico' && ['GET', 'HEAD'].includes(request.method)) {
    return new Response(null, { status: 302, headers: { location: '/brand/penny-mark.svg' } })
  }
  const operatorDocument = request.method === 'GET' && bindings.RER_DEMO !== '1' && (url.pathname === '/app' || url.pathname.startsWith('/app/')) ? { request } : undefined
  return pennyRequest.run({ bindings, operatorDocument }, async () => {
    const installation = { DB: bindings.DB, AUTH_ORIGIN: createPennyRuntime(bindings, requestContext().configuration).configuration.appOrigin ?? '' }
    const state = await setupStateResponse(request, installation)
    if (state) return editorDocumentHeaders(state, createPennyRuntime(bindings, requestContext().configuration), url.pathname)
    const lobby = await lobbyResponse(request, installation, identity)
    if (lobby) return editorDocumentHeaders(lobby, createPennyRuntime(bindings, requestContext().configuration), url.pathname)
    const setup = await firstRunDocument(request, bindings, requestContext().configuration)
    if (setup) return editorDocumentHeaders(setup, createPennyRuntime(bindings, requestContext().configuration), url.pathname)
    if (url.pathname.startsWith('/_serverFn/')) {
      const origin = request.headers.get('Origin')
      if (origin && origin !== url.origin) return new Response('Forbidden', { status: 403 })
      return start.fetch(request)
    }
    return createPennyApp({ renderDocument: async (document) => start.fetch(document) }).fetch(request, bindings, execution)
  })
}
