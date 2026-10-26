import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { deploymentSpec } from './delivery/base/spec.mjs'
import { packagingConfig } from './delivery/base/package.mjs'
import { loadSetupManifest } from './delivery/base/setup-manifest.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const config = JSON.parse(await readFile(new URL('../packaging.json', import.meta.url), 'utf8'))

// Read the emitted Wrangler configuration and migration bytes through the same
// Base reader that packages Penny's managed artifact. Run after rer build.
const spec = await deploymentSpec(root, config.artifact.specInputs)
const { project, workflow, setup } = packagingConfig(config)
const selected = await loadSetupManifest(root, setup, config.artifact.specInputs.mail)
const descriptor = { ...project, setup: { path: selected.path, sha256: selected.sha256 } }
const json = value => `${JSON.stringify(value, null, 2)}\n`
const files = new Map([
  ['management/integration/deployment-spec.json', json(spec)],
  ['rer-project.json', json(descriptor)],
  ['.github/workflows/rer-managed.yml', workflow],
])
const [mode = '--check', ...extra] = process.argv.slice(2)
if (extra.length || !['--check', '--write'].includes(mode)) {
  throw new Error('Use build-deployment-spec.mjs --check or --write after rer build')
}
for (const [path, bytes] of files) {
  const file = new URL(`../${path}`, import.meta.url)
  if (mode === '--write') {
    await mkdir(new URL('.', file), { recursive: true })
    await writeFile(file, bytes)
    continue
  }
  let published
  try { published = await readFile(file, 'utf8') } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  if (published !== bytes) throw new Error(`${path} drift: run pnpm delivery:spec after rer build and commit the result.`)
}
console.log(mode === '--write' ? 'Published the build-derived deployment specification, setup digest and workflow.' : 'Deployment specification, setup digest and workflow match the build (Base deploymentSpec).')
