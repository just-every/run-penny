import {dataOptions} from './options.mjs'
import {dataTransport} from './transport.mjs'
import {privateInput,privateWrite,privateDestination} from './private-files.mjs'
import {refuse} from './errors.mjs'
const definitions={
 export:{count:1,options:[]},import:{count:1,options:['--journal','--resume'],required:['--journal']},
 journal:{count:1,options:[]},'erase-preview':{count:3,options:[]},
 erase:{count:1,options:['--journal-out'],required:['--journal-out']},status:{count:1,options:[]},
 'resume-erasure':{count:1,options:['--journal-out'],required:['--journal-out']},'abort-restore':{count:1,options:[]},
 'recover-runner':{count:1,options:['--prior-runner-stopped','--expected-status'],required:['--prior-runner-stopped','--expected-status']},
 'abort-export':{count:1,options:['--prior-runner-stopped'],required:['--prior-runner-stopped']},
 'abort-pending-erasure':{count:1,options:['--prior-runner-stopped'],required:['--prior-runner-stopped']},
}
export async function runDataCommand(argv) {
 const {command,values:v,positionals:p}=dataOptions(argv),d=definitions[command]
 if(!d||p.length!==d.count||Object.keys(v).some(key=>!['--origin','--session-file',...d.options].includes(key))||d.required?.some(key=>!v[key]))refuse('invalid_data_command_usage')
 if(v['--expected-status']&&!['running','running_r2','running_import'].includes(v['--expected-status']))refuse('invalid_runner_status')
 const request=await dataTransport(v['--origin'],v['--session-file'])
 const operation=()=>{if(!/^[A-Za-z0-9_-]{1,160}$/.test(p[0]))refuse('invalid_operation_id');return 'operations/'+p[0]}
 if(command==='export') {
  await privateDestination(p[0]);await privateDestination(p[0]+'.erasure-journal.json')
  const result=await request('export')
  const archivePath=await privateWrite(p[0],result.archive),journalPath=await privateWrite(p[0]+'.erasure-journal.json',result.journal)
  return {archivePath,journalPath,archiveSha256:result.archive.sha256,epoch:result.journal.epoch,tableCount:Object.keys(result.archive.tables).length,rowCount:Object.values(result.archive.tables).reduce((n,rows)=>n+rows.length,0),fileCount:result.archive.files.length}
 }
 if(command==='import') {
  const input=await privateInput(p[0]),journal=await privateInput(v['--journal'])
  return request('import',{archive:input.archive??input,journal,...(v['--resume']?{resumeOperationId:v['--resume']}:{})})
 }
 if(command==='journal') {
  await privateDestination(p[0],true);const journal=await request('journal')
  return {journalPath:await privateWrite(p[0],journal,true),epoch:journal.epoch,sha256:journal.sha256}
 }
 if(command==='erase-preview') {
  await privateDestination(p[2]);const plan=await request('erasure/preview',{table:p[0],id:p[1]})
  return {planPath:await privateWrite(p[2],plan),counts:plan.counts,fileCount:plan.fileCount,blockedCopyCount:plan.blockedCopies?.length??0}
 }
 if(command==='erase'||command==='resume-erasure') {
  await privateDestination(v['--journal-out'],true)
  let result
  if(command==='erase') {
   const plan=await privateInput(p[0]);if(plan.blockedCopies?.length)refuse('ambiguous_erasure_copies')
   result=await request('erasure',{table:plan.table,id:plan.id,planHash:plan.planHash})
  } else result=await request(operation()+'/resume',{})
  const journal=await request('journal')
  return {...result,journalPath:await privateWrite(v['--journal-out'],journal,true),epoch:journal.epoch}
 }
 if(command==='status')return request(operation())
 if(command==='abort-restore') {await request(operation()+'/abort-restore',{});return {status:'restore_cleanup_complete'}}
 await request(operation()+'/'+command,{confirmPriorRunnerStopped:true,...(command==='recover-runner'?{expectedStatus:v['--expected-status']}:{})})
 return {status:'interrupted_operation_released'}
}
