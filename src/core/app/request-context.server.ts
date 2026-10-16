import { AsyncLocalStorage } from 'node:async_hooks'
import type { AppBindings } from '@/core/shared/bindings'
import type { RuntimeConfigurationSource } from '@/core/platform/configuration'
import type { Session } from '../../../base/modules/operator-auth/index.mjs'

interface OperatorDocumentReads {
  readonly request: Request
  session?: Promise<Session | null>
  firstRun?: Promise<boolean>
}

export const pennyRequest = new AsyncLocalStorage<{ bindings: AppBindings; configuration?: RuntimeConfigurationSource; operatorDocument?: OperatorDocumentReads }>()

/** Only a single read-only app document may share admission with its internal reads. */
export function operatorDocumentReads(request: Request, bindings: AppBindings): OperatorDocumentReads | undefined {
  const context = pennyRequest.getStore(), reads = context?.operatorDocument
  if (!reads || context?.bindings !== bindings || request.method !== 'GET') return undefined
  if (new URL(request.url).origin !== new URL(reads.request.url).origin) return undefined
  // Internal API Requests copy the incoming headers. Do not share authority if
  // any admission input changes, including the local development key gate.
  for (const name of ['cookie', 'host', 'x-rer-dev-key']) {
    if (request.headers.get(name) !== reads.request.headers.get(name)) return undefined
  }
  return reads
}

export function requestContext() {
  const context = pennyRequest.getStore()
  if (!context) throw new Error('Penny request context is missing.')
  return context
}
