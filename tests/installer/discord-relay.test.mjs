import assert from 'node:assert/strict'
import {test} from 'node:test'
import {mkdtemp,writeFile,readFile,rm,stat,unlink} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {spawn} from 'node:child_process'
test('Discord app CLI installs the message command and resumes a killed Gateway at the last acknowledged cursor without reading unselected channels',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'penny-discord-relay-')),config=join(dir,'config.json'),state=join(dir,'state.json'),report=join(dir,'edge.jsonl')
 const values={appOrigin:'https://penny.example.test',applicationId:'120000000000000004',botToken:'synthetic-discord-bot-token-not-live',gatewaySecret:'synthetic-relay-key-not-live-1234567890',guildId:'120000000000000001',channelIds:['120000000000000002']}
 await writeFile(config,JSON.stringify(values),{mode:0o600})
 async function run(script,crash=false){return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['--import',resolvePath('tests/fixtures/discord/gateway-edge.mjs'),script,config,state],{env:{...process.env,PENNY_DISCORD_EDGE_REPORT:report,PENNY_DISCORD_EDGE_CRASH:crash?'1':'0'},stdio:['ignore','pipe','pipe']}),parts=[]
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
 }finally{await rm(dir,{recursive:true,force:true})}
})
