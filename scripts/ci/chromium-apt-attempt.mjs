import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {pathToFileURL} from 'node:url'

// Keep the existing deadline and grace period, but own the whole attempt.
// GNU timeout stops supervising after its direct child exits on TERM; dpkg
// can still be finishing a critical section in an orphaned descendant.
export async function aptAttempt(command,args,{deadlineMs=90_000,graceMs=5_000}={}){
 const child=spawn(command,args,{detached:true,stdio:'inherit'})
 const signalGroup=signal=>{
  if(!child.pid)return
  try{process.kill(-child.pid,signal)}catch(error){if(error.code!=='ESRCH')throw error}
 }
 let termination,status
 const terminate=code=>{
  if(termination)return
  status=code
  termination=(async()=>{
   signalGroup('SIGTERM')
   await new Promise(resolve=>setTimeout(resolve,graceMs))
   signalGroup('SIGKILL')
  })()
 }
 const interrupt=()=>terminate(130),stop=()=>terminate(143)
 process.on('SIGINT',interrupt);process.on('SIGTERM',stop)
 const timer=setTimeout(()=>terminate(124),deadlineMs)
 try{
  const [code]=await once(child,'exit')
  clearTimeout(timer)
  if(termination)await termination
  return status??code??1
 }finally{
  clearTimeout(timer)
  signalGroup('SIGKILL')
  process.off('SIGINT',interrupt);process.off('SIGTERM',stop)
 }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [command,...args]=process.argv.slice(2)
 if(!command)throw new Error('Chromium apt attempt requires a command')
 process.exitCode=await aptAttempt(command,args)
}
