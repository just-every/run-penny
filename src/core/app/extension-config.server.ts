import { runtimeConfiguration } from '@/ext/config.server'
import { loadRuntimeConfiguration, type RuntimeConfiguration } from '@/core/platform/configuration'
import type { AppBindings } from '@/core/shared/bindings'

/**
 * Server mount for buyer-owned runtime configuration. Keeping this import out
 * of the client mount prevents operator and origin policy from entering the
 * browser bundle.
 */
export function getRuntimeConfiguration(env: AppBindings): RuntimeConfiguration {
  return loadRuntimeConfiguration(runtimeConfiguration, env)
}
