// Reads the local store's owner authority straight from its D1 file. `wrangler d1 execute` output is withheld from the
// setup store by rer, so the admission check runs this plain Node command instead and reads its one JSON line.
import { DatabaseSync } from 'node:sqlite'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
const [state, email] = process.argv.slice(2)
const directory = join(state, 'v3/d1/miniflare-D1DatabaseObject')
const holds = path => {
  const db = new DatabaseSync(path, { readOnly: true })
  try { return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='oa_bootstrap'").get()) }
  finally { db.close() }
}
const found = readdirSync(directory).filter(name => name.endsWith('.sqlite')).map(name => join(directory, name)).filter(holds)
if (found.length !== 1) throw new Error('The local store must hold exactly one Penny database.')
const db = new DatabaseSync(found[0], { readOnly: true })
try {
  console.log(JSON.stringify(db.prepare("SELECT (SELECT COUNT(*) FROM oa_bootstrap) AS installed, (SELECT COUNT(*) FROM oa_operators WHERE email=? AND role='owner' AND status='active') AS ownerMatch").get(email)))
} finally { db.close() }
