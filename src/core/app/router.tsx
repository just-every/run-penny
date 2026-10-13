import { createRouter } from '@tanstack/react-router'
import { routeTree } from '../../routeTree.gen'

// Search values stay the plain text the address carries, exactly as the server
// reads them, so "2024" or "1.0" is searched as typed rather than as JSON.
function parseSearch(search: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(search))
}
function stringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) if (value !== undefined && value !== null) params.set(key, String(value))
  return params.size ? `?${params}` : ''
}

export function getRouter() {
  return createRouter({ routeTree, defaultPreload: 'intent', scrollRestoration: true, parseSearch, stringifySearch })
}

declare module '@tanstack/react-router' {
  interface Register { router: ReturnType<typeof getRouter> }
}
