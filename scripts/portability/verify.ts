import { readArchive, type Manifest } from '@runeditrun/rer/modules/portability'
import { policy, LOCAL_DATA_LIMITS } from './policy'
import { ERASURE_LIMITS, type ErasureJournal } from '../../src/core/features/data/archive'
/** Validate the actual normalized Base snapshot before exposing its download. */
export async function verifyExport(db: D1Database, source: ReadableStream<Uint8Array>, journal: ErasureJournal) {
  const rows: Record<string, Record<string, unknown>[]> = {}
  let manifest: Manifest | undefined, bytes = 0, count = 0
  for await (const record of readArchive(source)) {
    if (record.kind === 'manifest') { manifest = record; for (const table of record.tables) rows[table.name] = [] }
    if (record.kind === 'part') for (const item of record.items) if (item.kind === 'row') {
      bytes += new TextEncoder().encode(JSON.stringify(item.row)).byteLength
      if (++count > LOCAL_DATA_LIMITS.rows + ERASURE_LIMITS.rows + 1 || bytes > LOCAL_DATA_LIMITS.recordBytes) throw new Error('archive_limit')
      rows[item.table].push(item.row)
    }
  }
  if (!manifest) throw new Error('incomplete_archive')
  await policy(journal).validateStaged!({ db, tables: Object.fromEntries(Object.keys(rows).map(name => [name, name])), read: async name => rows[name], manifest })
}
