import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { arch, cpus, platform, totalmem } from 'node:os'
import { startBrowserRuntime } from 'file:///home/agent/rer-consolidation/work/sd-penny-main-unicode-fix-1/repo/tests/browser/base-runtime.mjs'

// The requester-board Verify shard builds, then runs this capacity journey.
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
  const {createRequire}=await import('node:module')
  const {writeFile}=await import('node:fs/promises')
  const {resolve}=await import('node:path')
  const require=createRequire(resolve('package.json'))
  const ts=require('typescript')
  const asModule=text=>'data:text/javascript;base64,'+Buffer.from(text).toString('base64')
  const predicate=asModule(await readFile('src/core/features/requests/publication-predicate.ts','utf8'))
  const source=(await readFile('src/core/features/requests/suggestions.ts','utf8')).replace("'./publication-predicate'",JSON.stringify(predicate))
  const {requestSuggestions}=await import(asModule(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText))
  const trace={head,counts,scope:'One execution per door of exact source function against unchanged full corpus; supplementary query-cost evidence, not endpoint timing proof',queries:[]}
  for(const operator of [false,true]){
    const tracedDb={prepare(query){return {bind(...bindings){return {async all(){
      const plan=(await runtime.db.prepare('EXPLAIN QUERY PLAN '+query).bind(...bindings).all()).results
      const started=performance.now()
      const result=await runtime.db.prepare(query).bind(...bindings).all()
      trace.queries.push({door:operator?'operator':'public',query,bindings,plan,meta:result.meta,elapsed_ms:performance.now()-started,rows:result.results.length})
      return result
    }}}}}}
    const suggestions=await requestSuggestions(tracedDb,'résumé',operator)
    assert.deepEqual(suggestions.map(row=>row.slug),[matchedSlugs[0]])
    assert.deepEqual(suggestions[0].matchedTerms,['résumé'])
  }
  await writeFile('../packet/query-trace.json',JSON.stringify(trace,null,2)+'\n')
  console.log(JSON.stringify(trace))
} finally {
  await runtime.close()
}
