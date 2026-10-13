import { once } from 'node:events'
import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createRedaction as diagnosticRedaction } from '../../scripts/base-onboarding/redaction.mjs'
const redact=(text,secrets=[])=>{const filter=diagnosticRedaction();filter.addSecrets(secrets);return filter.redact(String(text)).replaceAll('[REDACTED]','[redacted]')}
import { createRedaction } from '../../scripts/base-onboarding/redaction.mjs'

const maximumBytes = 65536
const redactDevFragment = text => text.replace(/([?&#]rer-dev=)[A-Za-z0-9_-]+/gi, '$1[redacted]')

// Keep output bounded in memory; redact credentials before any diagnostic is persisted.
export function redactDiagnostics(bytes, secrets = [], truncated = false) {
  if (truncated) {
    // A raw tail may begin inside a credential or after a magic-link marker.
    // Drop that incomplete record instead of treating its suffix as safe text.
    // Allow for known values containing newlines before finding a safe record.
    const overlap = Math.max(0, ...secrets.map(value => Buffer.byteLength(value) - 1))
    const boundary = bytes.indexOf(10, overlap)
    bytes = boundary < 0 ? Buffer.alloc(0) : bytes.subarray(boundary + 1)
  }
  const text = redact(bytes.toString(), secrets)
  return (truncated ? '[truncated incomplete diagnostic record]\n' : '') + redactDevFragment(text.replace(/([?&#](?:token|key|secret)=)[^\s&<>"']+/gi, '$1[redacted]'))
}

export function captureLocalServer(server, { output, label, secrets = [] }) {
  const tails = { stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) }
  let stdoutBytes = 0, stderrBytes = 0
  const redaction = createRedaction(); redaction.addSecrets(secrets)
  const filters = Object.fromEntries(['stdout','stderr'].map(stream => [stream, redaction.stream(text => {
    tails[stream] = Buffer.concat([tails[stream], Buffer.from(text.replaceAll('[REDACTED]', '[redacted]'))]).subarray(-maximumBytes)
  })]))
  server.stdout.on('data', bytes => { stdoutBytes += bytes.length; filters.stdout.write(bytes) })
  server.stderr.on('data', bytes => { stderrBytes += bytes.length; filters.stderr.write(bytes) })
  for (const stream of ['stdout','stderr']) server[stream].once('end', () => filters[stream].end())
  return async () => {
    await mkdir(output, { recursive: true })
    // Snapshot is already redacted, including a partial credential held across
    // chunks. Select the bounded tail only after that shared privacy boundary.
    // An ended stream can retain a very short secret prefix. The fragment
    // marker also covers that prefix before selecting the final bounded tail.
    const text = ['stdout','stderr'].map(stream => tails[stream].toString() + filters[stream].snapshot().replaceAll('[REDACTED]', '[redacted]')).join('')
    const tail = Buffer.from(redactDevFragment(text)).subarray(-maximumBytes)
    const prefix = join(output, `failure-dev-${label}`)
    const metadata = { exitCode: server.exitCode, signal: server.signalCode, stdoutBytes, stderrBytes, truncated: stdoutBytes + stderrBytes > maximumBytes }
    for (const [path, bytes] of [[`${prefix}.log`, tail], [`${prefix}.json`, JSON.stringify(metadata, null, 2) + '\n']]) {
      await writeFile(path, bytes, { mode: 0o600 })
      await chmod(path, 0o600)
    }
  }
}

export async function observeLocalServer(server, { origin, observe, output, label, save = captureLocalServer(server, { output, label }) }) {
  try {
    await once(server, 'spawn')
    await observe(true)
    const deadline = Date.now() + 120000
    while (Date.now() < deadline) {
      await observe()
      if (server.exitCode !== null || server.signalCode !== null) throw new Error(`[G.6] dev exited (code ${server.exitCode}, signal ${server.signalCode}); private diagnostics saved`)
      if (await fetch(origin + '/signin').then(r => r.ok).catch(() => false)) { await observe(); return }
      await new Promise(r => setTimeout(r, 500))
    }
    throw new Error('[G.6] dev did not become ready within 120 seconds; private diagnostics saved')
  } catch (error) {
    await save()
    throw error
  }
}
