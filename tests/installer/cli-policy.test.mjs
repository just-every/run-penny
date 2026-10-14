import assert from 'node:assert/strict'
import test from 'node:test'
import { cp, mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const source = fileURLToPath(new URL('../..', import.meta.url))
const entry = fileURLToPath(import.meta.resolve('@runeditrun/rer/internal/global/rer.mjs'))
const generated = new Set(['node_modules', '.git', 'dist', '.wrangler', '.rer', '.seed', '.tanstack', '.output', 'test-results'])

// A Penny checkout of this source in a fresh folder: the installed rer loads its
// adapter, where Penny's placement policy runs before any command acts.
async function checkout(area) {
  const root = join(area, 'checkout')
  await cp(source, root, { recursive: true, filter: path => !generated.has(basename(path)) })
  await symlink(join(source, 'node_modules'), join(root, 'node_modules'))
  return root
}

test('Penny refuses ambiguous sibling data before reset, retaining both stores and settings', async t => {
  const area = await mkdtemp(join(tmpdir(), 'penny-placement-')), root = await checkout(area), legacy = join(area, '.penny-local-state-checkout')
  t.after(() => rm(area, { recursive: true, force: true }))
  for (const path of [legacy, join(root, '.wrangler/state')]) { await mkdir(path, { recursive: true }); await writeFile(join(path, 'retained'), 'owned data') }
  await writeFile(join(root, '.dev.vars'), 'AUTH_SECRET=test-only-existing-authority\n', { mode: 0o600 })
  const result = spawnSync(process.execPath, [entry, 'reset', '--yes'], { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 4, result.stderr)
  assert.match(result.stderr, /Ambiguous Penny state/)
  for (const path of [legacy, join(root, '.wrangler/state')]) assert.equal(await readFile(join(path, 'retained'), 'utf8'), 'owned data')
  assert.equal(await readFile(join(root, '.dev.vars'), 'utf8'), 'AUTH_SECRET=test-only-existing-authority\n')
})

test('Penny refuses an external state override without creating canonical data', async t => {
  const area = await mkdtemp(join(tmpdir(), 'penny-external-state-')), root = await checkout(area), state = join(area, 'old-state')
  t.after(() => rm(area, { recursive: true, force: true }))
  await mkdir(state); await writeFile(join(state, 'retained'), 'owned data')
  const result = spawnSync(process.execPath, [entry, 'setup', '--owner-email', 'owner@example.test'], { cwd: root, env: { ...process.env, PENNY_LOCAL_STATE: state }, encoding: 'utf8' })
  assert.equal(result.status, 4, result.stderr)
  assert.equal(await readFile(join(state, 'retained'), 'utf8'), 'owned data')
  await assert.rejects(readFile(join(root, '.dev.vars')), { code: 'ENOENT' })
})

test('A fresh clone\'s first rer install gives no provider credential to dependency build scripts', { timeout: 600000 }, async t => {
  const area = await mkdtemp(join(tmpdir(), 'penny-fresh-install-')), root = join(area, 'checkout'), seen = join(area, 'seen.log')
  t.after(() => rm(area, { recursive: true, force: true }))
  await cp(source, root, { recursive: true, filter: path => !generated.has(basename(path)) })
  // A build script stand-in: the checkout's own postinstall records what pnpm passes it.
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  manifest.scripts.postinstall = `node -e "require('fs').appendFileSync(process.env.PENNY_SEEN_LOG,(process.env.CLOUDFLARE_API_TOKEN||process.env.SENDGRID_API_KEY?'credential':'clean')+'\\n')"`
  await writeFile(join(root, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
  // The copy is its own checkout: an enclosing rer run's operation and local state belong to that run.
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(PENNY|RER)_/.test(name)))
  const result = spawnSync(process.execPath, [entry, 'install'], { cwd: root, encoding: 'utf8', env: { ...inherited, PENNY_SEEN_LOG: seen, CLOUDFLARE_API_TOKEN: 'test-only-provider-token', SENDGRID_API_KEY: 'test-only-mail-key' } })
  assert.equal(result.status, 0, result.stdout.slice(-2000) + result.stderr)
  const lines = (await readFile(seen, 'utf8')).trim().split('\n')
  assert.ok(lines.length >= 1)
  assert.deepEqual([...new Set(lines)], ['clean'])
  // Commands that deploy (pnpm exec rer deploy, pnpm run deploy) keep their own credentials.
  const exec = spawnSync('pnpm', ['exec', 'node', '-e', 'process.stdout.write(String(Boolean(process.env.CLOUDFLARE_API_TOKEN)))'], { cwd: root, encoding: 'utf8', env: { ...inherited, CLOUDFLARE_API_TOKEN: 'test-only-provider-token' } })
  assert.equal(exec.stdout, 'true', exec.stderr)
})
