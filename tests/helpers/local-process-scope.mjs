import { mkdtemp, readlink } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createProcessBaseline, createProcessScope as native, processScopeEnvironment as environment, scopedProcesses as inspect } from '@runeditrun/rer/process-scope'
export async function createProcessScope(prefix) { const scope = native(await createProcessBaseline()); return { root: await mkdtemp(prefix), token: scope.token, native: scope } }
export const processScopeEnvironment = (scope, env) => environment(scope.native, env)
export const scopedProcesses = (scope, table, timeout) => inspect(scope.native, table, timeout)
// Cwd is an independent observation only; shared custody never uses it to
// authorize a signal. Retain the original uninspectable-directory assertion.
export async function processDirectories(table, timeout = 5000) {
  if (!table.length) return new Map()
  if (process.platform === 'linux') {
    const rows = await Promise.all(table.map(async ({ pid }) => {
      try { return [pid, await readlink(`/proc/${pid}/cwd`)] }
      catch (error) { if (['ENOENT', 'ESRCH', 'EACCES'].includes(error.code)) return; throw error }
    }))
    return new Map(rows.filter(Boolean))
  }
  const { stdout } = await promisify(execFile)('/usr/sbin/lsof', ['-n', '-P', '-a', '-p', table.map(({ pid }) => pid).join(','), '-d', 'cwd', '-F', 'pn'], { timeout, maxBuffer: 8 * 1024 * 1024 }).catch(error => {
    if (error.code === 1 && !error.stderr && typeof error.stdout === 'string') return { stdout: error.stdout }
    throw error
  })
  const rows = new Map(); let pid
  for (const line of stdout.split('\n')) { if (/^p\d+$/.test(line)) pid = Number(line.slice(1)); else if (line.startsWith('n') && pid) rows.set(pid, line.slice(1)) }
  return rows
}
