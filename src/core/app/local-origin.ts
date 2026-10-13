import type { AppBindings } from '@/core/shared/bindings'

// A local runtime behind rer's proxy serves the origin rer chose for this run
// (RER_DEV_ORIGIN, an explicit loopback http origin); every other runtime keeps
// its configured APP_ORIGIN.
export function withLocalOrigin(bindings: AppBindings): AppBindings {
  if (bindings.PENNY_ENVIRONMENT !== 'local' || !bindings.RER_DEV_ORIGIN) return bindings
  const local = new URL(bindings.RER_DEV_ORIGIN)
  if (local.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(local.hostname) && local.origin === bindings.RER_DEV_ORIGIN) return { ...bindings, APP_ORIGIN: local.origin }
  return bindings
}
