import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

// App health also initializes R2 metadata. Read the actual product D1 database,
// rather than treating the first local SQLite file as the workspace.
export async function localDatabaseFile(state) {
  const matches = []
  for (const name of await readdir(state, { recursive: true })) if (name.endsWith('.sqlite')) {
    const path = join(state, name), db = new DatabaseSync(path, { readOnly: true })
    try {
      if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='boards'").get()) matches.push(path)
    } finally { db.close() }
  }
  if (matches.length !== 1) throw new Error('The local proof needs one installed product database.')
  return matches[0]
}
