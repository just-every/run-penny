import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { arch, cpus, platform, totalmem } from 'node:os'
import { startBrowserRuntime } from '../browser/base-runtime.mjs'

// Outside push Verify: build, then run this journey on the committed candidate.
// The receipt declares its hardware and the populated tables read by suggestions.
const { limits } = JSON.parse(await readFile('seed.json', 'utf8'))
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const runtime = await startBrowserRuntime()
try {
  const stamp = '2026-11-05T00:00:00Z'
  const matchIds = Array.from({ length: 5 }, (_, index) => Math.floor((limits.publicRequests - 1) * index / 4) + 1)
  const matchedSlugs = matchIds.map(index => `request-${String(index).padStart(6, '0')}`)
  await runtime.db.batch([
    runtime.db.prepare(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<?)
      INSERT INTO boards(id,slug,name,visibility,position,created_at,updated_at)
      SELECT 'board-'||i,'board-'||i,'Synthetic board','public',i,?,? FROM n`).bind(limits.boards, stamp, stamp),
    runtime.db.prepare(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<?)
      INSERT INTO requesters(id,display_name,created_at,updated_at)
      SELECT 'person-'||i,'Synthetic person',?,? FROM n`).bind(limits.requesters, stamp, stamp),
    runtime.db.prepare(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<?)
      INSERT INTO requests(id,slug,board_id,author_requester_id,title,description,public_title,public_description,moderation_state,public_state,published_at,created_at,updated_at)
      SELECT 'request-'||i,printf('request-%06d',i),printf('board-%d',(i-1)%?+1),'person-'||i,
        CASE WHEN i IN (SELECT value FROM json_each(?)) THEN 'Export project reports' ELSE 'Unrelated feedback item' END,'CSV workspace reports',
        CASE WHEN i IN (SELECT value FROM json_each(?)) THEN 'Export project reports' ELSE 'Unrelated feedback item' END,'CSV workspace reports',
        'approved','open',?,?,? FROM n`).bind(limits.publicRequests, limits.boards, JSON.stringify(matchIds), JSON.stringify(matchIds), stamp, stamp, stamp),
  ])
  await runtime.db.prepare("UPDATE requests SET title=title||' — résumé',public_title=public_title||' — résumé' WHERE id='request-1'").run()
  const counts = await runtime.db.prepare('SELECT (SELECT count(*) FROM requests) requests,(SELECT count(*) FROM boards) boards,(SELECT count(*) FROM requesters) requesters').first()
  assert.deepEqual(counts, { requests: limits.publicRequests, boards: limits.boards, requesters: limits.requesters })
  const boot = await fetch(runtime.origin + '/auth/bootstrap', { method: 'POST', redirect: 'manual',
    headers: { Origin: runtime.origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'synthetic-base-browser-setup-token-12345', displayName: 'Scale owner' }) })
  assert.equal(boot.status, 303, await boot.text())
  const operator = { Cookie: boot.headers.get('set-cookie').split(';')[0] }
  const results = []
  const workloads = [
    { name: 'exact', title: 'export project reports CSV', slugs: matchedSlugs, terms: ['export', 'project', 'reports', 'csv'] },
    { name: 'partial', title: 'export project reports XML', slugs: matchedSlugs, terms: ['export', 'project', 'reports'] },
    { name: 'absent', title: 'synthetic absent vocabulary', slugs: [], terms: [] },
    { name: 'unicode', title: 'résumé', slugs: [matchedSlugs[0]], terms: ['résumé'] },
  ]
  for (const [door, headers] of [['public', {}], ['operator', operator]]) {
   for (const workload of workloads) {
    const durations = []
    for (let sample = 0; sample < 25; sample++) {
      const started = performance.now()
      const response = await fetch(runtime.origin + `/api/${door}/requests/suggestions?title=${encodeURIComponent(workload.title)}`, {
        headers: { 'CF-Connecting-IP': '192.0.2.2', ...headers },
      })
      assert.equal(response.status, 200, await response.clone().text())
      const suggestions = await response.json()
      durations.push(performance.now() - started)
      assert.deepEqual(suggestions.map(row => row.slug), workload.slugs)
      for (const suggestion of suggestions) assert.deepEqual(suggestion.matchedTerms, workload.terms)
    }
    durations.sort((a, b) => a - b)
    results.push({ door, workload: workload.name, samples: durations.length, p95: durations[Math.ceil(durations.length * 0.95) - 1], max: durations.at(-1) })
   }
  }
  console.log(JSON.stringify({ head, counts, results, hardware: { platform: platform(), arch: arch(), cpu: cpus()[0].model, memory: totalmem() }, node: process.version }))
  for (const result of results) assert.ok(result.p95 < 500, `${result.door} p95 ${result.p95}ms exceeds 500ms`)
} finally {
  await runtime.close()
}
