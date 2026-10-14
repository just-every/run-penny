import { fileURLToPath as __rerTestEntryPath } from 'node:url';
const __rerTestEntry = __rerTestEntryPath(import.meta.resolve('@runeditrun/rer/internal/global/rer.mjs'));
const rer = command => __rerTestEntryArgs([__rerTestEntry, ...command]);
const __rerTestEntryArgs = args => args[1] === 'dev' && !args.some(arg => ['--foreground', '--detach', '--stop', '--help'].includes(arg)) ? [...args, '--foreground'] : args;
const __rerTestEntryPnpm = (program, args) => {
 const at = program === 'nice' ? args.indexOf('pnpm') : -1;
 if (program === 'nice' && at < 0) return [program, args];
 const command = at < 0 ? args : args.slice(at + 1), offset = command[0] === 'run' ? 1 : 0;
 const aliases = {"dev":"dev","build":"build","preview":"preview","verify":"verify","export":"export","import":"import","setup":"setup","deploy":"deploy","reset":"reset","release":"release","outbox":"outbox","doctor":"doctor","describe":"describe","check":"check","deps":"install","rer":""}, alias = command[offset];
 if (!Object.hasOwn(aliases, alias)) return [program, args];
 const forwarded = command.slice(offset + 1); if (forwarded[0] === '--') forwarded.shift();
 const launch = __rerTestEntryArgs([__rerTestEntry, ...(aliases[alias] ? [aliases[alias]] : []), ...forwarded]);
 return at < 0 ? [process.execPath, launch] : [program, [...args.slice(0, at), process.execPath, ...launch]];
};
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { chmod, mkdir, open, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parseEnv } from 'node:util'

