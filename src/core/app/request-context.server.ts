import { AsyncLocalStorage } from 'node:async_hooks'
import type { AppBindings } from '@/core/shared/bindings'
import type { RuntimeConfigurationSource } from '@/core/platform/configuration'

export const pennyRequest = new AsyncLocalStorage<{ bindings: AppBindings; configuration?: RuntimeConfigurationSource }>()
export function requestContext() {
  const context = pennyRequest.getStore()
  if (!context) throw new Error('Penny request context is missing.')
  return context
}
