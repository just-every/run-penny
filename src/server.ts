import { runNotificationSchedule } from './core/features/notifications/scheduled'
import start from '@tanstack/react-start/server-entry'
import { createPennyApp } from './core/app/worker'
import { pennyRequest, requestContext } from './core/app/request-context.server'
import { withLocalOrigin } from './core/app/local-origin'
import { firstRunDocument } from './core/features/auth/first-run'
import type { AppBindings } from './core/shared/bindings'
import { staticAssetResponse } from './base/static-assets'

export default {
  scheduled: runNotificationSchedule,
  async fetch(request: Request, bindings: AppBindings, execution: ExecutionContext): Promise<Response> {
    const asset = await staticAssetResponse(request, bindings)
    if (asset) return asset
    bindings = withLocalOrigin(bindings)
    const url = new URL(request.url)
    const configured = bindings.APP_ORIGIN
    if (configured && url.origin !== new URL(configured).origin) return new Response('Not found', { status: 404 })
    if (!configured && !['localhost', '127.0.0.1', 'penny.test'].includes(url.hostname)) return new Response('Not found', { status: 404 })
    // Native Base documents use the browser's conventional icon request. Point
    // it at Penny's served mark without changing those copied documents.
    if (url.pathname === '/favicon.ico' && ['GET', 'HEAD'].includes(request.method)) {
      return new Response(null, { status: 302, headers: { location: '/brand/penny-mark.svg' } })
    }
    return pennyRequest.run({ bindings }, async () => {
      const setup = await firstRunDocument(request, bindings, requestContext().configuration)
      if (setup) return setup
      if (url.pathname.startsWith('/_serverFn/')) {
        const origin = request.headers.get('Origin')
        if (origin && origin !== url.origin) return new Response('Forbidden', { status: 403 })
        return start.fetch(request)
      }
      return createPennyApp({ renderDocument: async (document) => start.fetch(document) }).fetch(request, bindings, execution)
    })
  },
} satisfies ExportedHandler<AppBindings>
