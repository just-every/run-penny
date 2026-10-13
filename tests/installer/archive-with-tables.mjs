import { createReadStream } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { DatabaseSync } from 'node:sqlite'
import { readArchive, makePart, canonicalJson, sha256 } from '../../scripts/base-cli/modules/portability/index.mjs'
import { ContentVerifier } from '../../scripts/base-cli/modules/portability/format.mjs'

// Test-only: rewrite a real Penny archive so it also carries the named tables
// with their rows from a local store, re-framed with valid checksums, as a
// hand-edited archive would be. Penny's own export never writes these tables.
export async function archiveWithTables(source, target, database, names) {
  let manifest
  const items = []
  for await (const record of readArchive(Readable.toWeb(createReadStream(source)))) {
    if (record.kind === 'manifest') manifest = record
    if (record.kind === 'part') items.push(...record.items)
  }
  const db = new DatabaseSync(database, { readOnly: true })
  const added = names.map(name => {
    const { sql } = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(name)
    const columns = db.prepare(`PRAGMA table_xinfo("${name}")`).all().map(c => ({ name: c.name, type: c.type, notnull: c.notnull, pk: c.pk }))
    const rows = db.prepare(`SELECT * FROM "${name}"`).all().map(row => ({ ...row }))
    return { table: { name, sql, columns, dependencies: [], rowidAlias: null, count: rows.length }, rows }
  })
  db.close()
  const tables = [...manifest.tables, ...added.map(entry => entry.table)].sort((a, b) => a.name < b.name ? -1 : 1)
  const rowsOf = name => added.find(entry => entry.table.name === name)?.rows.map((row, index) => ({ kind: 'row', table: name, index, row }))
    ?? items.filter(item => item.kind === 'row' && item.table === name)
  const ordered = [...tables.flatMap(table => rowsOf(table.name)), ...items.filter(item => item.kind !== 'row')]
  const next = { ...manifest, tables, schema: await sha256(canonicalJson(tables.map(({ name, sql }) => ({ name, sql })))), partCount: 0 }
  const parts = []
  for (let start = 0; start < ordered.length; start += 500) parts.push(await makePart(parts.length, ordered.slice(start, start + 500)))
  next.partCount = parts.length
  const verifier = new ContentVerifier(next)
  for (const part of parts) for (const item of part.items) verifier.add(item)
  const lines = [next, ...parts, { kind: 'closing', partCount: parts.length, contentHash: verifier.digest() }]
  await writeFile(target, lines.map(line => canonicalJson(line) + '\n').join(''), { mode: 0o600 })
}
