import {createRequire} from 'node:module'
import {mkdtemp, readFile, readdir, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
const require = createRequire(import.meta.resolve('@cloudflare/vitest-plugin'))
const {Miniflare, convertV4MiniflareOptions, Log, LogLevel} = require('miniflare')
const {readD1Migrations} = await import('@cloudflare/vitest-plugin')

/** Fresh fixture storage around the emitted production Worker. No local
 * installation configuration, model keys or provider credentials are loaded. */
export async function lexicalRuntime() {
 const directory = await mkdtemp(join(tmpdir(), 'penny-duplicate-eval-'))
 let mf, outboundCalls = 0, requestNumber = 0
 try {
  const modules = []
  for (const path of await readdir('dist/server', {recursive:true})) {
   if (/\.(js|mjs)$/.test(path)) modules.push({type:'ESModule', path:resolve('dist/server', path), contents:await readFile(join('dist/server', path), 'utf8')})
  }
  modules.sort((a, b) => a.path.endsWith('/index.js') ? -1 : b.path.endsWith('/index.js') ? 1 : 0)
  if (!modules.some(module => module.path === resolve('dist/server/index.js'))) throw Error('Build Penny before running the duplicate evaluation')
  const origin = 'http://penny-evaluation.invalid'
  mf = new Miniflare(convertV4MiniflareOptions({
   modules, modulesRoot:resolve('dist/server'), host:'127.0.0.1', port:0, cf:false,
   compatibilityDate:'2026-08-31', compatibilityFlags:['nodejs_compat'],
   resourcePersistencePath:directory, d1Databases:{DB:'duplicates'}, r2Buckets:{FILES:'duplicates'}, queueProducers:{JOBS:'duplicates'},
   logRequests:false, log:new Log(LogLevel.NONE),
   bindings:{PENNY_ENVIRONMENT:'test', APP_ORIGIN:origin, AUTH_SECRET:'synthetic-penny-evaluation-authority-12345',
    OPERATOR_EMAIL:['synthetic-penny-owner', 'example.invalid'].join('@')},
   outboundService:() => {outboundCalls++; throw Error('Lexical evaluation forbids outbound traffic')},
  }))
  await mf.ready
  const db = await mf.getD1Database('DB')
  for (const migration of await readD1Migrations(resolve('migrations/core'))) await db.batch(migration.queries.map(sql => db.prepare(sql)))
  return {
   get outboundCalls() {return outboundCalls},
   async seed(candidates) {
    const stamp = '2026-11-06T00:00:00.000Z'
    await db.prepare("INSERT INTO boards(id,slug,name,visibility,position,created_at,updated_at) VALUES('synthetic-penny-board','synthetic-penny-board','Synthetic feedback','public',0,?,?)").bind(stamp,stamp).run()
    for (let offset = 0; offset < candidates.length; offset += 50) {
     await db.batch(candidates.slice(offset, offset + 50).map(candidate =>
      db.prepare("INSERT INTO requests(id,slug,board_id,title,description,public_title,public_description,moderation_state,public_state,published_at,created_at,updated_at) VALUES(?,?,'synthetic-penny-board',?,?,?,?,'approved','open',?,?,?)")
       .bind(candidate.id, candidate.id, candidate.title, candidate.description, candidate.title, candidate.description, stamp, stamp, stamp)))
    }
   },
   async suggest(title) {
    const number = ++requestNumber
    const response = await mf.dispatchFetch(origin + '/api/public/requests/suggestions?title=' + encodeURIComponent(title), {
     headers:{'CF-Connecting-IP':'198.18.' + Math.floor(number / 254) + '.' + (number % 254 + 1)},
    })
    if (response.status !== 200) throw Error('Native duplicate suggestion route failed: HTTP ' + response.status)
    const suggestions = await response.json()
    if (!Array.isArray(suggestions) || suggestions.length > 5 || suggestions.some(row => typeof row.slug !== 'string' || !Array.isArray(row.matchedTerms) || !row.matchedTerms.length)) throw Error('Invalid native duplicate suggestions')
    return suggestions
   },
   async close() {try {await mf.dispose()} finally {await rm(directory, {recursive:true, force:true})}},
  }
 } catch (error) {
  try {await mf?.dispose()} finally {await rm(directory, {recursive:true, force:true})}
  throw error
 }
}
