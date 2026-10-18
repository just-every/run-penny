import {parseEnv} from 'node:util'
import {hashToken} from '../../base/modules/operator-auth/crypto.mjs'
import { fileURLToPath as __rerTestEntryPath } from 'node:url';
const __rerTestEntry = __rerTestEntryPath(import.meta.resolve('@runeditrun/rer/internal/global/rer.mjs'));
const __rerTestEntryArgs = args => args[1] === 'dev' && !args.some(arg => ['--foreground', '--detach', '--stop', '--help'].includes(arg)) ? [...args, '--foreground'] : args;
import assert from 'node:assert/strict'
import { createReadStream } from 'node:fs'
import { copyFile, mkdir, readFile } from 'node:fs/promises'
import { createServer, request as forward } from 'node:http'
import { join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { readDevKey, signInAs } from '../../base/modules/operator-auth/dev/sign-in-as.mjs'
import { readArchive } from '@runeditrun/rer/modules/portability'
import { evidenceDirectory } from '../browser/acceptance-audit.mjs'
import { freshLocalRuntime } from '../browser/fresh-local-runtime.mjs'
import { localDatabaseFile } from '../browser/local-database.mjs'
import { archiveWithTables } from './archive-with-tables.mjs'

const cookies = response => response.headers.getSetCookie().map(line => line.split(';')[0]).join('; ')
// A local reverse proxy rewrites Host to the app's loopback origin, as a tunnel would.
async function forwardingProxy(origin) {
  const target = new URL(origin)
  const server = createServer((incoming, outgoing) => {
    const upstream = forward({ host: target.hostname, port: target.port, path: incoming.url, method: incoming.method, headers: { ...incoming.headers, host: target.host } }, reply => { outgoing.writeHead(reply.statusCode, reply.headers); reply.pipe(outgoing) })
    incoming.pipe(upstream)
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(done => server.close(done)) }
}

test('[SC-05 API-001] an API key minted in a dev session works only behind the checkout key, never leaves in an export and makes an archive refused; a key minted in an ordinary session is unchanged', { timeout: 900000 }, async () => {
  process.env.TMPDIR = resolve(process.env.PENNY_WORK_ROOT ?? '..', 'tmp')
  await mkdir(process.env.TMPDIR, { recursive: true })
  const output = evidenceDirectory('dev-credentials'), runtime = await freshLocalRuntime({ width: 1440, height: 900 }, output)
  const proxy = await forwardingProxy(runtime.origin)
  try {
    const { origin, root } = runtime, key = await readDevKey(root)
    const mint = async (cookie, name) => {
      const response = await fetch(origin + '/api/operator/integrations/keys', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ name, scopes: ['requests:read'] }) })
      assert.equal(response.status, 201, `${name} is issued`)
      return response.json()
    }
    const read = (base, token, headers = {}) => fetch(base + '/api/v1/requests', { headers: { Authorization: 'Bearer ' + token, ...headers } }).then(response => response.status)

    // A dev session: the gate cookie and a session of kind dev, both from the key.
    const dev = await signInAs({ origin, key, as: 'owner' })
    const gate = dev.cookies.find(cookie => cookie.name.startsWith('rer_dev_gate')), session = dev.cookies.find(cookie => !cookie.name.startsWith('rer_dev_gate') && cookie.value)
    assert.equal((await fetch(origin + '/auth/session', { headers: { Cookie: dev.header } })).status, 200, 'the dev session works behind the gate')
    assert.equal((await fetch(origin + '/auth/session', { headers: { Cookie: `${session.name}=${session.value}` } })).status, 401, 'the dev session alone is refused')
    const devKey = await mint(dev.header, 'Dev-session key')

    // The local owner's CLI proof issues an ordinary session without email.
    const settings=parseEnv(await readFile(join(root,'.dev.vars'),'utf8'))
    const proof=await hashToken(settings.AUTH_SECRET,'local-cli','sign-in')
    const confirmed=await fetch(origin+'/auth/local/cli-session',{method:'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/json','x-rer-local-cli':proof},body:JSON.stringify({returnTo:'/app'})})
    assert.equal(confirmed.status,303)
    const ordinary = cookies(confirmed), ordinaryKey = await mint(ordinary, 'Ordinary key')

    // The dev-minted key answers only with the key: header, gate cookie, or through the proxy carrying either.
    assert.equal(await read(origin, devKey.token, { 'x-rer-dev-key': key }), 200)
    assert.equal(await read(origin, devKey.token, { Cookie: `${gate.name}=${gate.value}` }), 200)
    assert.equal(await read(origin, devKey.token), 401, 'without the key it is refused')
    assert.equal(await read(origin, devKey.token, { 'x-rer-dev-key': key.slice(1) + 'A' }), 401, 'a wrong key is refused')
    assert.equal(await read(proxy.origin, devKey.token), 401, 'a forwarded request without the key is refused')
    assert.equal(await read(proxy.origin, devKey.token, { 'x-rer-dev-key': key }), 200)
    // The ordinary key is unchanged: no key needed, directly or forwarded.
    assert.equal(await read(origin, ordinaryKey.token), 200)
    assert.equal(await read(proxy.origin, ordinaryKey.token), 200)

    await runtime.stop()
    const database = await localDatabaseFile(join(root, '.wrangler/state'))
    const db = new DatabaseSync(database, { readOnly: true })
    try {
      assert.deepEqual(db.prepare("SELECT id FROM oa_dev_credentials WHERE credential='integration_tokens'").all().map(row => row.id), [devKey.credential.id], 'only the dev-session key is recorded as dev-minted')
    } finally { db.close() }

    // Export drops it: no API key or dev record leaves the installation.
    // rer takes archive paths inside the checkout.
    const archive = join(root, 'exports/penny.rer'), edited = join(root, 'exports/edited.rer')
    await runtime.run(__rerTestEntryArgs([__rerTestEntry, 'export', '--output', 'exports/penny.rer', '--non-interactive']))
    const text = []
    for await (const record of readArchive(Readable.toWeb(createReadStream(archive)))) {
      if (record.kind === 'manifest') for (const name of ['integration_tokens', 'oa_dev_credentials', 'oa_sessions', 'penny_api_issuers']) assert.ok(!record.tables.some(table => table.name === name), `${name} is not exported`)
      text.push(JSON.stringify(record))
    }
    assert.ok(!text.join('\n').includes(devKey.credential.id), 'the dev-minted key appears nowhere in the archive')

    // An archive edited to carry the dev-minted key is refused, and nothing is restored from it.
    await archiveWithTables(archive, edited, database, ['integration_tokens', 'oa_dev_credentials'])
    await copyFile(archive + '.erasure-journal.json', edited + '.erasure-journal.json')
    await runtime.run(__rerTestEntryArgs([__rerTestEntry, 'reset', '--yes', '--non-interactive']))
    await assert.rejects(runtime.run(__rerTestEntryArgs([__rerTestEntry, 'import', '--input', 'exports/edited.rer', '--yes', '--non-interactive'])), /failed \(\d+\)/, 'import refuses the archive holding a dev-minted key')
    await runtime.run(__rerTestEntryArgs([__rerTestEntry, 'import', '--input', 'exports/penny.rer', '--yes', '--non-interactive']))
    const restored = new DatabaseSync(await localDatabaseFile(join(root, '.wrangler/state')), { readOnly: true })
    try {
      for (const table of ['integration_tokens', 'oa_dev_credentials']) assert.equal(restored.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n, 0, `${table} stays empty after a restore`)
    } finally { restored.close() }
  } finally {
    await runtime.saveDiagnostics()
    await proxy.close()
    await runtime.close()
  }
})
