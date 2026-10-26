import assert from 'node:assert/strict'
import test from 'node:test'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {mkdtemp, mkdir, cp, symlink, rm, stat, chmod, readFile, rename} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {getPlatformProxy} from 'wrangler'
import {splitSqlStatements} from '../../scripts/delivery/base/sql-statements.mjs'
import {assertArchiveRestored} from './archive-comparison.mjs'

const execute = promisify(execFile)
const source = fileURLToPath(new URL('../../', import.meta.url))
const rer = fileURLToPath(import.meta.resolve('@runeditrun/rer/internal/global/rer.mjs'))

// RER Platform's runner records each deployment-spec migration in rer_migrations, in the same request as the file's
// statements (platform src/integrations/migration-batch.ts); its effect stands in for the hosted service here.
async function platformMigrations(db) {
  const {migrations} = JSON.parse(await readFile(join(source, 'management/integration/deployment-spec.json'), 'utf8'))
  await db.prepare('CREATE TABLE IF NOT EXISTS rer_migrations (name TEXT PRIMARY KEY, sha256 TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run()
  for (const migration of migrations) await db.batch([db.prepare('INSERT INTO rer_migrations(name,sha256) VALUES (?,?)').bind(migration.name, migration.sha256), ...splitSqlStatements(migration.sql).map(sql => db.prepare(sql))])
}

test('[DATA-001 DATA-003] import before setup restores an older backup with either migration ledger and replays later settings and status clocks', {timeout: 600_000}, async t => {
  const area = await mkdtemp(join(tmpdir(), 'penny-older-archive-'))
  t.after(() => rm(area, {recursive: true, force: true}))
  const env = {...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false', RER_JOBS_DIR: join(area, 'jobs'), RER_SERVERS_DIR: join(area, 'servers')}
  for (const name of Object.keys(env)) if (/^(AUTH_|MAIL_|OIDC_|SENDGRID_|RESEND_|SETUP_TOKEN|OPERATOR_EMAIL|APP_ORIGIN|PENNY_)/.test(name)) delete env[name]
  delete env.RER_LOCAL_OPERATION
  const command = async (root, args) => {
    try { await execute(process.execPath, [rer, ...args, '--non-interactive'], {cwd: root, env, maxBuffer: 4 * 1024 * 1024}) }
    catch (error) { throw new Error(`rer ${args[0]} failed: ` + error.stderr?.slice(-3000)) }
  }
  for (const platform of [false, true]) {
    const root = join(area, platform ? 'platform' : 'native')
    await mkdir(root)
    for (const path of ['scripts', 'base', 'src', 'migrations', 'wrangler.jsonc', 'package.json', 'OPERATIONS.json', 'OPERATIONS.md', 'ACCEPTANCE.md', 'rer-setup.json', 'tsconfig.json', 'tsconfig.app.json', '.node-version']) {
      await cp(join(source, path), join(root, path), {recursive: true})
    }
    await symlink(join(source, 'node_modules'), join(root, 'node_modules'), 'dir')
    await cp(join(source, 'tests/fixtures/older-archive'), join(root, 'exports'), {recursive: true})
    await rename(join(root, 'exports/penny.archive'), join(root, 'exports/penny.rer'))
    for (const suffix of ['', '.erasure-journal.json']) await chmod(join(root, 'exports/penny.rer') + suffix, 0o600)
    const options = {configPath: resolve(root, 'wrangler.jsonc'), persist: {path: join(root, '.wrangler/state/v3')}, remoteBindings: false}
    // A native destination is empty; import prepares its schema with Wrangler.
    if (platform) {
      const proxy = await getPlatformProxy(options)
      try { await platformMigrations(proxy.env.DB) } finally { await proxy.dispose() }
    }
    await command(root, ['import', '--input', 'exports/penny.rer', '--yes'])
    await assert.rejects(stat(join(root, '.dev.vars')), {code: 'ENOENT'}, 'restore precedes setup and never creates private settings')
    // The restored installation backs up again through the same door.
    await command(root, ['export', '--output', 'exports/again.rer'])
    const proxy = await getPlatformProxy(options)
    try {
      console.log(await assertArchiveRestored(join(root, 'exports/penny.rer'), proxy.env))
      await assertArchiveRestored(join(root, 'exports/again.rer'), proxy.env)
      assert.equal(await proxy.env.DB.prepare('SELECT COUNT(*) n FROM oa_operators').first('n'), 0, 'destination still needs its own owner')
      // Platform's runner stays the database's only migration authority: Wrangler never adds its ledger beside it.
      const ledgers = (await proxy.env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('rer_migrations','d1_migrations')").all()).results.map(row => row.name)
      assert.deepEqual(ledgers, [platform ? 'rer_migrations' : 'd1_migrations'])
    } finally { await proxy.dispose() }
  }
})