import { captureLocalServer, observeLocalServer, redactDiagnostics } from './fresh-local-server.mjs'
import {waitForLocalCapacity} from './local-resource-limits.mjs'
import { createProcessScope, processScopeEnvironment } from '../helpers/local-process-scope.mjs'
import { readOwnedTree } from '../helpers/local-process-tree.mjs'
import { stopOwnedGroup } from '../helpers/local-process-cleanup.mjs'
import { readmeCommands } from '../installer/readme-commands.mjs'
import { localDatabaseFile } from './local-database.mjs'
import { setupDiagnostics } from './fresh-setup-diagnostics.mjs'
import { freshLocalPort } from './fresh-local-port.mjs'
import { inheritedScopeTokens } from '@runeditrun/rer/process-scope'
import { readDevKey } from '../../base/modules/operator-auth/dev/sign-in-as.mjs'
let diagnostics
const ignoredEnvironment = /^(AUTH_|MAIL_|OIDC_|SENDGRID_|RESEND_|WORKSPACE_TIMEZONE$|SESSION_SECRET$|SETUP_TOKEN$|OWNER_EMAIL$|OPERATOR_EMAIL$|APP_ORIGIN$|PENNY_)/
function cleanEnvironment(tmp) {
  const env = { ...process.env, TMPDIR: tmp, TMP: tmp, TEMP: tmp, WRANGLER_SEND_METRICS: 'false', CLOUDFLARE_INCLUDE_PROCESS_ENV: 'false', WRANGLER_LOG_PATH: join(tmp, 'wrangler') }
  for (const key of Object.keys(env)) if (ignoredEnvironment.test(key)) delete env[key]
  delete env.RER_LOCAL_OPERATION // The fresh clone owns a distinct local operation.
  env.RER_SERVER_JOURNEY = '1' // A declared test journey on its own port: never counted against or evicting a person's server.
  return env
}
async function run(cwd, args, env, { stdoutOnly = false, diagnosticId = 'command' } = {}) {
  const executable = process.execPath
  const label = `node-${args[1]}`.replace(/[^a-z0-9_-]/gi, '-')
  const setup = args[1] === 'setup' ? await setupDiagnostics(cwd, args, env, diagnostics, diagnosticId).catch(() => undefined) : undefined
  console.log(`[G.6] node ${args[0]} ${args[1]} started`)
  return await new Promise((resolveCommand, reject) => {
    const child = spawn(...__rerTestEntryPnpm('nice', ['-n', '15', executable, ...args]), { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = '', stdout = ''
    const observe = () => setup?.observe(output.slice(-512))
    child.stdout.on('data', bytes => { output += bytes; stdout += bytes; observe() }); child.stderr.on('data', bytes => { output += bytes; observe() })
    child.on('error', reject); child.on('close', async (code, signal) => {
      if (code === 0) return resolveCommand(stdoutOnly ? stdout : output)
      try { await setup?.failed() } catch {}
      try {
        await mkdir(diagnostics, {recursive:true})
        const localVars = await readFile(join(cwd, '.dev.vars'), 'utf8').catch(() => '')
        const secrets = [...localVars.matchAll(/^(?:AUTH_SECRET|SESSION_SECRET|SETUP_TOKEN)=(.+)$/gm)].map(match => match[1]).concat(inheritedScopeTokens(env))
        const log = join(diagnostics, `failure-${label}.log`)
        await writeFile(log, Buffer.from(redactDiagnostics(Buffer.from(output), secrets)).subarray(-65536), {mode:0o600})
        await chmod(log, 0o600)
        const metadata = join(diagnostics, `failure-${label}.json`)
        await writeFile(metadata, JSON.stringify({exitCode:code,signal,truncated:Buffer.byteLength(output)>65536})+'\n', {mode:0o600})
        await chmod(metadata, 0o600)
        const privateLog=output.match(/Private command log: (.+)/)?.[1]
        if(privateLog) {
          const handle = await open(privateLog, 'r')
          try {
            const size = (await handle.stat()).size, tail = Buffer.alloc(Math.min(size, 65536))
            await handle.read(tail, 0, tail.length, Math.max(0, size-tail.length))
            const path = join(diagnostics, 'failure-private-command.log')
            await writeFile(path, Buffer.from(redactDiagnostics(tail, secrets, size > tail.length)).subarray(-65536), {mode:0o600}); await chmod(path, 0o600)
          } finally { await handle.close() }
        }
      } catch {}
      reject(new Error(`node ${args.join(' ')} failed (${code}); private diagnostics saved`))
    })
  })
}
export async function freshLocalRuntime(viewport, output) {
  diagnostics=output
  const work = resolve(process.env.PENNY_WORK_ROOT ?? '..'), tmp = join(work, 'tmp')
  await mkdir(tmp, { recursive: true })
  await waitForLocalCapacity()
  const scope = await createProcessScope(join(tmp, `fresh-journey-${viewport.width}-`))
  const root = scope.root, env = processScopeEnvironment(scope, cleanEnvironment(tmp))
  const artifacts = root + '-artifacts'
  const state = join(root, '.wrangler/state')
  env.RER_SERVERS_DIR = join(artifacts, 'servers')
  env.RER_JOBS_DIR = join(artifacts, 'jobs')
  env.PENNY_LOCAL_LOGS = join(artifacts, 'logs')
  let server, owned = [], saveDiagnostics
  const stopServer = async () => {
    if (server?.pid) {
      await stopOwnedGroup(server, 'SIGTERM', owned)
      const remaining = await readOwnedTree(server, owned)
      assert.equal(remaining.length, 0, '[G.6] every owned development process stopped')
      await mkdir(output, {recursive:true})
      await writeFile(join(output, `process-cleanup-${viewport.width}-${env.PENNY_LOCAL_STATE ? 'restored' : 'initial'}.json`), JSON.stringify({owned:owned.map(({pid,ppid,pgid})=>({pid,ppid,pgid})),remaining:remaining.length},null,2)+'\n')
      server = undefined; owned = []
    }
  }
  const close = async () => {
    await stopServer()
    await rm(root, { recursive: true, force: true })
    await rm(artifacts, { recursive: true, force: true })
    await rm(state, { recursive: true, force: true })
  }
  try {
    const source = resolve(process.env.PENNY_SOURCE_ROOT ?? '.')
    execFileSync('git', ['clone', '--quiet', '--no-local', '--', source, root], { stdio: 'pipe' })
    const readme = await readFile(join(root, 'README.md'), 'utf8')
    const literal = readmeCommands(readme, 'owner@penny.invalid')
    await run(root, rer(literal[0]), env)
    const port = await freshLocalPort()
    const setupCommand = rer([...literal[1], '--port', String(port)])
    const setup = await run(root, setupCommand, env, { diagnosticId: `${viewport.width}-initial` })
    await mkdir(output, { recursive: true })
    await writeFile(join(output, `setup-${viewport.width}.log`), setup, { mode: 0o600 })
    const mode = (await stat(join(root, '.dev.vars'))).mode & 0o777
    assert.equal(mode, 0o600, '[G.1] local credentials private')
    const vars = await readFile(join(root, '.dev.vars'), 'utf8')
    for (const match of vars.matchAll(/^(?:AUTH_SECRET|SESSION_SECRET|SETUP_TOKEN)=(.+)$/gm)) assert.equal(setup.includes(match[1]), false, '[G.1] setup never prints secrets')
    const { readdir } = await import('node:fs/promises')
    const credentials = [...vars.matchAll(/^(?:AUTH_SECRET|SESSION_SECRET|SETUP_TOKEN)=(.+)$/gm)].map(match => Buffer.from(match[1]))
    for (const path of await readdir(join(root, 'dist'), { recursive: true, withFileTypes: true })) if (path.isFile()) {
      const bytes = await readFile(join(path.parentPath, path.name))
      assert.ok(credentials.every(value => !bytes.includes(value)), '[BASE-SECRET-001] no generated authority enters emitted build bytes')
    }
    const urlMatch = setup.match(/RER_SETUP_READY (http:\/\/(?:localhost|127\.0\.0\.1):\d+)/)
    assert.ok(urlMatch, '[G.1/G.4] setup prints exact local URL')
    const origin = new URL(urlMatch[1]).origin
    assert.equal(new URL(origin).port, String(port), '[G.4] setup uses the selected supported --port')
    assert.equal(parseEnv(vars).APP_ORIGIN, origin, '[G.1/G.4] setup saves the selected origin for repeat setup and dev')
    assert.match(setup, /RER_SETUP_READY/, '[G.1] setup reports its readiness line')
    const { DatabaseSync } = await import('node:sqlite')
    const databasePath = await localDatabaseFile(state)
    const db = new DatabaseSync(databasePath, { readOnly: true })
    const business = ['boards','requests','evidence_items','decisions','roadmap_items','releases','requesters']
    const counts = Object.fromEntries(business.map(table => [table, db.prepare(`SELECT count(*) n FROM ${table}`).get().n]))
    for (const count of Object.values(counts)) assert.equal(count, 0, '[G.2] business store starts empty')
    assert.equal(db.prepare('SELECT count(*) n FROM oa_operators').get().n, 1, '[G.1] setup provisions one Base operator')
    db.close()
    await writeFile(join(output, `empty-store-${viewport.width}.json`), JSON.stringify(counts, null, 2)+'\n')
    const repeated = await run(root, rer(literal[1]), env, { diagnosticId: `${viewport.width}-repeat` })
    assert.match(repeated, /RER_SETUP_READY/, '[G.1] setup resumes the existing installation')
    assert.equal(repeated.match(/RER_SETUP_READY (http:\/\/(?:localhost|127\.0\.0\.1):\d+)/)?.[1], origin, '[G.1/G.4] repeat setup retains the selected origin without another port input')
    assert.ok((await readFile(join(root, '.dev.vars'), 'utf8')) === vars, '[G.1] repeat retains byte-identical private settings')
    const repeatedDb = new DatabaseSync(databasePath, { readOnly: true })
    try {
      assert.equal(repeatedDb.prepare('SELECT count(*) n FROM oa_operators').get().n, 1, '[G.1] repeat retains one native owner')
      for (const table of business) assert.equal(repeatedDb.prepare(`SELECT count(*) n FROM ${table}`).get().n, counts[table], '[G.2] repeat neither seeds nor deletes product data')
    } finally { repeatedDb.close() }
    const startServer = async () => {
    // Register the generated admission key before the child can emit RER_OPEN.
    const secrets = [...vars.matchAll(/^(?:AUTH_SECRET|SESSION_SECRET|SETUP_TOKEN)=(.+)$/gm)].map(match => match[1]).concat(scope.token, await readDevKey(root))
    server = spawn('nice', ['-n', '15', process.execPath, ...rer(literal[2])], { cwd: root, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
    const save = captureLocalServer(server, { output, secrets, label: `${env.PENNY_LOCAL_STATE ? 'restored' : 'initial'}-${viewport.width}` })
    saveDiagnostics=save
    await observeLocalServer(server, { origin, save, observe: async initial => {
      owned = initial ? await readOwnedTree(server, [], 1000, scope) : await readOwnedTree(server, owned)
    } })
    }
    await startServer()
    return { root, origin, close, saveDiagnostics, stop: stopServer, start: startServer, run: args => run(root,args,env), runNode: args => run(root,args,env,{ stdoutOnly: true }), commands: literal.map((args, index) => ['node', ...(index === 1 ? setupCommand : args)].join(' ')) }
  } catch (error) {
    try { await close() } catch (cleanup) { throw new AggregateError([error,cleanup], 'Fresh local runtime failed and cleanup also failed.') }
    throw error
  }
}
