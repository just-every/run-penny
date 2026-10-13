import assert from 'node:assert/strict'
import test from 'node:test'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {rm,mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {setTimeout as delay} from 'node:timers/promises'
import {createProcessScope,processDirectories,processScopeEnvironment,scopedProcesses} from '../helpers/local-process-scope.mjs'
import {readOwnedTree} from '../helpers/local-process-tree.mjs'
import {readOwnedGroup,readProcessTable,sameProcess} from '../helpers/local-process-table.mjs'
import {stopOwnedGroup} from '../helpers/local-process-cleanup.mjs'

async function fixture(t, forkOnSignal=false){
 const tmp=resolve(process.env.TMPDIR??'..');await mkdir(tmp,{recursive:true})
 const scope=await createProcessScope(join(tmp,'owned-process-test-'))
 const nestedCode='setInterval(()=>{},1000)'
 const fork=`const nested=spawn(process.execPath,['-e',${JSON.stringify(nestedCode)}],{cwd:process.cwd(),detached:true,stdio:'ignore'});console.log(nested.pid);`
 const source=`const {spawn}=require('node:child_process');console.log('ready');${forkOnSignal?`process.on('SIGTERM',()=>{${fork}process.exit(0)});`:`process.stdin.once('data',()=>{${fork}process.stdin.once('data',()=>process.exit(0))});`}setInterval(()=>{},1000)`
 const leader=spawn(process.execPath,['-e',source],{cwd:scope.root,env:processScopeEnvironment(scope,process.env),detached:true,stdio:['pipe','pipe','ignore']})
 let owned=[],foreignIdentity
 const descendants=[]
 t.after(async()=>{
  const identities=[...descendants,...owned,foreignIdentity].filter(Boolean)
  if(!identities.some(p=>p.pid===leader.pid))identities.push(...await readOwnedGroup(leader.pid))
  for(const member of identities.toReversed()){
   const live=(await readOwnedGroup(member.pgid)).find(item=>sameProcess(item,member))
   if(live)try{process.kill(live.pid,'SIGKILL')}catch(error){if(error.code!=='ESRCH')throw error}
  }
  for(let n=0;n<50;n++){
   if((await Promise.all(identities.map(p=>readOwnedGroup(p.pgid)))).every(group=>group.length===0))break
   await delay(20)
  }
  for(const member of identities)assert.deepEqual(await readOwnedGroup(member.pgid),[])
  await rm(scope.root,{recursive:true,force:true})
 })
 await once(leader.stdout,'data')
 owned=await readOwnedTree(leader,[],1000,scope)
 // Same cwd does not establish ownership: this sibling has no inherited marker.
 const foreign=spawn(process.execPath,['-e',nestedCode],{cwd:scope.root,detached:true,stdio:'ignore'})
 await once(foreign,'spawn');[foreignIdentity]=await readOwnedGroup(foreign.pid)
 async function nested(data){
  const pid=Number(data.toString().trim()),[identity]=await readOwnedGroup(pid)
  assert.ok(identity);descendants.push(identity);return identity
 }
 return {leader,owned,scope,foreignIdentity,nested,assertForeign:async()=>assert.ok((await readOwnedGroup(foreign.pid)).some(p=>sameProcess(p,foreignIdentity)))}
}
test('[G.6 BASE-OPS-002] exclusive scope stops a detached child born after capture and launcher exit, preserving same-cwd foreign processes',async t=>{
 const f=await fixture(t),output=once(f.leader.stdout,'data');f.leader.stdin.write('spawn');const nested=await f.nested((await output)[0])
 const closed=once(f.leader,'close');f.leader.stdin.end('exit');await closed
 await stopOwnedGroup(f.leader,'SIGTERM',f.owned)
 assert.deepEqual(await readOwnedGroup(nested.pgid),[])
 assert.deepEqual(await readOwnedTree(f.leader,f.owned),[])
 await f.assertForeign()
})
test('[G.6 BASE-OPS-002] a fork during cancellation is discovered after its launcher exits',async t=>{
 const f=await fixture(t,true),output=once(f.leader.stdout,'data')
 // Capture the real child independently for identity-checked emergency teardown.
 const captured=output.then(async([data])=>f.nested(data))
 await stopOwnedGroup(f.leader,'SIGTERM',f.owned)
 const nested=await captured
 assert.deepEqual(await readOwnedGroup(nested.pgid),[])
 await f.assertForeign()
})
test('[G.6 BASE-OPS-002] stale PID birth claims never signal a foreign process',async t=>{
 const f=await fixture(t),closed=once(f.leader,'close');f.leader.kill('SIGTERM');await closed
 const forged={...f.foreignIdentity,birth:process.platform==='linux'?'1':'Thu Jan  1 00:00:00 1970'}
 f.owned.push(forged)
 await stopOwnedGroup(f.leader,'SIGTERM',f.owned)
 await f.assertForeign()
})
test('[G.6 BASE-OPS-002] an unreaped zombie of the same user never blocks scoped inspection',async t=>{
 const tmp=resolve(process.env.TMPDIR??'..');await mkdir(tmp,{recursive:true})
 const scope=await createProcessScope(join(tmp,'zombie-scope-test-'))
 // The shell forks a short-lived child, then becomes a process that never waits
 // for it, so the child stays a zombie until its parent is killed.
 const parent=spawn('/bin/sh',['-c','sleep 0 & exec sleep 60'],{detached:true,stdio:'ignore'})
 await once(parent,'spawn')
 t.after(async()=>{try{process.kill(parent.pid,'SIGKILL')}catch(error){if(error.code!=='ESRCH')throw error};await rm(scope.root,{recursive:true,force:true})})
 let zombie
 for(let n=0;n<100&&!zombie;n++){
  zombie=(await readProcessTable()).find(member=>member.ppid===parent.pid&&member.state.startsWith('Z'))
  if(!zombie)await delay(20)
 }
 assert.ok(zombie,'the parent holds an unreaped zombie child')
 // A zombie keeps no environment; Linux refuses to read it while it stays listed.
 assert.deepEqual(await scopedProcesses(scope,await readProcessTable()),[])
})
test('[G.6 BASE-OPS-002] a same-user process that withholds inspection never blocks scoped inspection',async t=>{
 const tmp=resolve(process.env.TMPDIR??'..');await mkdir(tmp,{recursive:true})
 const scope=await createProcessScope(join(tmp,'opaque-scope-test-'))
 // On Linux the child makes itself non-dumpable, as service managers do, so its
 // environment is not readable. Elsewhere it is an ordinary unmarked process.
 const source=process.platform==='linux'
  ?'import ctypes,time;ctypes.CDLL(None).prctl(4,0);print("ready",flush=True);time.sleep(60)'
  :'import time;print("ready",flush=True);time.sleep(60)'
 const opaque=spawn('python3',['-c',source],{detached:true,stdio:['ignore','pipe','ignore']})
 t.after(async()=>{try{process.kill(opaque.pid,'SIGKILL')}catch(error){if(error.code!=='ESRCH')throw error};await rm(scope.root,{recursive:true,force:true})})
 await once(opaque.stdout,'data')
 const table=await readProcessTable()
 assert.ok(table.some(member=>member.pid===opaque.pid))
 assert.deepEqual(await scopedProcesses(scope,table),[])
})
test('[G.6 BASE-OPS-002] a process whose working directory is not inspectable never blocks directory inspection',async()=>{
 // Process 1 belongs to another user on a hosted runner, so Linux refuses its working directory.
 const directories=await processDirectories([{pid:1}])
 assert.ok(directories instanceof Map)
})
