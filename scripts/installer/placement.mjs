import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parse } from '@runeditrun/rer/parse'
import { localState, commandEnvironment } from './settings.mjs'

// rer loads this adapter before any verb acts, so Penny's product policy runs
// first: a changing command refuses ambiguous local data (exit 4) before it
// touches anything, including reset, and the frozen install runs with Penny's
// command environment (no inherited credentials). Read-only inspection, help
// and --stop stay usable before configuration.
const root = realpathSync(fileURLToPath(new URL('../..', import.meta.url)))
const readOnly = new Set(['describe', 'check', 'doctor', 'release', 'archive'])

function commandPreflight(argv) {
  let options
  try { options = parse(argv, process.cwd(), { deferTail: true }) } catch { return }
  if (options.help || readOnly.has(options.verb) || options.stop) return
  let cwd
  try { cwd = realpathSync(options.cwd) } catch { return }
  if (cwd !== root) return
  try { localState(root) } catch (error) {
    console.error(error.message)
    process.exit(4)
  }
  if (options.verb === 'install') {
    const clean = commandEnvironment()
    for (const name of Object.keys(process.env)) if (!(name in clean)) delete process.env[name]
    Object.assign(process.env, clean)
  }
}

commandPreflight(process.argv.slice(2))
