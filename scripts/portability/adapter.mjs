import { refuse, missing, RerError } from '@runeditrun/rer/errors'
import { relative } from 'node:path'
import { applyMigrations } from '../installer/migrations.mjs'
import { localState, commandEnvironment } from '../installer/settings.mjs'
// A database RER Platform's runner migrated keeps that runner as its only migration authority: Wrangler cannot read its
// rer_migrations ledger and would apply every file again. Such a database must already hold every migration file here,
// as rer's transfer checks again before it moves any data, and no Wrangler migration runs on it.
async function platformLedger({ root, store, signal, operationToken }) {
  const child = store.spawn('Checking migration history', process.execPath, ['scripts/portability/ledger.mjs'], { cwd: root, signal, env: { ...commandEnvironment(), RER_LOCAL_OPERATION: operationToken }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] })
  let reply
  child.on('message', message => { reply = message })
  await new Promise(resolve => { child.once('exit', resolve); child.once('error', resolve) })
  await store.stop(child)
  if (reply?.refused) throw new RerError('restore_refused', `Local transfer refused (${reply.refused}): this database carries RER Platform's migration ledger (rer_migrations), and only Platform's runner may migrate it. Apply every migration of this version through Platform, with no other migration ledger beside it, then run the same command again. Nothing was changed.`, 4)
  if (typeof reply?.platformLedger !== 'boolean') throw new RerError('transfer_failed', 'Local transfer failed: the migration history could not be read. Run the same command again.', 1)
  return reply.platformLedger
}
async function transfer(context, direction) {
  const { root, path, journal, store, signal, operationToken, target, origin, sessionFile } = context
  if (target === 'remote') {
    if (direction !== 'export') throw refuse('Remote restore is not exposed. Import the hosted archive into an empty local installation.')
    if (!origin || !sessionFile) throw missing('Hosted export requires --origin and a private --session-file containing one native owner cookie.')
    await store.run('Downloading complete hosted Penny data', process.execPath, ['scripts/portability/remote-export.mjs', origin, sessionFile, path], { cwd: root, signal, env: commandEnvironment() })
    return { target: 'remote', output: path, journal: path + '.erasure-journal.json', scope: 'Penny domain data and original files; fresh owner and configuration required after restore' }
  }
  if (!await platformLedger(context)) await applyMigrations({ root, stateDirectory: localState(root), run: (label, command, args, options) => store.run(label, command, args, { ...options, cwd: root, signal, env: { ...options.env, RER_LOCAL_OPERATION: operationToken } }) })
  // Product policy stays in this child; no functions cross a JSON boundary. `journal` is
  // `rer import --journal LATER_ARCHIVE`: a later archive whose erasures fence this restore.
  await store.run('Moving Penny installation data', 'pnpm', ['exec', 'tsx', '--tsconfig', 'tsconfig.app.json', 'scripts/portability/worker.ts', direction, path, ...(journal ? [journal] : [])], { cwd: root, signal, env: { ...commandEnvironment(), RER_LOCAL_OPERATION: operationToken } })
  return { target: 'local', [direction === 'export' ? 'output' : 'input']: relative(root, path), journal: relative(root, path) + '.erasure-journal.json', scope: 'Penny domain data and original files; fresh owner and configuration required after restore' }
}
export const pennyPortability = { remote: true, export: context => transfer(context, 'export'), import: context => transfer(context, 'import') }
