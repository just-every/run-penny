// Historical Worker-test build uses the same shared custody and command engine.
import { fileURLToPath } from 'node:url'
import { privateDirectory } from '@runeditrun/rer/private-files'
import { withoutLocalVariables } from '@runeditrun/rer/local/build'
import { createCommands } from '@runeditrun/rer/commands'
import { commandEnvironment } from './installer/settings.mjs'
import { buildSource } from './installer/build-source.mjs'
const root = fileURLToPath(new URL('../', import.meta.url))
const store = await createCommands(await privateDirectory(root, ['.seed', 'build']), { logs: [] })
try {
  await withoutLocalVariables(root, async ({ secrets, operation }) => {
    store.addSecrets(secrets)
    await buildSource((command, args) => store.run('Building predecessor test Worker', command, args, { cwd: root, env: { ...commandEnvironment(), RER_LOCAL_OPERATION: operation.token } }), { predecessor: true })
  })
} finally { await store.closeCommands() }
