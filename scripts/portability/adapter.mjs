import { refuse, missing } from '@runeditrun/rer/errors'
import { relative } from 'node:path'
import { applyMigrations } from '../installer/migrations.mjs'
import { localState, commandEnvironment } from '../installer/settings.mjs'
async function transfer(context, direction) {
  const { root, path, journal, store, signal, operationToken, target, origin, sessionFile } = context
  if (target === 'remote') {
    if (direction !== 'export') throw refuse('Remote restore is not exposed. Import the hosted archive into an empty local installation.')
    if (!origin || !sessionFile) throw missing('Hosted export requires --origin and a private --session-file containing one native owner cookie.')
    await store.run('Downloading complete hosted Penny data', process.execPath, ['scripts/portability/remote-export.mjs', origin, sessionFile, path], { cwd: root, signal, env: commandEnvironment() })
    return { target: 'remote', output: path, journal: path + '.erasure-journal.json', scope: 'Penny domain data and original files; fresh owner and configuration required after restore' }
  }
  await applyMigrations({ root, stateDirectory: localState(root), run: (label, command, args, options) => store.run(label, command, args, { ...options, cwd: root, signal, env: { ...options.env, RER_LOCAL_OPERATION: operationToken } }) })
  // Product policy stays in this child; no functions cross a JSON boundary. `journal` is
  // `rer import --journal LATER_ARCHIVE`: a later archive whose erasures fence this restore.
  await store.run('Moving Penny installation data', 'pnpm', ['exec', 'tsx', '--tsconfig', 'tsconfig.app.json', 'scripts/portability/worker.ts', direction, path, ...(journal ? [journal] : [])], { cwd: root, signal, env: { ...commandEnvironment(), RER_LOCAL_OPERATION: operationToken } })
  return { target: 'local', [direction === 'export' ? 'output' : 'input']: relative(root, path), journal: relative(root, path) + '.erasure-journal.json', scope: 'Penny domain data and original files; fresh owner and configuration required after restore' }
}
export const pennyPortability = { remote: true, export: context => transfer(context, 'export'), import: context => transfer(context, 'import') }
