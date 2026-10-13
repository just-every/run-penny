import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterContextProvider } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { RoadmapActions } from '@/core/features/roadmap/ui/roadmap-actions'
import { ReleaseEditor } from '@/core/features/releases/ui/release-editor'
import type { OperatorResourceState } from '@/core/app/ui/operator-resource'
import type { OperatorRoadmapCard } from '@/core/shared/api/operator'

const { resources, retry } = vi.hoisted(() => ({
  resources: new Map<string, OperatorResourceState<unknown>>(), retry: vi.fn(),
}))
vi.mock('@/core/app/ui/operator-resource', () => ({
  useOperatorResource: (path: string) => [resources.get(path) ?? { kind: 'loading' }, retry],
}))
const contextPath = '/api/operator/roadmap/item/context'
const optionsPath = '/api/operator/loop/options'
const evidencePath = '/api/operator/evidence?q=&page=1'
const evidencePage = { items: [{ id: 'linked-evidence', wording: 'Stored evidence' }], total: 2, page: 1, pageSize: 1 }
const item = { id: 'item', status: 'planned' } as OperatorRoadmapCard
const root = createRootRoute()
const routeTree = root.addChildren([createRoute({ getParentRoute: () => root, path: '/signin' })])
const render = (child: ReactNode) => renderToStaticMarkup(
  <RouterContextProvider router={createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ['/'] }) })}>{child}</RouterContextProvider>,
)
beforeEach(() => {
  resources.clear()
  resources.set(contextPath, { kind: 'ready', data: {
    item: { title: 'Internal title', summary: 'Internal summary' },
    evidenceIds: ['linked-evidence', 'offscreen-evidence'], proposed: [{ id: 'request', title: 'Selected request' }],
    mappings: [], publication: null, transitions: [],
  } })
  resources.set(optionsPath, { kind: 'ready', data: { operators: [], decisions: [], bets: [], boards: [], requests: [] } })
  resources.set(evidencePath, { kind: 'ready', data: evidencePage })
})
describe('Auxiliary editing resources', () => {
  it('[ROAD-002][EVID-004] cannot save an evidence replacement while its selector is unavailable', () => {
    resources.set(evidencePath, { kind: 'error', status: 500 })
    const html = render(<RoadmapActions item={item} onSaved={() => {}} />)
    const edit = html.match(/<form[^>]*aria-label="Edit internal record"[\s\S]*?<\/form>/)?.[0]
    expect(edit).toBeDefined()
    expect(edit).toMatch(/<button[^>]*\sdisabled=/)
    expect(edit).toContain('Could not load linked evidence')
    expect(edit).toContain('Try again')
    for (const kind of ['loading', 'not_found', 'session_expired'] as const) {
      resources.set(evidencePath, { kind })
      const unavailable = render(<RoadmapActions item={item} onSaved={() => {}} />)
        .match(/<form[^>]*aria-label="Edit internal record"[\s\S]*?<\/form>/)?.[0]
      expect(unavailable).toMatch(/<button[^>]*\sdisabled=/)
      expect(unavailable).toContain('name="evidenceIds" value="linked-evidence"')
      expect(unavailable).toContain('name="evidenceIds" value="offscreen-evidence"')
    }
    resources.set(evidencePath, { kind: 'ready', data: evidencePage })
    const ready = render(<RoadmapActions item={item} onSaved={() => {}} />)
    expect(ready).toMatch(/type="checkbox" checked=""/)
    expect(ready).toContain('name="evidenceIds" value="linked-evidence"')
    expect(ready).toContain('name="evidenceIds" value="offscreen-evidence"')
    expect(ready).not.toMatch(/<button[^>]*\sdisabled=/)
  })
  for (const path of [contextPath, optionsPath]) {
    it(`[ROAD-002][BASE-OPS-004] reports failure and retry for ${path}`, () => {
      resources.set(path, { kind: 'error', status: 500 })
      const html = render(<RoadmapActions item={item} onSaved={() => {}} />)
      expect(html).toContain('Could not load editing options')
      expect(html).toContain('Try again')
      expect(html).not.toContain('Loading editing options')
    })
    it(`[BASE-ACCESS-002] shows expired editing admission for ${path}`, () => {
      resources.set(path, { kind: 'session_expired' })
      expect(render(<RoadmapActions item={item} onSaved={() => {}} />)).toContain('Your operator session has expired')
    })
  }
  it('[REL-001][BASE-OPS-004] reports release option failure and retry rather than permanent loading', () => {
    resources.set('/api/operator/releases/options', { kind: 'error', status: 500 })
    const html = render(<ReleaseEditor onSaved={() => {}} />)
    expect(html).toContain('Could not load release choices')
    expect(html).toContain('Try again')
    expect(html).not.toContain('Loading release choices')
    expect(html).toMatch(/<button[^>]*\sdisabled=/)
  })
  it('[REL-001][BASE-ACCESS-002] shows expired release admission', () => {
    resources.set('/api/operator/releases/options', { kind: 'session_expired' })
    expect(render(<ReleaseEditor onSaved={() => {}} />)).toContain('Your operator session has expired')
  })
  it('[ROAD-004] renders the selected bet request suggestion before any mapping is checked', () => {
    expect(render(<RoadmapActions item={item} onSaved={() => {}} />)).toContain('Suggestions from the selected bet: Selected request')
  })
})
