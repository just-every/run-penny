import { execFile } from 'node:child_process'
import { chmod, mkdir, open, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { parseEnv } from 'node:util'
import { readProcessIdentity } from '@runeditrun/rer/internal/onboarding/process-table.mjs'
import { inheritedScopeTokens } from '@runeditrun/rer/process-scope'
import { listeners } from '@runeditrun/rer/process-diagnostics'
import { processDirectories } from '../helpers/local-process-scope.mjs'
import { redactDiagnostics } from './fresh-local-server.mjs'

const execute = promisify(execFile), maximumBytes = 65536
const settings = async root => parseEnv(await readFile(join(root, '.dev.vars'), 'utf8').catch(() => ''))
async function privateWrite(path, bytes) {
  await writeFile(path, bytes, { mode: 0o600 }); await chmod(path, 0o600)
}
async function portListeners(port) {
  if (process.platform !== 'darwin') return (await listeners()).filter(row => row.names.some(name => name.endsWith(`:${port}`)))
  let stdout
  try { ({ stdout } = await execute('/usr/sbin/lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fp'], { timeout: 3000, maxBuffer: 65536 })) }
  catch (error) { if (error.code !== 1 || typeof error.stdout !== 'string') throw error; stdout = error.stdout }
  return stdout.split('\n').filter(line => /^p\d+$/.test(line)).map(line => ({ pid: Number(line.slice(1)) }))
}

// Diagnostic inspection cannot admit a server or authorize signals. It records
// only the requested port, numeric identities and cwd, never argv/environment.
export async function setupDiagnostics(root, args, env, output, id) {
  const started = Date.now(), original = await settings(root)
  const portFlag = args.indexOf('--port')
  const savedPort = original.APP_ORIGIN ? Number(new URL(original.APP_ORIGIN).port || 80) : 8787
  const port = portFlag < 0 ? savedPort : Number(args[portFlag + 1])
  await mkdir(output, { recursive: true })
  const prefix = join(output, `setup-diagnostics-${id}`)
  const scopeSecrets = inheritedScopeTokens(env)
  const secrets = async () => [...scopeSecrets, ...Object.entries(await settings(root)).filter(([key]) => /SECRET|TOKEN|API_KEY/.test(key)).map(([, value]) => value)]
  const snapshots = new Map()
  const snapshot = stage => {
    if (!snapshots.has(stage)) snapshots.set(stage, (async () => {
      try {
        const selected = await portListeners(port)
        const identities = await Promise.all(selected.map(row => readProcessIdentity(row.pid)))
        const live = identities.filter(Boolean), directories = await processDirectories(live)
        const owners = await Promise.all(live.map(async identity => {
          const current = await readProcessIdentity(identity.pid)
          return { pid: identity.pid, birth: identity.birth, ppid: identity.ppid, pgid: identity.pgid,
            cwd: directories.get(identity.pid) ?? null, sameBirthAfterInspection: current?.birth === identity.birth }
        }))
        await privateWrite(`${prefix}-${stage}.json`, redactDiagnostics(Buffer.from(JSON.stringify({ stage, observedAt: new Date().toISOString(), port, owners }, null, 2) + '\n'), await secrets()))
      } catch {
        await privateWrite(`${prefix}-${stage}.json`, JSON.stringify({ stage, port, inspectionFailed: true }) + '\n')
      }
    })())
    return snapshots.get(stage)
  }
  await snapshot('command-start')
  return {
    // Snapshot before CLI failure cleanup when the HTTP denial arrives.
    observe(text) { if (/Claiming the first owner: HTTP \d{3}/.test(text)) void snapshot('response-failure').catch(() => {}) },
    async failed() {
      await snapshot('command-failure')
      await Promise.allSettled([...snapshots.values()])
      const directory = join(root, '.seed/installer')
      const names = await readdir(directory).catch(() => [])
      const candidates = [join(directory, 'install.log'), ...names.filter(name => /^commands-\d+$/.test(name)).map(name => join(directory, name, 'install.log'))]
      const logs = (await Promise.all(candidates.map(async path => {
        const info = await stat(path).catch(() => null)
        return info?.isFile() && info.mtimeMs >= started ? { path, info } : null
      }))).filter(Boolean).sort((a, b) => b.info.mtimeMs - a.info.mtimeMs).slice(0, 4)
      const values = await secrets()
      for (const [index, { path }] of logs.entries()) {
        const handle = await open(path, 'r')
        try {
          const size = (await handle.stat()).size, tail = Buffer.alloc(Math.min(size, maximumBytes))
          await handle.read(tail, 0, tail.length, Math.max(0, size - tail.length))
          await privateWrite(`${prefix}-installer-${index + 1}.log`, Buffer.from(redactDiagnostics(tail, values, size > tail.length)).subarray(-maximumBytes))
        } finally { await handle.close() }
      }
    },
  }
}
