import assert from 'node:assert/strict'
import {test} from 'node:test'
import {mkdtemp,readFile,rm,stat} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {spawn} from 'node:child_process'
import {pathToFileURL} from 'node:url'

test('[BASE-OPS-001] the public deploy dry run builds the real artifact and reads target configuration without a provider write',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'penny-deploy-dry-run-')),requests=join(directory,'requests.jsonl')
 try{
  const fixture=pathToFileURL(resolve('tests/installer/cloudflare-dry-run-fixture.mjs')).href
  // The published support contact is a valid sender; the network fixture permits only provider reads.
  const invoke=(extra={})=>new Promise((done,reject)=>{
   const child=spawn(process.execPath,['node_modules/@runeditrun/rer/global/rer.mjs','deploy','--dry-run','--owner-name','Owner'],{env:{...process.env,
    CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_API_TOKEN:'synthetic-dry-run-token',OPERATOR_EMAIL:'owner@example.com',MAIL_PROVIDER:'sendgrid',MAIL_FROM:'support@runeditrun.com',MAIL_API_KEY:'synthetic-dry-run-mail-key',
    PENNY_DRY_RUN_REQUESTS:requests,NODE_OPTIONS:`--import=${fixture}`,...extra},stdio:['ignore','pipe','pipe']})
   let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{output=(output+data).slice(-16000)})
   child.on('error',reject);child.on('close',(code,signal)=>done({code,signal,output}))
  })
  // Missing account inputs refuse before building or contacting Cloudflare.
  const build=await stat('dist/server/index.js').catch(()=>null)
  const preflight=await invoke({CLOUDFLARE_ACCOUNT_ID:'',CLOUDFLARE_API_TOKEN:''})
  assert.notEqual(preflight.code,0)
  assert.match(preflight.output,/Nothing was uploaded/)
  assert.match(preflight.output,/account.*Worker.*database.*files.*queue/)
  assert.match(preflight.output,/token.*permissions/)
  assert.match(preflight.output,/run npx -y @runeditrun\/rer deploy --dry-run/)
  const retry=preflight.output.match(/then run (.+)\./)?.[1]
  assert.ok(retry,'Preflight supplies a retry command')
  assert.doesNotMatch(retry,/\[REDACTED\]/,'The retry command remains usable after diagnostic redaction')
  assert.doesNotMatch(preflight.output,/missing-owner-input|\n\s+at /)
  assert.equal(await readFile(requests,'utf8').catch(()=>''),'','Preflight makes no provider request')
  assert.equal((await stat('dist/server/index.js').catch(()=>null))?.mtimeMs,build?.mtimeMs,'Preflight does not build')
  const result=await invoke()
  assert.equal(result.code,0,result.output);assert.equal(result.signal,null)
  const calls=(await readFile(requests,'utf8')).trim().split('\n').map(line=>JSON.parse(line))
  assert.ok(calls.some(call=>call.url.endsWith('/workers/subdomain')))
  assert.ok(calls.some(call=>call.url.endsWith('/workers/scripts/penny-production/settings')))
  assert.ok(calls.every(call=>call.method==='GET'))
  for(const extra of [{MAIL_API_KEY:''},{MAIL_FROM:''}]){
   const refused=await invoke(extra)
   assert.notEqual(refused.code,0,'A selected provider still requires its sender and credential')
   const refusedCalls=(await readFile(requests,'utf8')).trim().split('\n').map(line=>JSON.parse(line))
   assert.ok(refusedCalls.every(call=>call.method==='GET'),'Missing bindings never trigger a provider write')
  }
 }finally{await rm(directory,{recursive:true,force:true})}
})
