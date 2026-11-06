// Read-only comparison: invoke the producer without the --write CLI.
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
const root = process.cwd()
const { deploymentSpec } = await import(pathToFileURL(resolve(root, 'scripts/delivery/base/spec.mjs')))
const config = JSON.parse(await readFile('packaging.json', 'utf8'))
const generated = await deploymentSpec(root, config.artifact.specInputs)
const publishedBytes = await readFile('management/integration/deployment-spec.json', 'utf8')
const published = JSON.parse(publishedBytes)
const encoded = JSON.stringify(generated, null, 2) + '\n'
const identity = m => ({ binding:m.binding, name:m.name, sha256:m.sha256 })
const keys = new Set([...Object.keys(generated), ...Object.keys(published)])
const differentTopLevel = [...keys].filter(k => JSON.stringify(generated[k]) !== JSON.stringify(published[k]))
const missingFromPublished = generated.migrations.filter(m => !published.migrations.some(p => p.name === m.name)).map(identity)
const extraInPublished = published.migrations.filter(m => !generated.migrations.some(p => p.name === m.name)).map(identity)
const changedMigrations = generated.migrations.filter(m => published.migrations.some(p => p.name === m.name && JSON.stringify(p) !== JSON.stringify(m))).map(identity)
console.log(JSON.stringify({published_sha256:createHash('sha256').update(publishedBytes).digest('hex'),computed_sha256:createHash('sha256').update(encoded).digest('hex'),exact_bytes_equal:publishedBytes===encoded,differentTopLevel,published_migrations:published.migrations.length,computed_migrations:generated.migrations.length,missingFromPublished,extraInPublished,changedMigrations}, null, 2))
