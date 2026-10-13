import type { Hono } from 'hono'
import type { PennyRuntime } from '@/core/app/runtime'
import type { AppBindings } from '@/core/shared/bindings'
import { verifyHealth } from './service'
import { deploymentHealth } from '@/base/deployment-health'

interface HealthRouteEnvironment {
  Bindings: AppBindings
  Variables: {
    runtime: PennyRuntime
  }
}

export function registerHealthRoutes(app: Hono<HealthRouteEnvironment>): void {
  app.get('/health', async (context) => {
    const runtime = context.get('runtime')
    await verifyHealth(runtime)

    return context.json({ status: 'ok', ...deploymentHealth(context.env) })
  })
}
