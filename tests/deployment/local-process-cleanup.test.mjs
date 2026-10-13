import assert from 'node:assert/strict'
import test from 'node:test'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { stopOwnedGroup } from '../helpers/local-process-cleanup.mjs'
import { readOwnedGroup, sameProcess } from '../helpers/local-process-table.mjs'
import { readOwnedTree } from '../helpers/local-process-tree.mjs'

async function fixture(t) {
 const source=`const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"],{detached:true,stdio:'ignore'});console.log(child.pid);process.stdin.on('data',()=>process.exit(0));setInterval(()=>{},1000)`
 const leader=spawn(process.execPath,['-e',source],{detached:true,stdio:['pipe','pipe','ignore']})
 const [bytes]=await once(leader.stdout,'data'),nested=Number(bytes.toString().trim())
 const owned=await readOwnedTree(leader)
 assert.equal(owned.some(p=>p.pid===nested && p.ppid===leader.pid),true)
 const unrelated=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true,stdio:'ignore'})
 const [protectedProcess]=await readOwnedGroup(unrelated.pid)
 assert.ok(protectedProcess)
 // Emergency teardown is identity checked too, including the intentionally red
 // pre-fix run. Only numeric metadata is emitted as process-cleanup evidence.
 t.after(async()=>{
  for(const member of owned.toReversed()){
   const current=(await readOwnedGroup(member.pgid)).find(p=>sameProcess(member,p))
   if(current){try{process.kill(current.pid,'SIGKILL')}catch(error){if(error.code!=='ESRCH')throw error}}
  }
  await delay(100)
  for(const pgid of new Set(owned.map(p=>p.pgid)))assert.equal((await readOwnedGroup(pgid)).length,0)
  if((await readOwnedGroup(unrelated.pid)).some(p=>sameProcess(p,protectedProcess))){
   const closed=once(unrelated,'close')
   try{process.kill(unrelated.pid,'SIGKILL')}catch(error){if(error.code!=='ESRCH')throw error}
   await closed
  }
  assert.deepEqual(await readOwnedGroup(unrelated.pid),[])
 })
 const assertUnrelated=async()=>assert.equal((await readOwnedGroup(unrelated.pid)).some(p=>sameProcess(p,protectedProcess)),true,'Unrelated process remains alive')
 return {leader,owned,nested,assertUnrelated}
}
test('[G.6 BASE-OPS-002] cleanup retains numeric ownership after a launcher exits with a nested detached descendant',async t=>{
 const {leader,owned,assertUnrelated}=await fixture(t)
 const closed=once(leader,'close');leader.stdin.end('exit');await closed
 await stopOwnedGroup(leader,'SIGTERM',owned)
 for(const pgid of new Set(owned.map(p=>p.pgid)))assert.deepEqual(await readOwnedGroup(pgid),[])
 await assertUnrelated()
 console.log(JSON.stringify({case:'lost-leader',owned:owned.map(({pid,ppid,pgid})=>({pid,ppid,pgid})),remaining:0}))
})
test('[G.6 BASE-OPS-002] recovery failure still stops detached descendants and repeated cleanup accepts already-gone processes',async t=>{
 const {leader,owned,assertUnrelated}=await fixture(t)
 const original=new Error('Recovery failed')
 await assert.rejects(async()=>{try{throw original}finally{await stopOwnedGroup(leader,'SIGTERM',owned)}},error=>error===original)
 await stopOwnedGroup(leader,'SIGTERM',owned)
 for(const pgid of new Set(owned.map(p=>p.pgid)))assert.deepEqual(await readOwnedGroup(pgid),[])
 await assertUnrelated()
 console.log(JSON.stringify({case:'recovery-failure',owned:owned.map(({pid,ppid,pgid})=>({pid,ppid,pgid})),remaining:0}))
})
