import assert from 'node:assert/strict'
import {test} from 'node:test'
import {mkdtemp,readFile,rm,stat} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {spawn} from 'node:child_process'
import {pathToFileURL} from 'node:url'

test('[BASE-OPS-001] the public deploy dry run builds the real artifact without credentials or provider requests',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'penny-deploy-dry-run-')),requests=join(directory,'requests.jsonl')
 try{
  const fixture=pathToFileURL(resolve('tests/installer/cloudflare-dry-run-fixture.mjs')).href
  const invoke=(flags=[])=>new Promise((done,reject)=>{
   const child=spawn(process.execPath,['node_modules/@runeditrun/rer/global/rer.mjs','deploy','--dry-run','--owner-name','Owner',...flags],{env:{...process.env,
    CLOUDFLARE_ACCOUNT_ID:'',CLOUDFLARE_API_TOKEN:'',OPERATOR_EMAIL:'owner@example.com',MAIL_PROVIDER:'later',MAIL_FROM:'',MAIL_API_KEY:'',
    PENNY_DRY_RUN_REQUESTS:requests,NODE_OPTIONS:`--import=${fixture}`},stdio:['ignore','pipe','pipe']})
   let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{output=(output+data).slice(-16000)})
   child.on('error',reject);child.on('close',(code,signal)=>done({code,signal,output}))
  })
  const before=await stat('dist/server/index.js').catch(()=>null)
  // rer 0.2.91's owner dry run is a local build/plan. Target credentials,
  // permissions and remote readiness are checked only by a real deployment.
  const result=await invoke()
  assert.equal(result.code,0,result.output);assert.equal(result.signal,null)
  const built=await stat('dist/server/index.js')
  assert.ok(!before||built.mtimeMs>before.mtimeMs,'The public command builds the real Worker artifact')
  assert.equal(await readFile(requests,'utf8').catch(()=>''),'','Dry run makes no provider request, including reads')
  // A real invalid target still has a failing CLI exit before any build/effect.
  const invalid=await invoke(['--environment','../invalid'])
  assert.notEqual(invalid.code,0,invalid.output)
  assert.equal((await stat('dist/server/index.js')).mtimeMs,built.mtimeMs,'Invalid deployment target refuses before building')
  assert.equal(await readFile(requests,'utf8').catch(()=>''),'','Invalid target makes no provider request')
 }finally{await rm(directory,{recursive:true,force:true})}
})
