import { createPennyRuntime } from '@/core/app/runtime'
import { withLocalOrigin } from '@/core/app/local-origin'
import type { AppBindings } from '@/core/shared/bindings'
import { authConfig } from './operator'

type DevBindings = AppBindings & { RER_DEV_KEY?: string; RER_DEV_IDENTITY?: string; AUTH_ORIGIN?: string; AUTH_LOCAL?: string }

// The dev layer reads Base's AUTH_ORIGIN/AUTH_LOCAL names; Penny's are its
// APP_ORIGIN (with this run's local origin) and PENNY_ENVIRONMENT.
export function devBindings(original: DevBindings): DevBindings {
  const env = withLocalOrigin(original)
  const local = env.PENNY_ENVIRONMENT === 'local' && Boolean(env.APP_ORIGIN?.startsWith('http:'))
  return { ...env, AUTH_ORIGIN: env.APP_ORIGIN, AUTH_LOCAL: local ? 'true' : 'false' }
}
export const devAuthConfig = (env: DevBindings) => authConfig(createPennyRuntime(env))
