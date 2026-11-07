import type { Hono } from 'hono'
import type { OperatorMutationEnvironment } from '@/core/app/operator-mutations'
import { integrationOpenApi } from '../integrations/openapi/document'

export function registerOpenApiRoute(app: Hono<OperatorMutationEnvironment>) {
  app.get('/docs/openapi.json', context => {
    context.header('Cache-Control', 'no-store')
    context.header('X-Content-Type-Options', 'nosniff')
    return context.json(integrationOpenApi)
  })
}
