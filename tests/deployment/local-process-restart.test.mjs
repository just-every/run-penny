import assert from 'node:assert/strict'
import test from 'node:test'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { createProcessScope, processScopeEnvironment } from '../helpers/local-process-scope.mjs'
import { readOwnedTree } from '../helpers/local-process-tree.mjs'
import { readOwnedGroup, sameProcess } from '../helpers/local-process-table.mjs'
import { stopOwnedGroup } from '../helpers/local-process-cleanup.mjs'

test('[G.6 BASE-OPS-002] graceful shutdown reaches a parent that restarts terminated worker children', async t => {
  const tmp = resolve(process.env.TMPDIR ?? '..'); await mkdir(tmp, { recursive: true })
  const scope = await createProcessScope(join(tmp, 'process-restart-'))
  const source = `const {spawn}=require('node:child_process');let stopping=false,child;
    function start(){child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});child.once('exit',()=>stopping?process.exit(0):start())}
    start();process.on('SIGTERM',()=>{stopping=true;child.kill('SIGTERM')});console.log('ready');setInterval(()=>{},1000)`
  const leader = spawn(process.execPath, ['-e', source], { cwd: scope.root, env: processScopeEnvironment(scope, process.env), detached: true, stdio: ['ignore', 'pipe', 'ignore'] })
  await once(leader.stdout, 'data')
  const owned = await readOwnedTree(leader, [], 1000, scope)
  const identity = owned.find(member => member.pid === leader.pid)
  t.after(async () => {
    // The fixture's normal shutdown stops its restart loop even on the red run.
    if ((await readOwnedGroup(identity.pgid)).some(member => sameProcess(member, identity))) process.kill(identity.pid, 'SIGTERM')
    for (let n = 0; n < 100 && (await readOwnedTree(leader, owned)).length; n++) await delay(20)
    assert.deepEqual(await readOwnedTree(leader, owned), [])
    await rm(scope.root, { recursive: true, force: true })
  })
  await stopOwnedGroup(leader, 'SIGTERM', owned)
  assert.deepEqual(await readOwnedTree(leader, owned), [])
})
