import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { inspectProfile, profileSummary } from './operations-profile.mjs'

// Provider-input readiness for a named hosted profile. Structure, tools and
// local state are checked by `node scripts/rer.mjs check|doctor`.
export async function main(args = process.argv.slice(2), root = process.cwd(), env = process.env) {
 if (args.length !== 3 || !['check', 'doctor'].includes(args[0]) || args[1] !== '--profile') throw new Error('invalid-operations-command')
 const result = await inspectProfile(root, args[2], env)
 console.log(JSON.stringify(result, null, 2)); console.error(profileSummary(result))
 if (!result.ok) process.exitCode = 1
 return result
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
 try { await main() } catch {
  console.error(JSON.stringify({ok:false,error:'Invalid command or unreadable operations files. Usage: pnpm run operations -- check|doctor --profile NAME'}))
  process.exitCode = 1
 }
}
