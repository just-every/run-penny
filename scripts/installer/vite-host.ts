import { statSync } from 'node:fs'
import { join } from 'node:path'
import { isFileLoadingAllowed, normalizePath, type Plugin, type ResolvedConfig } from 'vite'

/** A file Vite's fs check would refuse: any /@fs/ path outside the allow list, and an
 * existing file outside it requested from the root or as an absolute /@id/. Any other
 * missing path is the application's own (or a virtual module), so it is left alone. */
function refusedFile(config: ResolvedConfig, url: string): boolean {
  let path = url.split(/[?#]/)[0]
  try { path = decodeURIComponent(path) } catch { return false }
  const fsPath = /^\/@fs(\/.*)$/.exec(path)?.[1]
  if (fsPath !== undefined) return !isFileLoadingAllowed(config, normalizePath(fsPath))
  const file = normalizePath(path.startsWith('/@id/') ? path.slice('/@id'.length) : join(config.root, path))
  return !isFileLoadingAllowed(config, file) && (statSync(file, { throwIfNoEntry: false })?.isFile() ?? false)
}

// Vite otherwise answers foreign hosts before the Worker can return its 404.
// The shared local runner binds one explicit loopback address and port.
export function localHostAdmission(): Plugin {
  return {
    name: 'penny-local-host', enforce: 'pre', apply: 'serve',
    config(config, { command }) {
      // Vite's hostname-only 403 check precedes configureServer middleware.
      // Delegate only the explicit loopback runner to this stricter 404 gate.
      if (command === 'serve' && config.server?.host === '127.0.0.1') return { server: { allowedHosts: true } }
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const address = server.httpServer?.address()
        const host = server.config.server.host
        // The managed CLI calls Cloudflare's native scheduled handler directly
        // on this loopback listener. Its public proxy refuses every /cdn-cgi
        // path, while application requests retain the configured public Host.
        const internalSchedule = host === '127.0.0.1' && address && typeof address !== 'string'
          && request.headers.host === `${host}:${address.port}` && request.method === 'GET'
          && request.headers.origin === undefined && request.headers['sec-fetch-site'] === undefined
          && request.url?.split('?')[0] === '/cdn-cgi/handler/scheduled'
        if (host === '127.0.0.1' && address && typeof address !== 'string' && !internalSchedule && request.headers.host !== new URL(process.env.RER_DEV_ORIGIN ?? `http://${host}:${address.port}`).host) {
          response.writeHead(404, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' })
          response.end('Not found')
          return
        }
        // Vite refuses such a file with a 403 page that names the checkout path and the
        // allow list, and a missing file falls through, so the status told whether it
        // existed. Steer Vite's file middlewares past it: the Cloudflare plugin serves
        // the original URL, so the Worker answers exactly as for a missing file.
        if (request.url && refusedFile(server.config, request.url)) request.url = '/.penny-not-served'
        next()
      })
    },
  }
}
