import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {loadavg} from 'node:os'
export async function waitForLocalCapacity(){
 const deadline=Date.now()+20*60_000
 for(;;){
  const load=process.platform==='darwin'?Number(execFileSync('sysctl',['-n','vm.loadavg'],{encoding:'utf8'}).replace(/[{}]/g,'').trim().split(/\s+/)[0]):loadavg()[0]
  if(load<=36)return
  assert.ok(Date.now()<deadline,'Shared host remained above load 36 for 20 minutes')
  console.log('[G.6] Waiting for shared host capacity')
  await new Promise(resolve=>setTimeout(resolve,60_000))
 }
}
