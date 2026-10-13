import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
const entry = new URL('../../scripts/rer.mjs', import.meta.url).pathname

test('Penny refuses ambiguous sibling data before reset, retaining both stores and settings', async t => {
  const area = await mkdtemp(join(tmpdir(), 'penny-placement-')), root = join(area, 'checkout'), legacy = join(area, '.penny-local-state-checkout')
  t.after(() => rm(area, { recursive: true, force: true }))
  for (const path of [legacy, join(root, '.wrangler/state')]) { await mkdir(path, { recursive: true }); await writeFile(join(path, 'retained'), 'owned data') }
  await writeFile(join(root, '.dev.vars'), 'AUTH_SECRET=test-only-existing-authority\n', { mode: 0o600 })
  const result = spawnSync(process.execPath, [entry, 'reset', '--yes', '--cwd', root], { encoding: 'utf8' })
  assert.equal(result.status, 4)
  for (const path of [legacy, join(root, '.wrangler/state')]) assert.equal(await readFile(join(path, 'retained'), 'utf8'), 'owned data')
  assert.equal(await readFile(join(root, '.dev.vars'), 'utf8'), 'AUTH_SECRET=test-only-existing-authority\n')
})

test('Penny refuses an external state override without creating canonical data', async t => {
  const area = await mkdtemp(join(tmpdir(), 'penny-external-state-')), root = join(area, 'checkout'), state = join(area, 'old-state')
  t.after(() => rm(area, { recursive: true, force: true }))
  await mkdir(root); await mkdir(state); await writeFile(join(state, 'retained'), 'owned data')
  const result = spawnSync(process.execPath, [entry, 'setup', '--owner-email', 'owner@example.test', '--cwd', root], { env: { ...process.env, PENNY_LOCAL_STATE: state }, encoding: 'utf8' })
  assert.equal(result.status, 4)
  assert.equal(await readFile(join(state, 'retained'), 'utf8'), 'owned data')
  await assert.rejects(readFile(join(root, '.dev.vars')), { code: 'ENOENT' })
})
