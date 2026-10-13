import {refuse} from './errors.mjs'
const options=new Set(['--origin','--session-file','--journal','--resume','--journal-out','--expected-status'])
const flags=new Set(['--prior-runner-stopped'])
export function dataOptions(argv) {
 const [command,...raw]=argv,args=raw[0]==='--'?raw.slice(1):raw,values={},positionals=[]
 for(let i=0;i<args.length;i++) {
  const arg=args[i]
  if(options.has(arg)) {
   if(values[arg]!==undefined||!args[i+1]||args[i+1].startsWith('--'))refuse('invalid_data_options')
   values[arg]=args[++i]
  } else if(flags.has(arg)) {
   if(values[arg]!==undefined)refuse('invalid_data_options')
   values[arg]=true
  } else if(arg.startsWith('--'))refuse('invalid_data_options')
  else positionals.push(arg)
 }
 if(!values['--origin']||!values['--session-file'])refuse('origin_and_private_session_file_required')
 return {command,values,positionals}
}
export function dataOrigin(value) {
 let url;try {url=new URL(value)}catch {refuse('invalid_data_origin')}
 const loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname)
 if((url.protocol!=='https:'&&!(url.protocol==='http:'&&loopback))||url.username||url.password||url.pathname!=='/'||url.search||url.hash)refuse('insecure_data_origin')
 return url
}
