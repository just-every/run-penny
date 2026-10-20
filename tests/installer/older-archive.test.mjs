import assert from 'node:assert/strict'
import test from 'node:test'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {mkdtemp, mkdir, cp, symlink, rm, stat, chmod} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {getPlatformProxy} from 'wrangler'
import {assertArchiveRestored} from './archive-comparison.mjs'

const execute = promisify(execFile)
const source = fileURLToPath(new URL('../../', import.meta.url))
const rer = fileURLToPath(import.meta.resolve('@runeditrun/rer/internal/global/rer.mjs'))

test('[DATA-001 DATA-003] import before setup restores an older backup and replays later settings and status clocks', {timeout: 600_000}, async t => {
  const area = await mkdtemp(join(tmpdir(), 'penny-older-archive-')), root = join(area, 'installation')
  t.after(() => rm(area, {recursive: true, force: true}))
  await mkdir(root)
  for (const path of ['scripts', 'base', 'src', 'migrations', 'wrangler.jsonc', 'package.json', 'OPERATIONS.json', 'OPERATIONS.md', 'ACCEPTANCE.md', 'rer-setup.json', 'tsconfig.json', 'tsconfig.app.json', '.node-version']) {
    await cp(join(source, path), join(root, path), {recursive: true})
  }
  await symlink(join(source, 'node_modules'), join(root, 'node_modules'), 'dir')
  await cp(join(source, 'tests/fixtures/older-archive'), join(root, 'exports'), {recursive: true})
  for (const suffix of ['', '.erasure-journal.json']) await chmod(join(root, 'exports/penny.rer') + suffix, 0o600)
  const env = {...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false', RER_JOBS_DIR: join(area, 'jobs'), RER_SERVERS_DIR: join(area, 'servers')}
  for (const name of Object.keys(env)) if (/^(AUTH_|MAIL_|OIDC_|SENDGRID_|RESEND_|SETUP_TOKEN|OPERATOR_EMAIL|APP_ORIGIN|PENNY_)/.test(name)) delete env[name]
  delete env.RER_LOCAL_OPERATION
  try {
    await execute(process.execPath, [rer, 'import', '--input', 'exports/penny.rer', '--yes', '--non-interactive'], {cwd: root, env, maxBuffer: 4 * 1024 * 1024})
  } catch (error) {
    throw new Error('Older archive import failed: ' + error.stderr?.slice(-3000), {cause: error})
  }
  await assert.rejects(stat(join(root, '.dev.vars')), {code: 'ENOENT'}, 'restore precedes setup and never creates private settings')
  const proxy = await getPlatformProxy({configPath: resolve(root, 'wrangler.jsonc'), persist: {path: join(root, '.wrangler/state/v3')}, remoteBindings: false})
  try {
    console.log(await assertArchiveRestored(join(root, 'exports/penny.rer'), proxy.env))
    assert.equal(await proxy.env.DB.prepare('SELECT COUNT(*) n FROM oa_operators').first('n'), 0, 'destination still needs its own owner')
  } finally { await proxy.dispose() }
})
