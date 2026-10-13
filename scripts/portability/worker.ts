// This is Penny's binding/policy boundary. Base owns archive framing, integrity,
// resource enumeration, staged validation and atomic restore.
import { createReadStream, createWriteStream } from 'node:fs'
import { lstat, mkdir, link, unlink, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { getPlatformProxy } from 'wrangler'
import { createPortability, readArchive, type LaterJournal } from '../base-cli/modules/portability/index.mjs'
import { readErasureJournal, schema } from '../../src/core/features/data/archive'
import { policy, readJournal, laterJournalFence, LOCAL_DATA_LIMITS } from './policy'
import { privateInput } from '../data/private-files.mjs'
import { failureLine, type Progress } from './failure'
// `later` is `rer import --journal LATER_ARCHIVE`: a later archive of this installation.
const [direction, path, later] = process.argv.slice(2)
let proxy: Awaited<ReturnType<typeof getPlatformProxy>> | undefined
const progress: Progress = { stage: 'check_arguments' }
let laterJournal: LaterJournal | undefined
let laterProductJournal: Awaited<ReturnType<typeof readJournal>> | undefined
let temporary: string | undefined
try {
  if (!['export', 'import'].includes(direction) || !path || (later && direction !== 'import')) throw new Error('invalid_transfer')
  const journalPath = path + '.erasure-journal.json'
  progress.stage = direction === 'export' ? 'check_output' : 'read_journal'
  if (direction === 'export') {
    for (const file of [path, journalPath]) if (await lstat(file).catch(error => { if (error.code === 'ENOENT') return null; throw error })) throw new Error('archive_exists')
  } else {
    await privateInput(journalPath)
    progress.stage = 'read_archive'; progress.records = 0
    for await (const record of readArchive(Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>)) { void record; progress.records++ }
    progress.records = undefined
    if (later) {
      // Both journals of the later archive fence this restore: Base's in its manifest, Penny's beside it.
      progress.stage = 'read_later_archive'; progress.records = 0
      for await (const record of readArchive(Readable.toWeb(createReadStream(later)) as ReadableStream<Uint8Array>)) {
        if (record.kind === 'manifest') laterJournal = { sourceIdentity: record.sourceIdentity, epoch: record.epoch, journal: record.journal }
        progress.records++
      }
      progress.records = undefined
      progress.stage = 'read_later_journal'
      laterProductJournal = await readJournal(later + '.erasure-journal.json')
    }
  }
  progress.stage = 'open_database'
  proxy = await getPlatformProxy({ configPath: 'wrangler.jsonc', persist: { path: '.wrangler/state/v3' }, remoteBindings: false })
  const bindings = proxy.env as { DB: D1Database; FILES: R2Bucket }
  const db = bindings.DB, bucket = bindings.FILES
  progress.stage = 'check_installation'
  const current = await db.prepare('SELECT phase,lock_id FROM data_state WHERE singleton=1').first<{phase:string;lock_id:string|null}>()
  if (current?.phase !== 'idle' || current.lock_id !== null) throw new Error('data_busy')
  progress.stage = 'read_journal'
  const journal = direction === 'export' ? await readErasureJournal(db) : await readJournal(journalPath)
  if (laterProductJournal) { progress.stage = 'check_later_journal'; laterJournalFence(journal, laterProductJournal) }
  progress.stage = 'read_schema'
  const tables = await schema(db)
  let rowCount = 0
  for (const table of tables) { rowCount += (await db.prepare(`SELECT COUNT(*) n FROM "${table.name}"`).first<{n:number}>())!.n; if (rowCount > LOCAL_DATA_LIMITS.rows) throw new Error('archive_limit') }
  const service = await createPortability({ db, buckets: { FILES: bucket }, policy: policy(journal) })
  let id: string | undefined, complete = false
  try {
    progress.stage = direction
    if (direction === 'export') {
      await mkdir(dirname(path), { recursive: true, mode: 0o700 })
      id = await service.exports.create()
      while ((await service.exports.advance(id, { maxParts: 16 })).phase === 'building') {}
      temporary = path + '.' + randomUUID() + '.partial'
      await pipeline(Readable.fromWeb(await service.exports.download(id) as never), createWriteStream(temporary, { flags: 'wx', mode: 0o600 }))
      const rows: Record<string, Record<string, unknown>[]> = {}
      let manifest: import('../base-cli/modules/portability/index.mjs').Manifest | undefined, bytes = 0
      progress.stage = 'verify_export'
      for await (const record of readArchive(Readable.toWeb(createReadStream(temporary)) as ReadableStream<Uint8Array>)) {
        if (record.kind === 'manifest') { manifest = record; for (const table of record.tables) rows[table.name] = [] }
        if (record.kind === 'part') for (const item of record.items) if (item.kind === 'row') { bytes += Buffer.byteLength(JSON.stringify(item.row)); if (bytes > LOCAL_DATA_LIMITS.recordBytes) throw new Error('archive_limit'); rows[item.table].push(item.row) }
      }
      await policy(journal).validateStaged!({db, tables: Object.fromEntries(Object.keys(rows).map(name => [name, name])), read: async name => rows[name], manifest: manifest!})
      await writeFile(journalPath, JSON.stringify(journal) + '\n', { flag: 'wx', mode: 0o600 })
      await link(temporary, path)
      await service.exports.abort(id)
    } else {
      let closing: { contentHash?: string; archiveHash?: string } = {}
      progress.stage = 'restore_upload'; progress.records = 0
      for await (const record of readArchive(Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>)) {
        if (record.kind === 'manifest') id = await service.imports.create(record)
        else if (record.kind === 'part') await service.imports.uploadPart(id!, record.index, record)
        else closing = record
        progress.records++
      }
      progress.stage = 'restore_finalize'; progress.records = undefined
      // Base binds the whole manifest and every part digest in archiveHash.
      await service.imports.finalize(id!, { contentHash: closing.contentHash, archiveHash: closing.archiveHash!, ...(laterJournal ? { laterJournal } : {}) })
      complete = true // A committed restore must never be aborted if cleanup fails.
      await db.batch(await service.invalidateTransfersStatements())
    }
    complete = true
    console.log(JSON.stringify({ ok: true, direction, scope: 'local domain data and originals; installation authority excluded' }))
  } finally {
    if (id && !complete) await (direction === 'export' ? service.exports.abort(id) : service.imports.abort(id))
  }
} catch (error) {
  // Every failure names where it stopped and its underlying error chain, allow-listed.
  console.error(failureLine(error, progress)); process.exitCode = 1
} finally {
  if (temporary) await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error })
  await proxy?.dispose()
}
