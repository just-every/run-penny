import assert from 'node:assert/strict'
import test from 'node:test'
import {spawnSync} from 'node:child_process'
import {cp, mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {dirname, join, resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {fileURLToPath} from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const cli = join(root, 'scripts/delivery/base/cli.mjs')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
async function files(directory) {
  const entries = await readdir(directory, {withFileTypes: true})
  return (await Promise.all(entries.map(async entry => entry.isDirectory()
    ? files(join(directory, entry.name)) : [join(directory, entry.name)]))).flat()
}

test('delivery commands preserve the built Worker, assets, migrations and installer input and refuse invalid setup', async t => {
  const candidate = await mkdtemp(join(tmpdir(), 'penny-delivery-'))
  t.after(() => rm(candidate, {recursive: true, force: true}))
  // These are actual Penny build outputs, not a replacement Worker or fixture.
  for (const path of ['dist', 'migrations', 'rer-setup.json']) {
    await cp(join(root, path), join(candidate, path), {recursive: true})
  }
  await cp(join(root, 'scripts/delivery/base/packaging.json'), join(candidate, 'packaging.json'))
  const run = (...args) => spawnSync(process.execPath, args, {
    cwd: candidate, encoding: 'utf8', env: {PATH: process.env.PATH}, timeout: 30_000,
  })
  const produce = output => {
    const result = run(cli, 'package', '--config', 'packaging.json', '--output', output)
    assert.equal(result.status, 0, result.stderr)
    return JSON.parse(result.stdout)
  }
  const first = produce('first'), second = produce('second')
  const manifestBytes = await readFile(first.artifact)
  assert.deepEqual(manifestBytes, await readFile(second.artifact))
  const manifest = JSON.parse(manifestBytes)
  assert.equal(manifest.schema, 2)
  for (const [entries, source, name] of [[manifest.modules, 'dist/server', 'name'], [manifest.assets, 'dist/client', 'path']]) {
    assert.ok(entries.length > 0)
    const inputs = (await files(join(candidate, source)))
      .filter(path => source !== 'dist/server' || !/(?:^|\/)wrangler\.json$|\.map$/i.test(path))
    assert.equal(entries.length, inputs.length, 'Every emitted module or asset must be included')
    for (const entry of entries) {
      const bytes = await readFile(join(dirname(first.artifact), entry.payload))
      assert.equal(bytes.length, entry.size)
      assert.equal(hash(bytes), entry.sha256)
      assert.deepEqual(bytes, await readFile(join(candidate, source, entry[name].replace(/^\//, ''))))
    }
  }
  const emitted = JSON.parse(await readFile(join(candidate, 'dist/server/wrangler.json')))
  const expectedResources = [
    ...emitted.d1_databases.map(({binding}) => ({kind: 'd1', binding})),
    ...emitted.r2_buckets.map(({binding}) => ({kind: 'r2', binding})),
    ...emitted.queues.producers.map(({binding}) => ({kind: 'queue', binding})),
  ]
  assert.deepEqual(manifest.deploymentSpec.resources, expectedResources)
  assert.deepEqual(manifest.deploymentSpec.schedules, emitted.triggers.crons)
  assert.deepEqual(manifest.deploymentSpec.publicVariables, emitted.vars ?? {})
  assert.deepEqual(manifest.deploymentSpec.queueConsumers, [])
  const migrationInputs = (await Promise.all(emitted.d1_databases.map(database =>
    files(resolve(candidate, 'dist/server', database.migrations_dir))))).flat().filter(path => path.endsWith('.sql'))
  assert.equal(manifest.deploymentSpec.migrations.length, migrationInputs.length)
  for (const migration of manifest.deploymentSpec.migrations) {
    const database = emitted.d1_databases.find(row => row.binding === migration.binding)
    const bytes = await readFile(resolve(candidate, 'dist/server', database.migrations_dir, migration.name))
    assert.deepEqual(Buffer.from(migration.sql), bytes)
    assert.equal(migration.sha256, hash(bytes))
  }
  const setup = await readFile(first.setup)
  assert.deepEqual(setup, await readFile(join(root, 'rer-setup.json')))
  const project = JSON.parse(await readFile(first.project))
  assert.equal(project.setup.sha256, hash(setup))
  assert.deepEqual(project, JSON.parse(await readFile(join(root, 'rer-project.json'))))
  const artifact = run(join(root, 'scripts/build-delivery-artifact.mjs'))
  assert.equal(artifact.status, 0, artifact.stderr)
  assert.deepEqual(await readFile(artifact.stdout.trim()), manifestBytes)

  // A setup document that the installer cannot admit cannot become a package.
  const invalid = JSON.parse(setup)
  invalid.fields.push({...invalid.fields[0]})
  await writeFile(join(candidate, 'rer-setup.json'), JSON.stringify(invalid, null, 2) + '\n')
  assert.notEqual(run(cli, 'package', '--config', 'packaging.json', '--output', 'invalid').status, 0)
  await rm(join(candidate, 'delivery-artifact'), {recursive: true})
  assert.notEqual(run(join(root, 'scripts/build-delivery-artifact.mjs')).status, 0)
})
