import type { Hono } from 'hono'
import type { PennyRuntime } from '@/core/app/runtime'
import type { AppBindings } from '@/core/shared/bindings'
import { authenticateOperator } from './operator'

interface AuthRouteEnvironment {
  Bindings: AppBindings
  Variables: {
    runtime: PennyRuntime
  }
}

export async function currentOperator(context: {
  req: { raw: Request }
  get(key: 'runtime'): PennyRuntime
}) {
  return authenticateOperator(context.get('runtime'), context.req.raw)
}

export function registerAuthRoutes(app: Hono<AuthRouteEnvironment>): void {
  app.get('/api/auth/session', async (context) => {
    const operator = await currentOperator(context)

    if (!operator) {
      return context.json({ authenticated: false }, 401)
    }

    return context.json({ authenticated: true, operator })
  })
}
