import { resolve,dirname,isAbsolute } from 'node:path'
import { privateBytes,privateInput,privateWrite } from '../data/private-files.mjs'
import { dataTransport } from '../data/transport.mjs'
import {refuse} from '../data/errors.mjs'
import { dataOrigin } from '../data/options.mjs'
const failure=message=>refuse(message)
const receipt=job=>({id:job.id,state:job.state,checkpoint:job.checkpoint,total:job.total})
export async function feedbackCommand(args) {
 if(args[0]==='--')args=args.slice(1)
 const [action,...rest]=args,options={}
 for(let i=0;i<rest.length;i+=2){if(!['--source','--out','--origin','--session-file','--fingerprint','--job','--preview'].includes(rest[i])||options[rest[i]]!==undefined||!rest[i+1]||rest[i+1].startsWith('--'))failure('Invalid saved-feedback command options.');options[rest[i]]=rest[i+1]}
 if(!['prepare','preview','apply','status','resume','undo','rollback','originals','receipt'].includes(action))failure('Choose prepare, preview, apply, status, resume, undo, rollback, originals or receipt.')
 if(action==='receipt'&&options['--preview'])return (await privateInput(resolve(options['--preview']),8*1024*1024)).receipt
 let source
 if(['prepare','preview','apply'].includes(action)) {
  if(!options['--source'])failure('A private saved-source manifest is required.')
  const path=resolve(options['--source']),manifest=await privateInput(path,8*1024*1024)
  if(!Array.isArray(manifest.files)||!manifest.files.length||manifest.files.length>30)failure('Invalid saved-source manifest.')
  let bytes=0
  const files=[]
  for(const file of manifest.files) {
   if(typeof file.path!=='string'||isAbsolute(file.path)||file.path.split(/[\\/]/).includes('..'))failure('Source files must be relative to the private manifest.')
   const content=await privateBytes(resolve(dirname(path),file.path),4*1024*1024).catch(error=>{if(error?.code==='private_input_limit')failure('Saved file exceeds the 4194304-byte per-file limit. No history was applied.');throw error});bytes+=content.length;if(bytes>24*1024*1024)failure('Saved source exceeds the 25165824-byte bundle limit. No history was applied.')
   const {path:ignored,...metadata}=file;void ignored;files.push({...metadata,base64:content.toString('base64')})
  }
  source={...manifest,files}
 }
 if(action==='prepare'){if(!options['--out'])failure('An owner-only output file is required.');await privateWrite(options['--out'],source);return {prepared:true}}
 if(!options['--origin']||!options['--session-file'])failure('An explicit origin and private operator session file are required.')
 dataOrigin(options['--origin'])
 const request=await dataTransport(options['--origin'],options['--session-file'],'feedback-import')
 if(action==='preview') {if(!options['--out'])failure('A private preview output is required.');const plan=await request('preview',source);await privateWrite(options['--out'],plan);return {preview:true,counts:plan.counts,fingerprint:plan.fingerprint,receipt:plan.receipt}}
 if(action==='apply'){if(!/^[a-f0-9]{64}$/.test(options['--fingerprint']??''))failure('The exact reviewed preview fingerprint is required.');return receipt(await request('apply',{source,fingerprint:options['--fingerprint']}))}
 if(!/^[a-f0-9-]{36}$/.test(options['--job']??''))failure('A persisted import job ID is required.')
 const path='jobs/'+options['--job']
 if(action==='receipt')return request(path+'/receipt')
 if(action==='originals'){if(!options['--out'])failure('A private originals output is required.');await privateWrite(options['--out'],await request(path+'/originals'));return {originalsSaved:true}}
 return receipt(await request(path+(action==='status'?'':'/'+action),action==='status'?undefined:{}))
}
