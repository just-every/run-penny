import { validateLearningArchive } from '../../src/core/features/learning/archive'
import { GRANT_REVOCATION_CHECKPOINT } from '../../src/core/features/learning/journal'
import type { ArchivePolicy } from '@runeditrun/rer/modules/portability'
import inventory from '../../src/core/features/data/schema-inventory.json'
import { normalize, validateNativeIdentity, canonical, hash as digest, DATA_LIMITS, type Row, type ErasureJournal } from '../../src/core/features/data/archive'
import { validateFeedbackArchive } from '../../src/core/features/imports/archive-custody'
export const refuse = (reason: string): never => { throw new Error(reason) }
/** `rer import --journal LATER_ARCHIVE`: the later archive's Penny journal must continue this
 * archive's, and an archive older than any erasure it records is refused whole. */
export function laterJournalFence(journal: ErasureJournal, later: ErasureJournal): void {
  if (later.origin !== journal.origin || later.epoch < journal.epoch || journal.tombstones.some(item => !later.tombstones.some(other => canonical(item) === canonical(other)))) refuse('later_journal')
  if (later.epoch > journal.epoch) refuse('erasure_epoch')
}
function productRow(row: Record<string, unknown>): Row {
  if (Object.values(row).some(value => value !== null && typeof value !== 'string' && (typeof value !== 'number' || !Number.isFinite(value)))) refuse('invalid_product_cell')
  return row as Row
}
export const LOCAL_DATA_LIMITS={...DATA_LIMITS,rows:500000,recordBytes:512*1024*1024}
export function policy(journal: ErasureJournal): ArchivePolicy {
  const product = Object.entries(inventory).filter(([, value]) => value.classification === 'product').map(([name]) => name)
  return {
    product: 'just-every/penny',
    excludeTables: Object.keys(inventory).filter(name => !product.includes(name) && !['data_state', 'data_tombstones'].includes(name)),
    // Migrations seed this singleton even in an otherwise empty installation.
    // Restore replaces it with the archive's choice, as the native restore does.
    replaceableTables: ['data_state', 'penny_status_roadmap_settings'],
    requiredConfiguration: ['OPERATOR_EMAIL', 'AUTH_SECRET', 'SETUP_TOKEN', 'APP_ORIGIN', 'MAIL_PROVIDER', 'MAIL_FROM'],
    buckets: { FILES: { objectReferences: { table: 'attachments', keyColumn: 'storage_key' } } },
    exportRow: (table, row) => normalize(table, productRow(row)),
    async validateStaged({ db, tables, read, manifest }) {
      const expected = [...product, 'data_state', 'data_tombstones'].sort()
      if (canonical(Object.keys(tables).sort()) !== canonical(expected)) refuse('unclassified_archive_schema')
      if (manifest.tables.filter(table => product.includes(table.name)).reduce((sum, table) => sum + table.count, 0) > LOCAL_DATA_LIMITS.rows) refuse('archive_limit')
      const data: Record<string, Row[]> = {}
      for (const name of expected) data[name] = (await read(name)).map(productRow)
      const records = product.flatMap(name => data[name])
      if (records.length > LOCAL_DATA_LIMITS.rows || new TextEncoder().encode(canonical(records)).byteLength > LOCAL_DATA_LIMITS.recordBytes) refuse('archive_limit')
      validateNativeIdentity(data); validateFeedbackArchive(data); await validateLearningArchive(data)
      if (data.request_attachment_uploads.length || data.evidence_attachment_uploads.length) refuse('unfinished_attachment_uploads')
      if (manifest.payloads.length || manifest.objects.length !== data.attachments.length || manifest.objects.some(object => object.bucket !== 'FILES' || !data.attachments.some(row => row.storage_key === object.key))) refuse('invalid_archive_files')
      let fileBytes = 0
      for (const attachment of data.attachments) {
        const object = manifest.objects.find(object => object.bucket === 'FILES' && object.key === attachment.storage_key)
        if (!object || object.size !== attachment.byte_size || object.httpMetadata.contentType !== attachment.content_type || object.size > DATA_LIMITS.fileBytes) refuse('invalid_archive_files')
        fileBytes += object!.size
      }
      if (fileBytes > DATA_LIMITS.filesBytes) refuse('archive_limit')
      const saved = data.data_state[0]
      const tombstones = data.data_tombstones.slice().sort((a, b) => String(a.table_name).localeCompare(String(b.table_name)) || String(a.key_hash).localeCompare(String(b.key_hash)))
      if (data.data_state.length !== 1 || saved.phase !== 'idle' || saved.lock_id !== null || saved.origin !== journal.origin || saved.epoch !== journal.epoch || canonical(tombstones) !== canonical(journal.tombstones)) refuse('stale_archive')
      const current = await db.prepare('SELECT origin,epoch FROM data_state WHERE singleton=1').first<{origin:string;epoch:number}>()
      const known = (await db.prepare('SELECT epoch,table_name,key_hash FROM data_tombstones').all<Row>()).results
      if ((current?.origin === journal.origin && current.epoch > journal.epoch) || known.some(item => !journal.tombstones.some(other => canonical(item) === canonical(other)))) refuse('erasure_journal_regression')
      for (const item of journal.tombstones) {
        // Grant checkpoints fence older archives without declaring a deleted row.
        if (item.table_name === GRANT_REVOCATION_CHECKPOINT) continue
        const table = manifest.tables.find(table => table.name === item.table_name)
        if (!table) refuse('unsupported_journal_schema')
        const columns = table!.columns.some(column => column.pk) ? table!.columns.filter(column => column.pk).sort((a,b) => a.pk-b.pk) : table!.columns
        for (const row of data[item.table_name]) if (await digest([journal.origin, item.table_name, canonical(columns.map(column => row[column.name]))]) === item.key_hash) refuse('erased_archive_record')
      }
      for (const name of product) for (const row of data[name]) if (canonical(normalize(name, row)) !== canonical(row)) refuse('unsafe_restored_effect')
      return true
    },
  }
}
