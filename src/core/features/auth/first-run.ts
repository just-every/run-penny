import { firstRunResponse, needsFirstRun } from '@/base/setup'
import { createPennyRuntime, type PennyRuntime } from '@/core/app/runtime'
import type { RuntimeConfigurationSource } from '@/core/platform/configuration'
import type { AppBindings } from '@/core/shared/bindings'
import { operatorAuth } from './operator'
import branding from '@/branding.json'
import { pennyDocumentFonts } from '@/core/ui/brand/font-head'

// Base's first-run runtime owns /setup and the redirect to it. Penny supplies its native owner session,
// its database and the configured origin; the runtime keeps the check, the document and the guarded POST.
function boundary(runtime: PennyRuntime) {
  return {
    bindings: { DB: runtime.bindings.DB, AUTH_ORIGIN: runtime.configuration.appOrigin ?? '' },
    auth: { getSession: (request: Request) => request.headers.get('Cookie') ? operatorAuth(runtime).getSession(request) : Promise.resolve(null) },
  }
}

/** The /setup document and POST, and the redirect to /setup from every /app document; null for any other request. */
export function firstRunDocument(request: Request, bindings: AppBindings, configuration?: RuntimeConfigurationSource): Promise<Response | null> {
  const path = new URL(request.url).pathname
  if (path !== '/setup' && path !== '/app' && !path.startsWith('/app/')) return Promise.resolve(null)
  const { bindings: setup, auth } = boundary(createPennyRuntime(bindings, configuration))
  return firstRunResponse(request, setup, auth, { theme: { href: '/rer-theme.css', productName: branding.name, accentColor: branding.accent } }).then(response => response ? pennyDocumentFonts(response) : null)
}

/** True for a signed-in owner whose first-run setup is unfinished. */
export async function operatorNeedsFirstRun(request: Request, runtime: PennyRuntime): Promise<boolean> {
  const { bindings, auth } = boundary(runtime)
  const session = await auth.getSession(request)
  return session ? needsFirstRun(bindings, session) : false
}
