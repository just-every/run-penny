import assert from 'node:assert/strict'
import {test} from 'node:test'
import {mkdtemp,writeFile,readFile,rm,stat,unlink} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {spawn} from 'node:child_process'
test('Discord CLI registers capture and recovers killed and expired Gateway sessions without losing selected-channel reactions',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'penny-discord-relay-')),config=join(dir,'config.json'),state=join(dir,'state.json'),report=join(dir,'edge.jsonl')
 const values={appOrigin:'https://penny.example.test',applicationId:'120000000000000004',botToken:'synthetic-discord-bot-token-not-live',gatewaySecret:'synthetic-relay-key-not-live-1234567890',guildId:'120000000000000001',channelIds:['120000000000000002']}
 await writeFile(config,JSON.stringify(values),{mode:0o600})
 async function run(script,crash=false,reset=''){return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['--import',resolvePath('tests/fixtures/discord/gateway-edge.mjs'),script,config,state],{env:{...process.env,PENNY_DISCORD_EDGE_REPORT:report,PENNY_DISCORD_EDGE_CRASH:crash?'1':'0',PENNY_DISCORD_EDGE_RESET:reset},stdio:['ignore','pipe','pipe']}),parts=[]
  child.stdout.on('data',p=>parts.push(p));child.stderr.on('data',p=>parts.push(p));child.once('error',reject);const timeout=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Relay failed to finish its network journey'))},15000)
  child.once('exit',(code,signal)=>{clearTimeout(timeout);const output=Buffer.concat(parts).toString();assert.ok(!output.includes(values.botToken)&&!output.includes(values.gatewaySecret));resolve({code,signal})})
 })}
 const resolvePath=resolve
 try{
  assert.equal((await run('scripts/discord/register.mjs')).code,0)
  assert.equal((await run('scripts/discord/relay.mjs',true)).signal,'SIGKILL')
  assert.equal(JSON.parse(await readFile(state,'utf8')).sequence,1,'Unacknowledged delivery never advances the cursor')
  // A supervisor confirms the killed process exited before clearing its lock.
  await unlink(state+'.lock')
  assert.equal((await run('scripts/discord/relay.mjs')).code,0)
  const records=(await readFile(report,'utf8')).trim().split('\n').map(line=>JSON.parse(line)),deliveries=records.filter(row=>row.kind==='delivery')
  assert.equal(records.filter(row=>row.kind==='register').length,1);assert.equal(records.find(row=>row.kind==='register').body.type,3)
  assert.equal(records.filter(row=>row.kind==='resume').length,1);assert.equal(deliveries.length,2);assert.deepEqual(deliveries[0],deliveries[1]);assert.equal(deliveries[0].body.d.channel_id,values.channelIds[0]);assert.equal(JSON.parse(await readFile(state,'utf8')).sequence,3);assert.equal((await stat(state)).mode&0o777,0o600)
  // A session-expired/invalid-sequence close must not let an old in-flight
  // acceptance repopulate the replacement session's cursor.
  for(const code of ['4009','4007']){
   await unlink(state);await writeFile(report,'')
   assert.equal((await run('scripts/discord/relay.mjs',false,code)).code,0)
   const resetRecords=(await readFile(report,'utf8')).trim().split('\n').map(line=>JSON.parse(line))
   assert.deepEqual(resetRecords.filter(row=>row.kind==='delivery').map(row=>row.body.d.message_id),['130000000000000001','130000000000000002'],`Close ${code} delivers both distinct selected-channel reactions`)
   assert.deepEqual(resetRecords.find(row=>row.kind==='reset-cursor').cursor,{sequence:null,sessionId:null,resumeUrl:null},'Session reset is persisted before identifying again')
   assert.deepEqual(JSON.parse(await readFile(state,'utf8')),{sequence:2,sessionId:'replacement-session',resumeUrl:'wss://gateway.discord.gg/?v=10&encoding=json'})
  }
 }finally{await rm(dir,{recursive:true,force:true})}
})
