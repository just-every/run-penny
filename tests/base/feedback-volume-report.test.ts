import { applyD1Migrations, reset } from 'cloudflare:test'
import { afterEach, expect, inject, it, vi } from 'vitest'
import type { VolumeReport } from '@/core/features/reports/reader'
import { call, env, mockMail, owner, requester } from './support'
import { explicitConsentBoard } from './explicit-consent-board'

afterEach(() => vi.restoreAllMocks())
const door = '/api/operator/reports/feedback-volume'
const from = '2026-10-01T00:00:00.000Z', to = '2026-10-04T00:00:00.000Z'
const filter = (start = from, end = to) => '?' + new URLSearchParams({ from: start, to: end })
async function json<T>(response: Promise<Response>, status = 200): Promise<T> {
  const result = await response
  expect(result.status, await result.clone().text()).toBe(status)
  return result.json() as Promise<T>
}
// Parse the actual downloaded document, including quoted commas, quotes and newlines.
function csvRows(text: string) {
  const rows: string[][] = [], row: string[] = []
  let value = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++ } else quoted = !quoted
    } else if (!quoted && (char === ',' || char === '\r')) {
      row.push(value); value = ''
      if (char === '\r') { expect(text[++i]).toBe('\n'); rows.push([...row]); row.length = 0 }
    } else value += char
  }
  expect(quoted).toBe(false); expect(value).toBe(''); expect(row).toEqual([])
  return rows
}

