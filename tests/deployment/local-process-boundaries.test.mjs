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

async function area(t) {
  const tmp = resolve(process.env.TMPDIR ?? '..')
  await mkdir(tmp, { recursive: true })
  const scope = await createProcessScope(join(tmp, 'process-boundary-'))
  const identities = []
  t.after(async () => {
    for (const identity of identities.toReversed()) {
      if ((await readOwnedGroup(identity.pgid)).some(member => sameProcess(member, identity))) {
        try { process.kill(identity.pid, 'SIGKILL') } catch (error) { if (error.code !== 'ESRCH') throw error }
      }
    }
    for (let attempt = 0; attempt < 100; attempt++) {
      if ((await Promise.all(identities.map(identity => readOwnedGroup(identity.pgid)))).every(group => !group.length)) break
      await delay(20)
    }
    for (const identity of identities) assert.deepEqual(await readOwnedGroup(identity.pgid), [])
    await rm(scope.root, { recursive: true, force: true })
  })
  return { scope, identities, tmp }
}

test('[G.6 BASE-OPS-002] a late detached child retains ownership after changing its working directory', async t => {
  const { scope, identities, tmp } = await area(t)
  const nested = `process.chdir(${JSON.stringify(tmp)});console.log('ready');setInterval(()=>{},1000)`
  const source = `const {spawn}=require('node:child_process');console.log('ready');process.stdin.once('data',()=>{const child=spawn(process.execPath,['-e',${JSON.stringify(nested)}],{detached:true,stdio:['ignore','pipe','ignore']});child.stdout.once('data',()=>{console.log(child.pid);process.stdin.once('data',()=>process.exit(0))})});setInterval(()=>{},1000)`
  const leader = spawn(process.execPath, ['-e', source], { cwd: scope.root, env: processScopeEnvironment(scope, process.env), detached: true, stdio: ['pipe', 'pipe', 'ignore'] })
  await once(leader.stdout, 'data')
  identities.push(...await readOwnedGroup(leader.pid))
  const owned = await readOwnedTree(leader, [], 1000, scope)
  const output = once(leader.stdout, 'data'); leader.stdin.write('spawn')
  const pid = Number((await output)[0].toString().trim())
  const [child] = await readOwnedGroup(pid); assert.ok(child); identities.push(child)
  const closed = once(leader, 'close'); leader.stdin.end('exit'); await closed
  await stopOwnedGroup(leader, 'SIGTERM', owned)
  assert.deepEqual(await readOwnedGroup(child.pgid), [], 'late changed-cwd child must disappear before success')
  assert.deepEqual(await readOwnedTree(leader, owned), [])
})

for (const captured of [true, false]) {
test(`[G.6 BASE-OPS-002] a foreign sibling in the same process group is never ownership authority (${captured ? 'scoped capture' : 'initial cleanup capture'})`, async t => {
  const { scope, identities } = await area(t)
  // setpgid (not setsid) permits a real sibling to join the group. Neither its
  // parent nor its environment belongs to the launcher's exclusive scope.
  const wrapper = 'import os,sys;os.setpgid(0,int(sys.argv[1]));os.execv(sys.argv[2],sys.argv[2:])'
  const source = "console.log('ready');setInterval(()=>{},1000)"
  const leader = spawn('python3', ['-c', wrapper, '0', process.execPath, '-e', source], { cwd: scope.root, env: processScopeEnvironment(scope, process.env), stdio: ['ignore', 'pipe', 'ignore'] })
  await once(leader.stdout, 'data'); identities.push(...await readOwnedGroup(leader.pid))
  const owned = await readOwnedTree(leader, [], 1000, scope)
  const foreign = spawn('python3', ['-c', wrapper, String(leader.pid), process.execPath, '-e', source], { cwd: scope.root, stdio: ['ignore', 'pipe', 'ignore'] })
  await once(foreign.stdout, 'data')
  const sibling = (await readOwnedGroup(leader.pid)).find(member => member.pid === foreign.pid)
  assert.ok(sibling); identities.push(sibling)
  await stopOwnedGroup(leader, 'SIGTERM', captured ? owned : undefined)
  assert.ok((await readOwnedGroup(leader.pid)).some(member => sameProcess(member, sibling)), 'foreign same-PGID sibling survives')
  assert.deepEqual(await readOwnedTree(leader, owned), [])
})
}
