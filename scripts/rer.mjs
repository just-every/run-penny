#!/usr/bin/env node
import { main } from './base-cli/cli/main.mjs'
import { parse } from './base-cli/cli/parse.mjs'
import { localState, commandEnvironment } from './installer/settings.mjs'
// Product placement policy runs before any mutating shared command, including
// reset. Read-only inspection and help remain usable before configuration.
try {
  const options = parse(process.argv.slice(2), process.cwd())
  if (!options.help && !['describe', 'check', 'doctor', 'release'].includes(options.verb) && !options.stop) localState(options.cwd)
  if (options.verb === 'install') {
    const clean = commandEnvironment()
    for (const name of Object.keys(process.env)) if (!(name in clean)) delete process.env[name]
    Object.assign(process.env, clean)
  }
  process.exitCode = await main()
} catch (error) {
  if (error.message.startsWith('Ambiguous Penny state')) { console.error(error.message); process.exitCode = 4 }
  else process.exitCode = await main()
}
