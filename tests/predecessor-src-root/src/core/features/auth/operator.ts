// Predecessor-only authentication for the unchanged pre-Base assertion/fixture suite.
// The actual current board routes run with this historical credential transport.
import type { PennyRuntime } from '@/core/app/runtime'
import { authenticateOperator as legacyAuthenticate } from './service'
import { readOperatorSessionToken } from './session'
import { registerNativeAuthRoutes } from './native-routes'
export function authenticateOperator(runtime: PennyRuntime, request: Request) {
  return legacyAuthenticate(runtime, readOperatorSessionToken(request.headers.get('Cookie')))
}
export { type AuthenticatedOperator } from './service'
export const registerOperatorAuthRoutes = registerNativeAuthRoutes

export async function hasOperatorSession(runtime: PennyRuntime, request: Request): Promise<boolean> {
 return Boolean(await authenticateOperator(runtime, request))
}
