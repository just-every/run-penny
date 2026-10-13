// Penny's paid/network edge only: actual owner adapter, packaging, migrations,
// private settings and ledger run against this account-shaped HTTP fixture.
import { DatabaseSync } from 'node:sqlite'
import { randomUUID, createHash } from 'node:crypto'
export function ownerProvider() {
  const accountId = 'a'.repeat(32), token = 'test-only-penny-account-token'
  const state = { calls: [], writes: [], databases: [], buckets: [], queues: [], workers: new Map() }
  const workerState = name => {
    if (!state.workers.has(name)) state.workers.set(name, { secrets: [], schedules: [], settings: null, deployments: [], version: null, subdomain: false })
    return state.workers.get(name)
  }
  for (const key of ['secrets', 'schedules']) Object.defineProperty(state, key, { get: () => workerState('penny-production')[key] })
  const failures = []
  const response = result => Response.json({ success: true, errors: [], result })
  const missing = () => Response.json({ success: false, errors: [{ message: 'missing' }] }, { status: 404 })
  const database = name => { const row = { uuid: randomUUID(), name, db: new DatabaseSync(':memory:') }; state.databases.push(row); return row }
  async function fetch(input, init = {}) {
    const url = new URL(input), method = init.method ?? 'GET'
    if (url.hostname.endsWith('.fixture-account.workers.dev')) {
      if (init.headers?.Authorization) throw Error('credential on health request')
      const worker = state.workers.get(url.hostname.split('.')[0])
      if (!worker?.settings) return missing()
      const values = Object.fromEntries(worker.settings.bindings.filter(x => x.type === 'plain_text').map(x => [x.name, x.text]))
      return Response.json({ ok: true, deployment: { sourceSha: values.RER_DEPLOY_SOURCE, fingerprint: values.RER_DEPLOY_FINGERPRINT, versionId: worker.version.id } })
    }
    const prefix = `/client/v4/accounts/${accountId}`
    if (url.origin !== 'https://api.cloudflare.com' || !url.pathname.startsWith(prefix + '/')) throw Error('unexpected account destination')
    const path = url.pathname.slice(prefix.length)
    if (init.headers?.Authorization !== `Bearer ${path === '/workers/assets/upload' ? 'penny-upload-ticket' : token}`) throw Error('invalid account credential')
    state.calls.push({ method, path })
    const failure = failures.findIndex(item => item.method === method && item.path.test(path))
    let lost = false
    if (failure !== -1) {
      const item = failures.splice(failure, 1)[0]
      if (!item.afterApply) return Response.json({ success: false, errors: [{ message: 'injected interruption' }] }, { status: 500 })
      lost = true
    }
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body
    const write = () => state.writes.push({ method, path })
    const list = rows => Response.json({ success: true, result: rows, result_info: { page: 1, total_pages: 1, total_count: rows.length } })
    let result
    if (path === '/d1/database') {
      if (method === 'GET') return list(state.databases.map(({ db, ...row }) => row))
      const { db, ...row } = database(body.name); write(); result = response(row)
    } else if (path.startsWith('/d1/database/')) {
      const row = state.databases.find(row => row.uuid === path.split('/')[3])
      if (!row) return missing()
      if (!path.endsWith('/query')) return response({ uuid: row.uuid, name: row.name })
      if (/^SELECT /i.test(body.sql)) return response([{ success: true, results: row.db.prepare(body.sql).all() }])
      write()
      row.db.exec('BEGIN')
      try { row.db.exec(body.sql); row.db.exec('COMMIT'); result = response([{ success: true, results: [] }]) }
      catch { row.db.exec('ROLLBACK'); return Response.json({ success: false, errors: [{ message: 'SQL rejected' }] }) }
    } else if (path === '/r2/buckets') {
      if (method === 'GET') return response({ buckets: state.buckets })
      const row = { name: body.name, jurisdiction: 'default', storage_class: 'Standard' }; state.buckets.push(row); write(); result = response(row)
    } else if (path.startsWith('/r2/buckets/')) {
      const row = state.buckets.find(row => row.name === path.split('/').at(-1)); return row ? response(row) : missing()
    } else if (path === '/queues') {
      if (method === 'GET') return list(state.queues)
      const row = { queue_id: randomUUID().replaceAll('-', ''), queue_name: body.queue_name, consumers: [] }; state.queues.push(row); write(); result = response(row)
    } else if (path.startsWith('/queues/')) {
      const row = state.queues.find(row => row.queue_id === path.split('/')[2]); return row ? response(path.endsWith('/consumers') ? row.consumers : row) : missing()
    } else if (path === '/workers/subdomain') return response({ subdomain: 'fixture-account' })
    else if (path === '/workers/durable_objects/namespaces') return list([])
    else if (path === '/workers/assets/upload') { write(); return response({ jwt: 'penny-upload-complete' }) }
    else {
      const name = path.match(/^\/workers\/scripts\/([^/]+)/)?.[1]
      if (!name) throw Error('unsupported Penny account operation')
      const worker = workerState(name)
      const suffix = path.replace(/^\/workers\/scripts\/[^/]+/, '')
      if (suffix === '/assets-upload-session') { write(); return response({ jwt: 'penny-upload-ticket', buckets: [Object.values(body.manifest).map(item => item.hash)] }) }
      if (suffix === '/settings') return worker.settings ? response(worker.settings) : missing()
      if (suffix === '/deployments') return response({ deployments: worker.deployments })
      if (suffix.startsWith('/versions/')) return response(worker.version)
      if (suffix === '/secrets') return response(worker.secrets.map(({ name }) => ({ name, type: 'secret_text' })))
      if (suffix === '/schedules') { if (method !== 'GET') { worker.schedules = body; write() } return response({ schedules: worker.schedules }) }
      if (suffix === '/subdomain') { if (method !== 'GET') { worker.subdomain = body.enabled; write() } return response({ enabled: worker.subdomain }) }
      if (suffix !== '' || method !== 'PUT') throw Error('unsupported Penny account operation')
      const metadata = JSON.parse(await body.get('metadata').text())
      for (const binding of metadata.bindings) if (binding.type === 'secret_text') worker.secrets.push({ name: binding.name, value: binding.text })
      const bindings = metadata.bindings.map(binding => ['secret_text', 'inherit'].includes(binding.type) ? { name: binding.name, type: 'secret_text' } : binding)
      worker.settings = { ...metadata, bindings }
      const main = await body.get(metadata.main_module).text(), id = randomUUID(), etag = createHash('sha256').update(main).digest('hex')
      // Like the platform, report the handlers the uploaded module exports.
      const handlers = ['fetch', 'scheduled', 'queue'].filter(name => new RegExp(`\\b${name}\\s*\\(`).test(main))
      worker.version = { id, resources: { bindings, script: { etag, handlers } } }; worker.deployments = [{ id: randomUUID(), versions: [{ version_id: id, percentage: 100 }] }]
      write(); result = response({ id: name, deployment_id: id })
    }
    if (lost) throw new TypeError('test-only lost account response')
    return result
  }
  return { state, accountId, token, fetch, fail: (method, path, options = {}) => failures.push({ method, path, ...options }), foreign: { d1: database }, close: () => state.databases.forEach(row => row.db.close()) }
}
