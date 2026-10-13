import { registerOperatorReadFlows } from './operator-read-flows'
import { applyD1Migrations, reset } from 'cloudflare:test'
import { beforeEach, expect, inject, it } from 'vitest'
import { env, call, owner } from './support'
import type { WorkspaceOverviewDto } from '../../src/core/features/workspace/overview-dto'
import { seedOverviewAttention } from '../browser/operator-pages-data.mjs'

beforeEach(async () => { await reset(); await applyD1Migrations(env.DB, inject('migrations')) })
it('[DEC-001 EVID-003 ROAD-007 ROAD-008 REL-001 REQ-014] overview retains context and reports real actionable records', async () => {
  const cookie = await owner()
  const empty = await (await call('/api/operator/overview', undefined, cookie)).json() as WorkspaceOverviewDto
  expect(empty).toMatchObject({ boardCount: 0, awaitingModeration: [], unpublishedStatusUpdates: [], shippedWithoutRelease: [], decisions: [], unreviewedEvidence: [], roadmap: [], recentReleases: [] })
  await seedOverviewAttention(env.DB)
  const populated = await (await call('/api/operator/overview', undefined, cookie)).json() as WorkspaceOverviewDto
  expect(populated.boardCount).toBe(1)
  expect(populated.awaitingModeration.map((row) => row.slug)).toEqual(['attention-request'])
  expect(populated.unreviewedEvidence.map((row) => row.id)).toEqual(['attention-evidence'])
  expect(populated.decisions.map((row) => row.slug)).toEqual(['attention-decision'])
  expect(populated.unpublishedStatusUpdates.map((row) => row.id)).toEqual(['attention-update'])
  expect(populated.shippedWithoutRelease.map((row) => row.slug)).toEqual(['attention-shipped'])
  expect(populated.roadmap.map((row) => row.slug)).toEqual(['attention-planned'])
  expect(populated.recentReleases.map((row) => row.slug)).toEqual(['attention-published-release'])
  await env.DB.prepare("UPDATE roadmap_publications SET withdrawn_at=? WHERE roadmap_item_id='attention-planned'").bind(new Date().toISOString()).run()
  expect((await (await call('/api/operator/overview',undefined,cookie)).json() as WorkspaceOverviewDto).unpublishedStatusUpdates).toEqual([])
  await env.DB.prepare("UPDATE releases SET state='published',published_at=? WHERE id='attention-draft-release'").bind(new Date().toISOString()).run()
  expect((await (await call('/api/operator/overview',undefined,cookie)).json() as WorkspaceOverviewDto).shippedWithoutRelease).toEqual([])
})

registerOperatorReadFlows()
