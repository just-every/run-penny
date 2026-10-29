import assert from 'node:assert/strict'
import {test} from 'node:test'
import {mkdtemp,readFile,rm,stat} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {spawn} from 'node:child_process'
import {pathToFileURL} from 'node:url'

test('[BASE-OPS-001] the public deploy dry run builds a local plan, reports unmet real-deploy inputs and never contacts a provider',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'penny-deploy-dry-run-')),requests=join(directory,'requests.jsonl')
 try{
  const fixture=pathToFileURL(resolve('tests/installer/cloudflare-dry-run-fixture.mjs')).href
  // The released public dry run is local even with supplied account inputs.
  // The network fixture records any accidental request and refuses writes.
  const invoke=(extra={})=>new Promise((done,reject)=>{
   const child=spawn(process.execPath,['node_modules/@runeditrun/rer/global/rer.mjs','deploy','--dry-run','--owner-name','Owner','--json'],{env:{...process.env,
    CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_API_TOKEN:'synthetic-dry-run-token',OPERATOR_EMAIL:'owner@example.com',MAIL_PROVIDER:'sendgrid',MAIL_FROM:'support@runeditrun.com',MAIL_API_KEY:'synthetic-dry-run-mail-key',
    PENNY_DRY_RUN_REQUESTS:requests,NODE_OPTIONS:`--import=${fixture}`,...extra},stdio:['ignore','pipe','pipe']})
   let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{output=(output+data).slice(-16000)})
   child.on('error',reject);child.on('close',(code,signal)=>done({code,signal,output}))
  })
  const receipt=result=>{
   const rows=result.output.split('\n').flatMap(line=>{try{return [JSON.parse(line)]}catch{return []}})
   const value=rows.findLast(row=>row.verb==='deploy'&&row.event==='result')
   assert.equal(result.code,0,result.output);assert.equal(result.signal,null)
   assert.equal(value?.ok,true);assert.equal(value?.dryRun,true);assert.equal(value?.deployed,false)
   assert.ok(value.plan&&typeof value.plan.worker==='string')
   assert.ok(value.plan.d1.some(item=>item.migrations.length>0),'The real artifact has a migration plan')
   assert.ok(value.plan.r2.length&&value.plan.queues.length,'The native files and queue have a local plan')
   assert.doesNotMatch(result.output,/synthetic-dry-run-token|synthetic-dry-run-mail-key/,'Credential values are never returned')
   return value
  }
  const before=await stat('dist/server/index.js').catch(()=>null)
  const absent=receipt(await invoke({CLOUDFLARE_ACCOUNT_ID:'',CLOUDFLARE_API_TOKEN:''}))
  assert.ok(absent.neededForRealDeploy?.length,'A local plan retains its unmet real-deploy inputs')
  const built=await stat('dist/server/index.js')
  assert.ok(built.isFile()&&built.size>0&&(!before||built.mtimeMs>before.mtimeMs),'The public command built the real Worker')
  const supplied=receipt(await invoke())
  assert.deepEqual(supplied.plan,absent.plan,'Supplying credentials does not turn a local plan into a remote check')
  for(const extra of [{MAIL_API_KEY:''},{MAIL_FROM:''}]){
   const missing=receipt(await invoke(extra))
   assert.ok(missing.neededForRealDeploy?.length,'A plan never claims missing sign-in inputs are ready for a real deploy')
  }
  assert.equal(await readFile(requests,'utf8').catch(()=>''),'','Dry run makes no provider read or write with any input set')

 }finally{await rm(directory,{recursive:true,force:true})}
})
