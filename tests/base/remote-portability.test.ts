import { applyD1Migrations, reset } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { beforeEach, expect, inject, it } from 'vitest'
import { createPortability, readArchive, type Closing } from '@runeditrun/rer/modules/portability'
import { createPennyApi } from '../../src/core/app/api'
import { readErasureJournal } from '../../src/core/features/data/archive'
import { laterJournalFence, policy } from '../../scripts/portability/policy'
import { archiveJournal } from '../../scripts/portability/archive-journal.mjs'
const app = createPennyApi(), origin = 'https://penny.test'
const bindings = { ...env, PENNY_ENVIRONMENT: 'production', APP_ORIGIN: origin, MAIL_PROVIDER: undefined, MAIL_FROM: undefined, SENDGRID_API_KEY: undefined }
const call = (path: string, body?: unknown, headers: Record<string, string> = {}, currentBindings = bindings) => app.fetch(new Request(origin + path, { method: body === undefined ? 'GET' : 'POST', headers: { Origin: origin, 'CF-Connecting-IP': '192.0.2.1', ...headers, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), currentBindings)
async function owner() { const response = await call('/auth/bootstrap', { token: bindings.SETUP_TOKEN, displayName: 'Owner', returnTo: '/app' }); expect(response.status).toBe(303); return { Cookie: response.headers.get('Set-Cookie')!.split(';')[0] } }
const base = '/api/portability/exports'
beforeEach(async () => { await reset(); await applyD1Migrations(env.DB, inject('migrations')) })
async function create(cookie: Record<string, string>) { const response = await call(base, {}, cookie); expect(response.status).toBe(201); return (await response.json() as { id: string }).id }
async function complete(id: string, cookie: Record<string, string>) {
 let phase = 'building'
 while (phase === 'building') { const response = await call(`${base}/${id}/advance`, { maxParts: 100 }, cookie); expect(response.status, await response.clone().text()).toBe(200); phase = (await response.json() as { phase: string }).phase }
 expect(phase).toBe('complete')
}
it('exports the hosted Base archive and matching journal, restores the same originals locally, and removes source snapshots', async () => {
 const cookie = await owner(), stamp = new Date().toISOString()
 await env.DB.batch([
  env.DB.prepare("INSERT INTO boards(id,slug,name,visibility,position,created_at,updated_at) VALUES('remote-board','remote-board','Remote records','public',0,?,?)").bind(stamp, stamp),
  env.DB.prepare("INSERT INTO requests(id,slug,board_id,title,description,moderation_state,public_state,created_at,updated_at) VALUES('remote-request','remote-request','remote-board','Hosted marker','Private original','awaiting_review','open',?,?)").bind(stamp, stamp),
  env.DB.prepare("INSERT INTO attachments(id,request_id,storage_key,original_filename,content_type,byte_size,public_state,created_at,updated_at) VALUES('remote-file','remote-request','remote-original','Original.bin','application/octet-stream',4,'operator_only',?,?)").bind(stamp, stamp),
 ])
 await env.FILES.put('remote-original', new Uint8Array([5, 4, 3, 2]), { httpMetadata: { contentType: 'application/octet-stream' }, customMetadata: { purpose: 'original' } })
 const learning = '/api/operator/learning/investigations'
 const grant = async () => {
  const response = await call(learning, { nativeEvidenceIds: [], nativeRequestIds: ['remote-request'], purpose: 'Review the hosted feedback', expiresAt: '2099-01-01T00:00:00Z', budgetMicros: 1000000, maxRunCostMicros: 100000, intervalMinutes: 60 }, cookie)
  expect(response.status).toBe(201)
  return (await response.json() as { id: string }).id
 }
 const activeGrant = await grant(), revokedGrant = await grant(), priorJournal = await readErasureJournal(env.DB)
 expect((await call(`${learning}/${revokedGrant}/control`, { action: 'revoke' }, cookie)).status).toBe(200)
 const learningRows = async () => ({
  sources: (await env.DB.prepare('SELECT * FROM learning_sources ORDER BY id').all()).results,
  grants: (await env.DB.prepare('SELECT * FROM learning_investigations ORDER BY id').all()).results,
 })
 const originalLearning = await learningRows()
 const expected = await env.DB.prepare("SELECT * FROM requests WHERE id='remote-request'").first()
 const id = await create(cookie)
 await expect(env.DB.prepare("UPDATE requests SET title='racing write' WHERE id='remote-request'").run()).rejects.toThrow('data maintenance')
 await complete(id, cookie)
 const response = await call(`${base}/${id}/download`, undefined, cookie)
 expect(response.status).toBe(200); expect(response.headers.get('Content-Disposition')).toContain('attachment')
 const bytes = await response.arrayBuffer(), blob = new Blob([bytes]), { journal, manifest } = await archiveJournal(blob.stream())
 expect(journal).toEqual(await readErasureJournal(env.DB))
 expect(journal.epoch).toBeGreaterThan(priorJournal.epoch)
 expect(() => laterJournalFence(priorJournal, journal)).toThrow('erasure_epoch')
 expect(() => laterJournalFence(journal, priorJournal)).toThrow('later_journal')
 expect(manifest.tables.some(table => table.name.startsWith('oa_'))).toBe(false)
 expect(manifest.objects).toHaveLength(1)
 expect((await call(`${base}/${id}/abort`, {}, cookie)).status).toBe(200)
 expect(await env.DB.prepare("SELECT lock_id FROM data_state").first('lock_id')).toBeNull()
 expect((await env.DB.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'rer_portability_snap_%'").all()).results).toHaveLength(0)
 // The archive uses the same service and product policy as ordinary local import.
 await reset(); await applyD1Migrations(env.DB, inject('migrations'))
 const destinationOwner = await owner(), service = await createPortability({ db: env.DB, buckets: { FILES: env.FILES }, policy: policy(journal) })
 let imported: string | undefined, closing: Closing | undefined
 for await (const record of readArchive(blob.stream())) {
  if (record.kind === 'manifest') imported = await service.imports.create(record)
  else if (record.kind === 'part') await service.imports.uploadPart(imported!, record.index, record)
  else closing = record
 }
 expect((await service.imports.finalize(imported!, { contentHash: closing!.contentHash, archiveHash: closing!.archiveHash })).phase).toBe('complete')
 expect(await env.DB.prepare("SELECT * FROM requests WHERE id='remote-request'").first()).toEqual(expected)
 const original = await env.FILES.get('remote-original')
 expect(new Uint8Array(await original!.arrayBuffer())).toEqual(new Uint8Array([5, 4, 3, 2])); expect(original!.customMetadata).toEqual({ purpose: 'original' })
 expect((await call('/api/operator/data/overview', undefined, destinationOwner)).status).toBe(200)
 const restoredLearning = await learningRows()
 expect(restoredLearning.sources).toEqual(originalLearning.sources.map(row => ({ ...row, state: 'held', version: Number(row.version) + 1 })))
 expect(restoredLearning.grants).toEqual(originalLearning.grants.map(row => row.state === 'revoked' ? row : { ...row, state: 'held', version: Number(row.version) + 1, last_reason: 'restored_grant_review_required' }))
 expect(await readErasureJournal(env.DB)).toEqual(journal)
 for (const grantId of [activeGrant, revokedGrant]) {
  expect((await call(`${learning}/${grantId}/run`, {}, destinationOwner)).status).toBe(409)
  const resume = await call(`${learning}/${grantId}/control`, { action: 'resume' }, destinationOwner)
  expect(resume.status).toBe(409)
  expect(await resume.json()).toEqual({ error: 'learning_control_requires_new_grant' })
 }
 // Exporting restored held/revoked grants must preserve their semantic versions.
 const repeatedId = await create(destinationOwner)
 await complete(repeatedId, destinationOwner)
 const repeated = await call(`${base}/${repeatedId}/download`, undefined, destinationOwner)
 expect(repeated.status).toBe(200)
 const repeatedLearning: Record<string, Record<string, unknown>[]> = { learning_sources: [], learning_investigations: [] }
 for await (const record of readArchive(repeated.body!)) if (record.kind === 'part') for (const item of record.items) if (item.kind === 'row' && repeatedLearning[item.table]) repeatedLearning[item.table].push(item.row)
 for (const rows of Object.values(repeatedLearning)) rows.sort((a, b) => String(a.id).localeCompare(String(b.id)))
 expect(repeatedLearning).toEqual({ learning_sources: restoredLearning.sources, learning_investigations: restoredLearning.grants })
 expect((await call(`${base}/${repeatedId}/abort`, {}, destinationOwner)).status).toBe(200)
})
it('requires a current native owner, exact origin and job ownership, and never mounts remote restore', async () => {
 expect((await call(base, {})).status).toBe(401)
 const cookie = await owner()
 expect((await (await call('/api/operator/data/overview', undefined, cookie)).json() as {canExport: boolean}).canExport).toBe(true)
 for (const Origin of ['', 'https://foreign.test']) expect((await call(base, {}, { ...cookie, Origin })).status).toBe(403)
 expect((await call(base, {}, { ...cookie, 'Sec-Fetch-Site': 'cross-site' })).status).toBe(403)
 expect((await app.fetch(new Request('https://alias.test' + base, { method: 'POST', headers: { ...cookie, Origin: 'https://alias.test' }, body: '{}' }), bindings)).status).toBe(404)
 expect((await call('/api/portability/imports', {}, cookie)).status).toBe(404)
 const id = await create(cookie), jobActor = await env.DB.prepare('SELECT actor FROM rer_portability_jobs WHERE id=?').bind(id).first('actor')
 await env.DB.prepare("UPDATE rer_portability_jobs SET actor='another-owner' WHERE id=?").bind(id).run()
 for (const [suffix, body] of [['', undefined], ['/download', undefined], ['/advance', {}], ['/abort', {}]] as const) expect((await call(base + '/' + id + suffix, body, cookie)).status).toBe(404)
 const actor = await env.DB.prepare('SELECT id FROM oa_operators').first('id')
 await env.DB.prepare('UPDATE rer_portability_jobs SET actor=? WHERE id=?').bind(jobActor, id).run()
 await env.DB.prepare("INSERT INTO oa_operators(id,email,display_name,role,status,created_at) VALUES('second-owner','second@penny.invalid','Second owner','owner','active',1)").run()
 await env.DB.prepare("UPDATE oa_operators SET role='member' WHERE id=?").bind(actor).run()
 expect((await call(base + '/' + id, undefined, cookie)).status).toBe(401)
 // A fresh native member session still cannot use owner portability.
 await env.DB.prepare('UPDATE oa_sessions SET operator_version=(SELECT version FROM oa_operators WHERE id=operator_id)').run()
 expect((await (await call('/api/operator/data/overview', undefined, cookie)).json() as {canExport: boolean}).canExport).toBe(false)
 const ownedOperation = await env.DB.prepare('SELECT lock_id FROM data_state').first('lock_id')
 expect((await call('/api/operator/data/operations/' + ownedOperation + '/abort-export', { confirmPriorRunnerStopped: true }, cookie)).status).toBe(403)
 expect((await call('/api/operator/data/operations/' + ownedOperation + '/recover-runner', { expectedStatus: 'running', confirmPriorRunnerStopped: true }, cookie)).status).toBe(403)
 expect((await call(base + '/' + id, undefined, cookie)).status).toBe(401)
 await env.DB.prepare("UPDATE oa_operators SET role='owner' WHERE id=?").bind(actor).run()
 await env.DB.prepare('UPDATE oa_sessions SET operator_version=(SELECT version FROM oa_operators WHERE id=operator_id)').run()
 await env.DB.prepare('UPDATE oa_sessions SET expires_at=?').bind(Date.now() - 1).run()
 expect((await call(base + '/' + id + '/abort', {}, cookie)).status).toBe(401)
 await env.DB.prepare('UPDATE oa_sessions SET expires_at=?,revoked_at=?').bind(Date.now() + 60000, Date.now()).run()
 expect((await call(base + '/' + id + '/download', undefined, cookie)).status).toBe(401)
 await env.DB.prepare('UPDATE oa_sessions SET revoked_at=NULL').run()
 const operationId = await env.DB.prepare('SELECT lock_id FROM data_state').first('lock_id')
 const recovered = await call('/api/operator/data/operations/' + operationId + '/abort-export', { confirmPriorRunnerStopped: true }, cookie)
 expect(recovered.status).toBe(204)
 expect(await env.DB.prepare('SELECT lock_id FROM data_state').first('lock_id')).toBeNull()
 expect((await env.DB.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'rer_portability_snap_%'").all()).results).toHaveLength(0)
})
it('refuses unclassified schema and untracked originals without retaining a maintenance lock', async () => {
 const cookie = await owner()
 await env.DB.exec('CREATE TABLE unclassified_private_data(id TEXT PRIMARY KEY)')
 expect((await call(base, {}, cookie)).status).toBe(503)
 expect(await env.DB.prepare('SELECT lock_id FROM data_state').first('lock_id')).toBeNull()
 await env.DB.exec('DROP TABLE unclassified_private_data')
 await env.FILES.put('untracked-original', 'private bytes')
 expect((await call(base, {}, cookie)).ok).toBe(false)
 expect(await env.DB.prepare('SELECT lock_id FROM data_state').first('lock_id')).toBeNull()
 expect((await env.DB.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'rer_portability_snap_%'").all()).results).toHaveLength(0)
})

it('recovers an undelivered creation by its durable actor without deleting unrelated snapshots', async () => {
 const cookie = await owner(), journal = await readErasureJournal(env.DB)
 const unrelated = await createPortability({ db: env.DB, buckets: { FILES: env.FILES }, policy: policy(journal) })
 const unrelatedId = await unrelated.exports.create('separate-local-export')
 const retained = (await env.DB.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'rer_portability_snap_%' ORDER BY name").all()).results
 // Lose the HTTP response: recovery has only Penny's durable operation, not a returned Base job ID.
 const lost = await call(base, {}, cookie); expect(lost.status).toBe(201); await lost.body?.cancel()
 const operationId = await env.DB.prepare('SELECT lock_id FROM data_state').first('lock_id')
 expect((await call('/api/operator/data/operations/' + operationId + '/abort-export', { confirmPriorRunnerStopped: true }, cookie)).status).toBe(204)
 expect((await env.DB.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'rer_portability_snap_%' ORDER BY name").all()).results).toEqual(retained)
 expect((await unrelated.exports.status(unrelatedId)).phase).toBe('building')
 expect(await env.DB.prepare('SELECT lock_id FROM data_state').first('lock_id')).toBeNull()
 await unrelated.exports.abort(unrelatedId)
})
it('serializes abort with advancement and fences an old runner after owner-confirmed recovery', async () => {
 const cookie = await owner(), stamp = new Date().toISOString()
 await env.DB.batch([
  env.DB.prepare("INSERT INTO boards(id,slug,name,visibility,position,created_at,updated_at) VALUES('race-board','race-board','Race','public',0,?,?)").bind(stamp, stamp),
  env.DB.prepare("INSERT INTO requests(id,slug,board_id,title,description,moderation_state,public_state,created_at,updated_at) VALUES('race-request','race-request','race-board','Race marker','Private original','awaiting_review','open',?,?)").bind(stamp, stamp),
  env.DB.prepare("INSERT INTO attachments(id,request_id,storage_key,original_filename,content_type,byte_size,public_state,created_at,updated_at) VALUES('race-file','race-request','race-original','Original.bin','application/octet-stream',4,'operator_only',?,?)").bind(stamp, stamp),
 ])
 await env.FILES.put('race-original', new Uint8Array([1, 2, 3, 4]), { httpMetadata: { contentType: 'application/octet-stream' } })
 const id = await create(cookie)
 let entered!: () => void, release!: () => void
 const reached = new Promise<void>(resolve => { entered = resolve }), held = new Promise<void>(resolve => { release = resolve })
 const files = new Proxy(env.FILES, { get(target, key) {
  if (key === 'get') return async (...args: Parameters<R2Bucket['get']>) => { entered(); await held; return target.get(...args) }
  const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value
 } })
 const advancing = Promise.resolve(call(`${base}/${id}/advance`, { maxParts: 100 }, cookie, { ...bindings, FILES: files }))
 try {
  await Promise.race([reached, advancing.then(() => { throw Error('advance_finished_before_storage_hold') })])
  expect((await call(`${base}/${id}/abort`, {}, cookie)).status).toBe(409)
  const operationId = await env.DB.prepare('SELECT lock_id FROM data_state').first('lock_id')
  expect((await call('/api/operator/data/operations/' + operationId + '/recover-runner', { expectedStatus: 'running', confirmPriorRunnerStopped: true }, cookie)).status).toBe(204)
  expect((await call(`${base}/${id}/abort`, {}, cookie)).status).toBe(200)
 } finally { release() }
 expect((await advancing).ok).toBe(false)
 expect(await env.DB.prepare('SELECT phase FROM rer_portability_jobs WHERE id=?').bind(id).first('phase')).toBe('aborted')
 expect(await env.DB.prepare('SELECT count(*) FROM rer_portability_segments WHERE job=?').bind(id).first('count(*)')).toBe(0)
 expect(await env.DB.prepare('SELECT lock_id FROM data_state').first('lock_id')).toBeNull()
 expect((await env.DB.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'rer_portability_snap_%'").all()).results).toHaveLength(0)
})
it('names an interrupted export to guarded writers, offers its owner the job to resume or abort, then releases publication', async () => {
 const cookie = await owner(), stamp = new Date().toISOString()
 expect((await call('/api/operator/releases/options', undefined, cookie)).status).toBe(200)
 const author = await env.DB.prepare('SELECT id FROM operators').first<string>('id')
 await env.DB.batch([
  env.DB.prepare("INSERT INTO boards(id,slug,name,visibility,position,created_at,updated_at) VALUES('csv-board','csv-board','Billing','public',0,?,?)").bind(stamp, stamp),
  env.DB.prepare("INSERT INTO requests(id,slug,board_id,title,description,moderation_state,public_state,published_at,created_at,updated_at) VALUES('csv-request','csv-request','csv-board','CSV export','Export invoices','approved','shipped',?,?,?)").bind(stamp, stamp, stamp),
  env.DB.prepare("INSERT INTO tags(id,name,created_at,updated_at) VALUES('csv-tag','Billing',?,?)").bind(stamp, stamp),
  env.DB.prepare("INSERT INTO decisions(id,slug,title,question,state,rationale,created_at,updated_at) VALUES('csv-decision','csv-decision','CSV','Ship CSV?','committed','Most asked',?,?)").bind(stamp, stamp),
  env.DB.prepare("INSERT INTO roadmap_items(id,slug,decision_id,title,summary,status,delivery_notes,created_at,updated_at) VALUES('csv-item','csv-item','csv-decision','CSV','Invoices','shipped','Done',?,?)").bind(stamp, stamp),
  env.DB.prepare("INSERT INTO roadmap_publications(id,roadmap_item_id,public_title,public_summary,public_slug,approved_by_operator_id,approved_at,created_at,updated_at) VALUES('csv-approval','csv-item','CSV export','Invoices as CSV','csv-export',?,?,?,?)").bind(author, stamp, stamp, stamp),
  env.DB.prepare("INSERT INTO roadmap_request_mappings(roadmap_item_id,request_id,approved_at,created_at,updated_at) VALUES('csv-item','csv-request',?,?,?)").bind(stamp, stamp, stamp),
 ])
 const draft = await call('/api/operator/releases', { title: 'CSV export is live', body: 'Export invoices to CSV.', releaseType: 'new', tagIds: ['csv-tag'], publicationDate: '2026-10-15', setupUrl: '', targetIds: ['csv-item'], authorOperatorId: author }, cookie)
 expect(draft.status, await draft.clone().text()).toBe(201)
 const publish = `/api/operator/releases/${await env.DB.prepare('SELECT slug FROM releases').first('slug')}/publish`
 // The browser that created the export closed before advancing it.
 const id = await create(cookie)
 const refused = await call(publish, {}, cookie)
 expect(refused.status).toBe(409)
 expect((await refused.json() as { error: string }).error).toBe('data_operation_in_progress')
 const overview = await (await call('/api/operator/data/overview', undefined, cookie)).json() as { ownExport: { jobId: string } | null; operation: { kind: string } | null }
 expect(overview).toMatchObject({ ownExport: { jobId: id, phase: 'building', completed: 0 }, operation: { kind: 'export' } })
 // A new request after partial progress (as on document reload) recovers the
 // same job and its durable part cursor without a browser checkpoint.
 const advanced = await call(`${base}/${id}/advance`, { expectedPart: 0, maxParts: 1 }, cookie)
 expect(advanced.status).toBe(200)
 const progress = await advanced.json() as { completed: number }
 expect(progress.completed).toBeGreaterThan(0)
 const reloaded = await (await call('/api/operator/data/overview', undefined, cookie)).json()
 expect(reloaded).toMatchObject({ ownExport: { jobId: id, completed: progress.completed }, operation: { kind: 'export' } })
 await complete(id, cookie)
 const archive = await call(`${base}/${id}/download`, undefined, cookie)
 expect(archive.status).toBe(200); const saved = await archive.arrayBuffer()
 // Serving a verified download does not erase recovery state. The owner may
 // reload before saving, then obtain the exact same completed snapshot.
 const ready = await (await call('/api/operator/data/overview', undefined, cookie)).json()
 expect(ready).toMatchObject({ ownExport: { jobId: id, phase: 'complete' }, operation: { kind: 'export' } })
 const resumed = await call(`${base}/${id}/download`, undefined, cookie)
 expect(resumed.status).toBe(200); expect(await resumed.arrayBuffer()).toEqual(saved)
 expect((await call(`${base}/${id}/abort`, {}, cookie)).status).toBe(200)
 const idle = await (await call('/api/operator/data/overview', undefined, cookie)).json() as { ownExport: unknown; operation: unknown }
 expect(idle).toMatchObject({ ownExport: null, operation: null })
 const published = await call(publish, {}, cookie)
 expect(published.status, await published.clone().text()).toBe(200)
 expect(await env.DB.prepare('SELECT state FROM releases').first('state')).toBe('published')
})