it('native feedback volume reconciles private JSON and CSV windows without multiplying linked records', async () => {
  await reset(); await applyD1Migrations(env.DB, inject('migrations')); mockMail()
  const operator = await owner(), person = await requester('synthetic-penny-1')
  const boardName = '=synthetic-penny-2,"private"\nboard'
  for (const [slug, name, visibility] of [['volume-public', 'Public board', 'public'], ['volume-private', boardName, 'internal']]) {
    await json(call('/api/operator/boards', { name, slug, visibility }, operator), 201)
  }
  await explicitConsentBoard('volume-public', (path, method, body) => call(path, body, operator, method))
  const boards = await env.DB.prepare("SELECT id,slug FROM boards WHERE slug LIKE 'volume-%'").all<{ id: string; slug: string }>()
  const boardId = (slug: string) => boards.results.find(board => board.slug === slug)!.id
  const a = { boardId: boardId('volume-public'), boardSlug: 'volume-public', boardName: 'Public board', count: 2 }
  const b = { boardId: boardId('volume-private'), boardSlug: 'volume-private', boardName, count: 1 }
  const requests: { id: string; slug: string }[] = []
  // Every record enters through a native route; only historical fixture timestamps
  // are backdated, independently of the implementation and the current auth clock.
  for (const [index, boardSlug, at] of [
    [0, 'volume-public', '2026-09-30T23:59:59.999Z'],
    [1, 'volume-public', from],
    [2, 'volume-public', '2026-10-02T00:59:59.999+01:00'],
    [3, 'volume-private', '2026-10-03T00:00:00.000Z'],
    [4, 'volume-private', to],
  ] as const) {
    const request = await json<{ id: string; slug: string }>(call('/api/operator/requests', {
      title: `synthetic-penny-${index + 10}`, description: 'Private native request marker', boardSlug,
    }, operator), 201)
    requests.push(request)
    await env.DB.prepare('UPDATE requests SET created_at=? WHERE id=?').bind(at, request.id).run()
  }
  const evidence: { id: string; versionId: string }[] = []
  for (const [sourceType, at] of [
    ['interview', '2026-09-30T23:59:59.999Z'], ['interview', from],
    ['email', '2026-10-02T01:00:00+01:00'], ['interview', '2026-10-03T23:59:59.999Z'], ['email', to],
  ] as const) {
    const record = await json<{ id: string; versionId: string }>(call('/api/operator/evidence', {
      sourceType, sourceLabel: 'synthetic-penny-private-source', wording: 'synthetic-penny-private-evidence',
      observedAt: '2020-01-01T00:00:00Z', requestLinks: requests.slice(1, 4).map(row => ({ id: row.id, stance: 'supporting' })),
    }, operator), 201)
    evidence.push(record)
    await env.DB.prepare('UPDATE evidence_items SET created_at=? WHERE id=?').bind(at, record.id).run()
  }
  await json(call(`/api/operator/evidence/${evidence[1].id}/wording`, { wording: 'synthetic-penny-private-revision', expectedVersionId: evidence[1].versionId }, operator, 'PATCH'))
  // Publish populated safe reads while internal boards and evidence stay private.
  await json(call(`/api/operator/requests/${requests[1].slug}/moderate`, {
    verdict: 'approved', title: 'Public request', description: 'Public wording', publicAuthorDisplayName: 'Operator',
  }, operator))
  await call(`/api/public/requests/${requests[1].slug}/vote`, {}, person).then(async response => expect(response.status, await response.text()).toBe(204))
  const response = await call(door + filter(), undefined, operator)
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  const report = await response.json() as VolumeReport
  expect(report).toEqual({
    window: { from, to, timezone: 'UTC', endExclusive: true }, totals: { requests: 3, evidence: 3 },
    requestsByBoard: [b, a], evidenceBySource: [{ sourceType: 'email', count: 1 }, { sourceType: 'interview', count: 2 }],
    daily: [
      { date: '2026-10-01', requests: 2, evidence: 1, requestsByBoard: [a], evidenceBySource: [{ sourceType: 'interview', count: 1 }] },
      { date: '2026-10-02', requests: 0, evidence: 1, requestsByBoard: [], evidenceBySource: [{ sourceType: 'email', count: 1 }] },
      { date: '2026-10-03', requests: 1, evidence: 1, requestsByBoard: [b], evidenceBySource: [{ sourceType: 'interview', count: 1 }] },
    ],
  })
  for (const metric of ['requests', 'evidence'] as const) expect(report.daily.reduce((sum, day) => sum + day[metric], 0)).toBe(report.totals[metric])
  const download = await call(door + '.csv' + filter(), undefined, operator)
  expect(download.status).toBe(200)
  expect(download.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
  expect(download.headers.get('Cache-Control')).toBe('private, no-store')
  expect(download.headers.get('Content-Disposition')).toContain('penny-feedback-volume.csv')
  const csv = csvRows(await download.text())
  expect(csv.shift()).toEqual(['from', 'to', 'period', 'date', 'metric', 'group_id', 'group_label', 'count'])
  const expected = [
    ['window', '', 'requests', '', '', '3'], ['window', '', 'evidence', '', '', '3'],
    ['window', '', 'requests', 'volume-private', "'" + boardName, '1'], ['window', '', 'requests', 'volume-public', 'Public board', '2'],
    ['window', '', 'evidence', 'email', 'email', '1'], ['window', '', 'evidence', 'interview', 'interview', '2'],
    ['daily', '2026-10-01', 'requests', '', '', '2'], ['daily', '2026-10-01', 'evidence', '', '', '1'],
    ['daily', '2026-10-01', 'requests', 'volume-public', 'Public board', '2'], ['daily', '2026-10-01', 'evidence', 'interview', 'interview', '1'],
    ['daily', '2026-10-02', 'requests', '', '', '0'], ['daily', '2026-10-02', 'evidence', '', '', '1'],
    ['daily', '2026-10-02', 'evidence', 'email', 'email', '1'],
    ['daily', '2026-10-03', 'requests', '', '', '1'], ['daily', '2026-10-03', 'evidence', '', '', '1'],
    ['daily', '2026-10-03', 'requests', 'volume-private', "'" + boardName, '1'], ['daily', '2026-10-03', 'evidence', 'interview', 'interview', '1'],
  ].map(row => [from, to, ...row])
  expect(csv).toEqual(expected)
  const partial = await json<VolumeReport>(call(door + filter('2026-10-01T01:00:00+01:00', '2026-10-01T12:00:00Z'), undefined, operator))
  expect(partial.window.from).toBe(from)
  expect(partial.totals).toEqual({ requests: 1, evidence: 1 })
  expect(partial.daily).toHaveLength(1)
  const emptyFilter = filter('2026-10-05T00:00:00Z', '2026-10-06T00:00:00Z')
  const empty = await json<VolumeReport>(call(door + emptyFilter, undefined, operator))
  expect(empty).toMatchObject({ totals: { requests: 0, evidence: 0 }, requestsByBoard: [], evidenceBySource: [], daily: [{ date: '2026-10-05', requests: 0, evidence: 0, requestsByBoard: [], evidenceBySource: [] }] })
  expect(csvRows(await (await call(door + '.csv' + emptyFilter, undefined, operator)).text()).map(row => row.slice(2))).toEqual([
    ['period', 'date', 'metric', 'group_id', 'group_label', 'count'], ['window', '', 'requests', '', '', '0'], ['window', '', 'evidence', '', '', '0'],
    ['daily', '2026-10-05', 'requests', '', '', '0'], ['daily', '2026-10-05', 'evidence', '', '', '0'],
  ])
  // No report labels or evidence wording in nonempty public list and detail reads.
  const list = await json<unknown[]>(call('/api/public/requests'))
  expect(list.length).toBeGreaterThan(0)
  const detail = await json<{ title: string }>(call(`/api/public/requests/${requests[1].slug}`))
  expect(detail.title).toBe('Public request')
  for (const payload of [list, detail]) for (const marker of [boardName, 'synthetic-penny-private-source', 'synthetic-penny-private-evidence', 'synthetic-penny-private-revision', 'requestsByBoard', 'evidenceBySource']) expect(JSON.stringify(payload)).not.toContain(marker)
  for (const suffix of ['', '.csv']) {
    for (const query of ['', '?from=invalid&to=invalid', filter(to, from), filter(from, from), filter('2026-02-30T00:00:00Z', to), filter(from, '2028-01-01T00:00:00Z'), filter() + '&from=' + from, filter() + '&board=unknown', filter() + '&source=unknown']) {
      expect((await call(door + suffix + query, undefined, operator)).status).toBe(400)
    }
    for (const headers of [{}, person]) {
      const refused = await call(door + suffix + filter(), undefined, headers)
      expect(refused.status).toBe(401); expect(await refused.json()).toEqual({ error: 'unauthenticated' })
    }
  }
  const before = await env.DB.batch([env.DB.prepare('SELECT * FROM requests ORDER BY id'), env.DB.prepare('SELECT * FROM evidence_items ORDER BY id')])
  expect((await call('/api/auth/sign-out', {}, operator)).status).toBe(204)
  for (const suffix of ['', '.csv']) expect((await call(door + suffix + filter(), undefined, operator)).status).toBe(401)
  const after = await env.DB.batch([env.DB.prepare('SELECT * FROM requests ORDER BY id'), env.DB.prepare('SELECT * FROM evidence_items ORDER BY id')])
  expect(after.map(result => result.results)).toEqual(before.map(result => result.results))
})
