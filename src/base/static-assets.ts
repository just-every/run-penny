// A hosted deploy runs this Worker before its static assets (rer deploy sets
// assets.run_worker_first), so built files reach the browser only when the
// Worker hands them to env.ASSETS. Call this first in the entry's fetch.
type AssetBindings = { ASSETS?: { fetch(request: Request): Promise<Response> } }

/**
 * Answer a GET or HEAD for a built file (a path whose last segment has an
 * extension) from env.ASSETS. Returns null on a miss and for every other
 * request, so app routes and documents keep their own handling. Private paths
 * are never looked up: dot segments (.rer, .seed, .well-known, .dev.vars,
 * .assetsignore), /exports/, /__dev/ and *.rer archives.
 */
export async function staticAssetResponse(request: Request, env: AssetBindings): Promise<Response | null> {
  if (!env.ASSETS || (request.method !== 'GET' && request.method !== 'HEAD')) return null
  let path: string
  try { path = decodeURIComponent(new URL(request.url).pathname) } catch { return null }
  const segments = path.split('/').slice(1)
  const name = segments.at(-1) ?? ''
  if (!/.\.[A-Za-z0-9]+$/.test(name) || path.includes('\\') || path.includes('\0')) return null
  if (segments.some(segment => segment.startsWith('.')) || ['exports', '__dev'].includes(segments[0]) || name.endsWith('.rer')) return null
  const response = await env.ASSETS.fetch(request)
  if (response.status === 404) { await response.body?.cancel(); return null }
  return response
}
