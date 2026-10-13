import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, rm, symlink, writeFile, chmod, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { verifyBaseSource } from '../../scripts/verify-base-source.mjs'

async function fixture(t) {
 const root = await mkdtemp(join(tmpdir(), 'penny-base-pin-'))
 t.after(() => rm(root, { recursive: true, force: true }))
 execFileSync('git', ['init', '--quiet'], { cwd: root })
 await mkdir(join(root, 'modules', 'sample'), { recursive: true })
 await mkdir(join(root, 'base'))
 await writeFile(join(root, 'modules/sample/index.mjs'), 'export const example = true\n')
 await writeFile(join(root, 'base/PROVENANCE.json'), JSON.stringify({
  schemaVersion: 1,
  copies: [{ path: 'modules/sample', originPath: 'modules/sample', revision: 'a'.repeat(40),
   files: { 'modules/sample/index.mjs': createHash('sha256').update('export const example = true\n').digest('hex') },
   modes: { 'modules/sample/index.mjs': '100644' } }],
 }))
 return root
}

test('Base source verification rejects changed bytes', async t => {
 const root = await fixture(t)
 await verifyBaseSource(root)
 await writeFile(join(root, 'modules/sample/index.mjs'), 'changed source\n')
 await assert.rejects(verifyBaseSource(root), /Base custody: modified/)
})

test('Base source verification rejects an unrecorded file', async t => {
 const root = await fixture(t)
 await writeFile(join(root, 'modules/sample/extra.mjs'), 'unrecorded\n')
 await assert.rejects(verifyBaseSource(root), /Base custody: (?:unrecorded|missing)/)
})

test('Base source verification rejects a missing file', async t => {
 const root = await fixture(t)
 await rm(join(root, 'modules/sample/index.mjs'))
 await assert.rejects(verifyBaseSource(root), /Base custody: (?:unrecorded|missing)/)
})

test('Base source verification rejects symbolic links', async t => {
 const root = await fixture(t)
 await rm(join(root, 'modules/sample/index.mjs'))
 await symlink('../../base/PROVENANCE.json', join(root, 'modules/sample/index.mjs'))
 await assert.rejects(verifyBaseSource(root), /Base custody: not-a-file/)
})


test('[BASE-SOURCE-001] copied executable mode is custody, not cosmetic metadata', async t => {
 const root = await fixture(t)
 await chmod(join(root, 'modules/sample/index.mjs'), 0o755)
 await assert.rejects(verifyBaseSource(root), /Base custody: mode/)
})

test('[BASE-SOURCE-001] the maintained source check rejects wrong origin, pin, mapping and lock controls', async t => {
 const area = await mkdtemp(join(tmpdir(), 'penny-source-check-'))
 t.after(() => rm(area, { recursive: true, force: true }))
 const root = join(area, 'edition'), origin = join(area, 'origin')
 for (const directory of [root, origin]) await mkdir(join(directory, 'modules/sample'), { recursive: true })
 const git = (cwd, ...args) => execFileSync('git', ['-c','user.name=Penny tests','-c','user.email=test@penny.invalid','-c','commit.gpgsign=false',...args], { cwd, stdio: 'pipe' })
 for (const directory of [root, origin]) {
  git(directory, 'init', '--quiet')
  await writeFile(join(directory, 'modules/sample/index.mjs'), 'export const example = true\n')
 }
 git(origin, 'add', '.'); git(origin, 'commit', '-qm', 'Test-only source')
 const revision = git(origin, 'rev-parse', 'HEAD').toString().trim()
 const recipe = { schemaVersion: 1, id: 'test/penny', toolchain: { id: 'runeditrun/edition-authoring', version: '1.1.0' }, parent: null,
  components: [{ id: 'test/sample', role: 'module', source: { kind: 'local', paths: ['modules/sample'], origin: { repository: origin, revision, paths: ['modules/sample'] }, mappings: [{ path: 'modules/sample', originPath: 'modules/sample' }] } }],
 }
 const manifest = join(root, 'edition.json'), lock = join(root, 'sources.lock.json')
 await writeFile(manifest, JSON.stringify(recipe))
 git(root, 'add', '.')
 const cli = fileURLToPath(new URL('../../scripts/edition-authoring/cli.mjs', import.meta.url))
 const run = command => execFileSync(process.execPath, [cli, command], { cwd: root, stdio: 'pipe' })
 run('lock')
 const savedLock = await readFile(lock)
 run('check')
 for (const [name, mutate] of [
  ['origin', item => { item.components[0].source.origin.repository = root }],
  ['pin', item => { item.components[0].source.origin.revision = '0'.repeat(40) }],
  ['mapping', item => { item.components[0].source.mappings[0].originPath = 'modules/missing' }],
 ]) {
  const changed = structuredClone(recipe); mutate(changed)
  await writeFile(manifest, JSON.stringify(changed))
  assert.throws(() => run('check'), undefined, `Wrong ${name} must refuse`)
 }
 await writeFile(manifest, JSON.stringify(recipe))
 await writeFile(lock, JSON.stringify({ ...JSON.parse(savedLock), manifest: '0'.repeat(64) }))
 assert.throws(() => run('check'), /Stale lock|integrity mismatch/)
 await writeFile(lock, savedLock)
 run('check')
})
