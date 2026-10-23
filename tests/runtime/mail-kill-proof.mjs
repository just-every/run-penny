import assert from 'node:assert/strict'
import {fork} from 'node:child_process'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

/** Kill the owned Worker group after its durable claim and one accepted edge effect. */
export async function proveKilledMail(){
 const state=await mkdtemp(join(tmpdir(),'penny-mail-kill-')),messages=[]
 let child,sequence=0,pending=new Map(),ready,provider
 function start(){
  let markReady,markProvider,rejectReady
  ready=new Promise((resolve,reject)=>{markReady=resolve;rejectReady=reject});provider=new Promise(resolve=>{markProvider=resolve})
  child=fork(new URL('./mail-kill-child.mjs',import.meta.url),[],{env:{...process.env,PENNY_MAIL_KILL_STATE:state},execArgv:[],detached:true,stdio:['ignore','inherit','inherit','ipc']})
  console.log(`Owned mail runtime PID=${child.pid}`)
  child.on('message',message=>{
   if(message.kind==='ready')markReady()
   if(message.kind==='provider'){messages.push(message);markProvider(message)}
   if(message.kind==='result'){const result=pending.get(message.id);pending.delete(message.id);if(message.error)result?.reject(new Error(message.error));else result?.resolve(message.value)}
  })
  child.on('exit',()=>{rejectReady(new Error('Owned runtime stopped before startup'));for(const result of pending.values())result.reject(new Error('Owned runtime stopped'));pending.clear()})
  return ready
 }
 function command(action,extra={}){const id=++sequence;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});child.send({id,action,...extra})})}
 async function kill(){const owned=child;child=undefined;const ended=new Promise(resolve=>owned.once('exit',resolve));process.kill(-owned.pid,'SIGKILL');await ended}
 try{
  await start();const {cookie}=await command('setup')
  const sending=command('wake').catch(()=>null)
  const accepted=await provider
  assert.equal(accepted.recipient,'synthetic-penny-person@example.test');assert.match(accepted.text,/synthetic-penny-update/)
  const during=(await command('read',{cookie})).deliveries.find(row=>row.state==='sending')
  assert.ok(during,'The native read door sees the durable sending claim before death')
  await kill();await sending
  await start()
  const retained=(await command('read',{cookie})).deliveries.find(row=>row.id===during.id)
  assert.equal(retained.state,'sending')
  await command('age');await command('wake')
  const failed=(await command('read',{cookie})).deliveries.find(row=>row.id===during.id)
  assert.equal(failed.state,'unknown');assert.equal(failed.failureReason,'attempt_interrupted_review_required')
  await command('wake')
  assert.deepEqual((await command('read',{cookie})).deliveries.find(row=>row.id===during.id),failed,'Ambiguity stays visible across repeated drains')
  assert.equal(messages.length,1,'A restarted worker does not send an accepted message twice')
  await command('close');child=undefined
 }finally{
  if(child)await kill()
  await rm(state,{recursive:true,force:true})
 }
}
