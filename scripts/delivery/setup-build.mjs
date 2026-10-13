import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {join} from 'node:path'

// The trusted builder's initial Node version is independent of Penny's runtime.
// Install pinned tools locally before installing the frozen product lockfile.
// Only process/path inputs enter dependency installation, never provider values.
const root = fileURLToPath(new URL('../../', import.meta.url))
const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'TEMP', 'TMP', 'SystemRoot']
  .filter(name => process.env[name] !== undefined).map(name => [name, process.env[name]]))
env.CI = 'true'
function run(command, args) {
  const result = spawnSync(command, args, {cwd: root, env, stdio: 'inherit'})
  if (result.error || result.status !== 0) throw new Error('Delivery dependency preparation failed')
}
run('npm', ['install', '--prefix', join(root, '.rer-tools'), '--no-save', '--package-lock=false',
  '--no-audit', '--no-fund', 'node@22.20.0', 'pnpm@10.12.4'])
env.PATH = join(root, '.rer-tools/node_modules/.bin') + ':' + env.PATH
run('pnpm', ['install', '--frozen-lockfile'])
run('pnpm', ['exec', 'playwright', 'install', '--with-deps', 'chromium'])
