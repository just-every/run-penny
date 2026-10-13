import {constants} from 'node:fs'
import {open,lstat,mkdir,rename,unlink} from 'node:fs/promises'
import {dirname,resolve,parse} from 'node:path'
import {randomUUID} from 'node:crypto'
import {refuse} from './errors.mjs'
export const MAX_ARCHIVE_BYTES=32*1024*1024
async function parents(path) {
 let at=dirname(resolve(path)),root=parse(at).root
 while(true) {
  let stat;try {stat=await lstat(at)}catch(error) {if(error.code!=='ENOENT')throw error}
  if(stat&&(!stat.isDirectory()||stat.isSymbolicLink()))refuse('unsafe_private_file_parent')
  if(at===root)break
  at=dirname(at)
 }
}
function privateStat(stat) {
 if(!stat.isFile()||stat.nlink!==1||(stat.mode&0o777)!==0o600||(process.getuid&&stat.uid!==process.getuid()))refuse('unsafe_private_file')
}
export async function privateBytes(path,max=MAX_ARCHIVE_BYTES) {
 await parents(path)
 const handle=await open(resolve(path),constants.O_RDONLY|constants.O_NOFOLLOW)
 try {
  const stat=await handle.stat();privateStat(stat)
  if(stat.size>max)refuse('private_input_limit')
  const bytes=await handle.readFile()
  if(bytes.length>max)refuse('private_input_limit')
  const after=await handle.stat();privateStat(after)
  if(stat.size!==after.size||stat.mtimeMs!==after.mtimeMs)refuse('private_input_changed')
  return bytes
 } finally {await handle.close()}
}
export async function privateInput(path,max=MAX_ARCHIVE_BYTES) {
 const bytes=await privateBytes(path,max)
 try{return JSON.parse(bytes.toString('utf8'))}catch{refuse('invalid_private_json')}
}
export async function privateSession(path) {
 const value=await privateInput(path,8192)
 if(!value||Object.keys(value).length!==1||typeof value.cookie!=='string'||!/^(__Host-operator_session|operator_session_local)=[A-Za-z0-9_-]{20,4096}$/.test(value.cookie))refuse('invalid_operator_session_file')
 return value.cookie
}
export async function privateDestination(path,replace=false) {
 const destination=resolve(path);await parents(destination)
 let stat;try {stat=await lstat(destination)}catch(error) {if(error.code!=='ENOENT')throw error}
 if(stat) {if(!replace)refuse('private_destination_exists');privateStat(stat);if(stat.isSymbolicLink())refuse('unsafe_private_file')}
 return destination
}
export async function privateWrite(path,value,replace=false) {
 const destination=await privateDestination(path,replace)
 await mkdir(dirname(destination),{recursive:true,mode:0o700});await parents(destination)
 const temporary=replace?destination+'.pending-'+randomUUID():destination
 const handle=await open(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600)
 let complete=false
 try {await handle.writeFile(JSON.stringify(value,null,2)+'\n');await handle.sync();complete=true}
 finally {await handle.close();if(!complete)await unlink(temporary).catch(()=>{})}
 if(replace) {
  try {await privateDestination(destination,true);await rename(temporary,destination)}catch(error) {await unlink(temporary).catch(()=>{});throw error}
 }
 return destination
}
