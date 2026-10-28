/** Run the maintained CLI at the runtime's recorded Base revision. Until the
 * matching release is on npm, CI obtains that immutable archive through gh. */
import {mkdtemp,readFile,rm,open} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {spawn} from 'node:child_process'
const root=process.cwd(),copies=JSON.parse(await readFile(join(root,'base-copies.json'),'utf8'))
const pin=copies.copies.find(copy=>copy.originPath==='modules/agent-door')?.revision
if(!/^[a-f0-9]{40}$/.test(pin??''))throw Error('Agent CLI needs the recorded immutable Base revision')
async function run(command,args,stdio='inherit'){
 await new Promise((done,fail)=>{const child=spawn(command,args,{stdio});child.once('error',fail);child.once('exit',code=>code===0?done():fail(Error(`${command} exited ${code}`)))})
}
let temporary,archive=process.env.RER_AGENT_BASE_ARCHIVE
try{
 if(!archive){
  temporary=await mkdtemp(join(tmpdir(),'penny-agent-cli-'));archive=join(temporary,'base')
  const {mkdir}=await import('node:fs/promises');await mkdir(archive)
  const file=await open(join(temporary,'base.tar.gz'),'wx',0o600)
  try{await run('gh',['api',`repos/runeditrun/base/tarball/${pin}`],['ignore',file.fd,'inherit'])}finally{await file.close()}
  await run('tar',['-xzf',join(temporary,'base.tar.gz'),'--no-same-owner','--strip-components=1','-C',archive])
 }
 console.log(`Penny agent conformance: maintained Base CLI ${pin}`)
 const {checkAgentDoor}=await import(pathToFileURL(resolve(archive,'cli/agent-door.mjs')))
 await checkAgentDoor(root)
}catch(error){console.error(error.code??'agent_conformance_failed',error.message);process.exitCode=1
}finally{if(temporary)await rm(temporary,{recursive:true,force:true})}
