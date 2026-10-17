import { getRequest } from '@tanstack/react-start/server'
import { redirect } from '@tanstack/react-router'
import { createPennyApi } from './api'
import { requestContext } from './request-context.server'
import { createPennyRuntime } from './runtime'
import { hasOperatorSession } from '@/core/features/auth/operator'
import { operatorNeedsFirstRun } from '@/core/features/auth/first-run'
import { failureSummary } from './failure-log'
import { operatorSnapshot } from './operator-snapshot.server'

export type Json = null | boolean | string | number | Json[] | { [key: string]: Json }
export type Resources = Record<string, { status: number; data: Json }>

async function read(paths: string[]): Promise<Resources> {
  const { bindings, configuration } = requestContext()
  const incoming = getRequest()
  const api = createPennyApi({ runtimeConfiguration: configuration })
  return Object.fromEntries(await Promise.all(paths.map(async (path) => {
    const response = await api.fetch(new Request(new URL(path, incoming.url), { headers: incoming.headers }), bindings)
    return [path, { status: response.status, data: await response.json() as Json }]
  })))
}

async function signInResources(): Promise<Resources> {
  const { bindings, configuration } = requestContext(), incoming = getRequest()
  const api = createPennyApi({ runtimeConfiguration: configuration })
  const [capabilities, session] = await Promise.all([
    read(['/api/auth/capabilities']),
    api.fetch(new Request(new URL('/api/auth/session', incoming.url), { method: 'HEAD', headers: incoming.headers }), bindings),
  ])
  // Expose only admission status here, never the operator identity on a public document.
  return { ...capabilities, '/api/auth/session': { status: session.status, data: { authenticated: session.status === 200 } } }
}

export function publicResources(href: string): Promise<Resources> {
  const url = new URL(href, 'https://document.invalid')
  const path = url.pathname.replace(/\/$/, '') || '/'
  if (path === '/signin') return signInResources()
  if (path === '/' || path === '/portal/feedback') {
    const query = new URLSearchParams()
    const q = url.searchParams.get('q')?.trim()
    const status = url.searchParams.get('status')
    if (q) query.set('q', q)
    if (status) query.set('status', status)
    const board = url.searchParams.get('board')?.trim()
    const sort = url.searchParams.get('sort')
    if (board) query.set('board', board)
    if (sort === 'votes' || sort === 'recent') query.set('sort', sort)
    return read([`/api/public/requests${query.size ? `?${query}` : ''}`, '/api/public/boards'])
  }
  if (path === '/portal/feedback/new') return read(['/api/public/boards', '/api/auth/capabilities'])
  if (/^\/portal\/roadmap\/[a-z0-9-]+$/.test(path)) return read([path.replace('/portal/roadmap/', '/api/public/roadmap/')])
  if (path === '/portal/roadmap') return read(['/api/public/roadmap', '/api/public/roadmap/settings'])
  if (path === '/portal/updates') return read(['/api/public/releases'])
  if (/^\/portal\/feedback\/[a-z0-9-]+$/.test(path) && path !== '/portal/feedback/new') return read([path.replace('/portal/feedback/', '/api/public/requests/')])
  if (/^\/portal\/updates\/[a-z0-9-]+$/.test(path)) return read([path.replace('/portal/updates/', '/api/public/releases/')])
  return Promise.resolve({})
}

export async function operatorResources(href: string): Promise<Resources> {
  const { bindings, configuration } = requestContext()
  let operator, setup
  try {
    const runtime = createPennyRuntime(bindings, configuration), incoming = getRequest()
    operator = await hasOperatorSession(runtime, incoming)
    // Client-side navigation reaches an app route without a document request, so setup is checked here as well.
    setup = operator && await operatorNeedsFirstRun(incoming, runtime)
  } catch (error) {
    console.error('Penny session validation failed', JSON.stringify(failureSummary(error)))
    throw new Error('Penny could not validate the operator session.')
  }
  if (!operator) throw redirect({ to: '/signin' })
  if (setup) throw redirect({ href: '/setup', reloadDocument: true })
  const operatorUrl = new URL(href, 'https://document.invalid')
  const path = operatorUrl.pathname.replace(/\/$/, '')
  const routes: Record<string, string> = { '/app': 'overview', '/app/overview': 'overview', '/app/feedback': 'evidence', '/app/moderation': 'moderation', '/app/decisions': 'decisions', '/app/roadmap': 'roadmap', '/app/releases': 'releases', '/app/customers': operatorUrl.searchParams.get('directory') === 'requesters' ? 'requesters' : 'accounts', '/app/search': 'search', '/app/learning': 'learning' }
  const route = routes[path]
  if (path === '/app/settings') return operatorSnapshot(operatorUrl,'/api/operator/catalog/settings',read)
  if (path === '/app/data') return operatorSnapshot(operatorUrl,'/api/operator/data/overview',read)
  if (route) return operatorSnapshot(operatorUrl,`/api/operator/${route}${route==='learning'?'':operatorUrl.search}`,read)
  const match = /^\/app\/(decisions|releases|customers)\/([a-z0-9-]+)$/.exec(path)
  return operatorSnapshot(operatorUrl,match ? `/api/operator/${match[1] === 'customers' ? 'accounts' : match[1]}/${match[2]}` : undefined,read)
}
