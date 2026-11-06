import {fork} from 'node:child_process'
const child=fork('scripts/portability/ledger.mjs',[],{execArgv:[],stdio:['ignore','pipe','pipe','ipc']})
let reply
child.stdout.pipe(process.stdout);child.stderr.pipe(process.stderr)
child.on('message',message=>{reply=message})
const code=await new Promise(resolve=>child.on('exit',resolve))
console.log(JSON.stringify({exit:code,reply}))
// false means the existing complete ledger needs no additional native apply.
// The adapter accepts either boolean and refuses only a missing/invalid reply.
if(code!==0||typeof reply?.nativeApply!=='boolean'||reply.refused)process.exitCode=1
