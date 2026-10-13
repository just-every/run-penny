import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { PassThrough } from 'node:stream'
import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import test from 'node:test'
import { captureLocalServer, observeLocalServer } from '../browser/fresh-local-server.mjs'

const scratch = resolve(process.env.PENNY_WORK_ROOT ?? '..', 'tmp')
await mkdir(scratch, { recursive: true })
for (const phase of ['initial', 'restored']) {
  test(`[BASE-OPS-004] ${phase} startup preserves bounded private diagnostics before cleanup`, async () => {
    const output = await mkdtemp(join(scratch, 'startup-diagnostics-'))
    try {
      const child = spawn(process.execPath, ['-e', "process.stdout.write('x'.repeat(100000));process.stderr.write('diagnostic-tail');process.exitCode=23"], { stdio: ['ignore', 'pipe', 'pipe'] })
      await assert.rejects(observeLocalServer(child, { origin: 'http://127.0.0.1:1', output, label: `${phase}-390`, observe: async () => {} }), error => {
        assert.match(error.message, /dev exited.*23/)
        assert.equal(error.message.includes('diagnostic-tail'), false)
        return true
      })
      const logPath = join(output, `failure-dev-${phase}-390.log`)
      const metadataPath = join(output, `failure-dev-${phase}-390.json`)
      const log = await readFile(logPath)
      assert.ok(log.byteLength <= 65536)
      assert.ok(log.toString().includes('diagnostic-tail'))
      assert.equal((await stat(logPath)).mode & 0o777, 0o600)
      assert.equal((await stat(metadataPath)).mode & 0o777, 0o600)
      const metadata = JSON.parse(await readFile(metadataPath, 'utf8'))
      assert.equal(metadata.exitCode, 23)
      assert.equal(metadata.signal, null)
      assert.equal(metadata.truncated, true)
      assert.ok(metadata.stdoutBytes >= 100000)
      assert.ok(metadata.stderrBytes > 0)
      assert.equal(child.exitCode, 23)
    } finally { await rm(output, { recursive: true, force: true }) }
  })
}

test('[BASE-OPS-004] signalled startup retains the signal without printing process output', async () => {
  const output = await mkdtemp(join(scratch, 'startup-signal-'))
  try {
    const child = spawn(process.execPath, ['-e', "process.stderr.write('private-marker');process.kill(process.pid, 'SIGTERM')"], { stdio: ['ignore', 'pipe', 'pipe'] })
    await assert.rejects(observeLocalServer(child, { origin: 'http://127.0.0.1:1', output, label: 'signal', observe: async () => {} }), /signal SIGTERM/)
    const metadata = JSON.parse(await readFile(join(output, 'failure-dev-signal.json'), 'utf8'))
    assert.equal(metadata.exitCode, null)
    assert.equal(metadata.signal, 'SIGTERM')
    assert.equal(child.signalCode, 'SIGTERM')
  } finally { await rm(output, { recursive: true, force: true }) }
})

test('[BASE-SECRET-001 BASE-OPS-004] diagnostics redact local secrets across stream chunks and link tokens', async () => {
  const output = await mkdtemp(join(scratch, 'startup-redaction-'))
  try {
    const secret='synthetic-diagnostic-credential'
    const child=spawn(process.execPath, ['-e', "process.stdout.write('x'.repeat(65530)+'synthetic-diagnostic-');setTimeout(()=>{process.stdout.write('credential');process.stderr.write('synthetic-diagnostic-credential https://local.invalid/?token=private-token');process.exitCode=2},20)"], {stdio:['ignore','pipe','pipe']})
    const save=captureLocalServer(child,{output,label:'redacted',secrets:[secret]})
    await assert.rejects(observeLocalServer(child,{origin:'http://127.0.0.1:1',observe:async()=>{},save}), error=>{assert.match(error.message,/dev exited/);assert.equal(error.message.includes(secret),false);return true})
    const log=await readFile(join(output,'failure-dev-redacted.log'),'utf8')
    assert.equal(log.includes(secret),false)
    assert.equal(log.includes('private-token'),false)
    assert.ok(log.includes('[redacted]'))
  } finally { await rm(output,{recursive:true,force:true}) }
})

for (const kind of ['credential suffix', 'magic-link marker']) {
 for (const stream of ['stdout', 'stderr']) {
  test(`[BASE-SECRET-001 BASE-OPS-004] a truncated ${kind} on ${stream} cannot enter persisted diagnostics`, async () => {
    const output = await mkdtemp(join(scratch, 'startup-boundary-'))
    try {
      const secret = 'synthetic-boundary-credential-value'
      const token = 'synthetic-magic-link-token-value'
      const privatePrefix = kind === 'credential suffix' ? secret : `https://local.invalid/?token=${token}`
      const retainedPrivate = kind === 'credential suffix' ? secret.slice(-26) : token
      const finalLine = '\nUseful final diagnostic\n'
      // Exactly the sensitive suffix/value remains at the beginning of the
      // 65536-byte tail. Its original credential prefix or URL marker is gone.
      const bytes = Buffer.from(privatePrefix + 'x'.repeat(65536 - retainedPrivate.length - finalLine.length) + finalLine)
      const server = { stdout: new PassThrough(), stderr: new PassThrough(), exitCode: 23, signalCode: null }
      const save = captureLocalServer(server, { output, label: 'boundary', secrets: [secret] })
      server[stream].write(bytes.subarray(0, 19))
      server[stream].end(bytes.subarray(19))
      await save()
      const logPath = join(output, 'failure-dev-boundary.log')
      const log = await readFile(logPath, 'utf8')
      assert.equal(log.includes(retainedPrivate), false, 'Truncation must not expose a credential fragment or token')
      assert.equal(log.includes(secret), false)
      assert.equal(log.includes(token), false)
      assert.ok(log.includes('Useful final diagnostic'))
      assert.ok(Buffer.byteLength(log) <= 65536)
      assert.equal((await stat(logPath)).mode & 0o777, 0o600)
      const metadata = JSON.parse(await readFile(join(output, 'failure-dev-boundary.json'), 'utf8'))
      assert.equal(metadata.exitCode, 23)
      assert.equal(metadata.truncated, true)
      server.stdout.destroy(); server.stderr.destroy()
    } finally { await rm(output, { recursive: true, force: true }) }
  })
}
}
