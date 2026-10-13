import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = async (name) => JSON.parse(await readFile(new URL(`../../${name}`, import.meta.url), 'utf8'))

test('[REL-001] every project identity names the intended public publisher and repository', async () => {
  const project = await read('rer-project.json'), edition = await read('edition.json')
  const operations = await read('OPERATIONS.json'), lock = await read('sources.lock.json')
  assert.equal(project.sourceRepository, 'https://github.com/just-every/run-penny')
  assert.equal(operations.project, project.projectId)
  assert.equal(edition.id, project.projectId)
  assert.equal(lock.edition, project.projectId)
  assert.ok(edition.components.some((component) => component.role === 'edition' && component.id === project.projectId))
  assert.ok(lock.components.some((component) => component.id === project.projectId))
})
