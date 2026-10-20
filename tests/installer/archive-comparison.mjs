import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {readArchive} from '@runeditrun/rer/modules/portability'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value
const image = rows => rows.map(row => JSON.stringify(canonical(row))).sort()
const quote = name => '"' + name.replaceAll('"', '""') + '"'

// Compare against the archive itself, including empty tables and original bytes.
export async function assertArchiveRestored(archive, {DB: db, FILES: files}) {
  const records = []
  for await (const record of readArchive(new Blob([await readFile(archive)]).stream())) records.push(record)
  const manifest = records.find(record => record.kind === 'manifest')
  const items = records.filter(record => record.kind === 'part').flatMap(record => record.items)
  let rows = 0
  for (const table of manifest.tables) {
    const columns = table.columns.filter(column => !column.generated).map(column => column.name)
    const expected = items.filter(item => item.kind === 'row' && item.table === table.name).map(item => item.row)
    const actual = (await db.prepare(`SELECT ${columns.map(quote).join(',')} FROM ${quote(table.name)}`).all()).results
    const project = values => values.map(row => Object.fromEntries(columns.map(column => [column, row[column]])))
    assert.deepEqual(image(project(actual)), image(project(expected)), table.name + ' retains every archived cell')
    rows += expected.length
  }
  for (const object of manifest.objects) {
    const restored = await files.get(object.key)
    assert.ok(restored, object.key + ' exists')
    assert.equal(hash(new Uint8Array(await restored.arrayBuffer())), object.sha256, object.key + ' retains original bytes')
    assert.equal(restored.httpMetadata?.contentType, object.httpMetadata?.contentType)
  }
  assert.equal(await db.prepare('SELECT COUNT(*) n FROM penny_triage_settings').first('n'), 1, 'later settings seed is replayed')
  assert.equal(await db.prepare('SELECT COUNT(*) n FROM penny_triage_status_clock').first('n'), 1, 'later status clock backfill is replayed')
  assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results, [])
  return {tables: manifest.tables.length, rows, objects: manifest.objects.length, settings: 1, clock: 1}
}
