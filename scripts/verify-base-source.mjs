// Thin alias to the maintained copy verifier. No product hash implementation.
import {resolve} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {verifyCopies} from './edition-authoring/base-copies.mjs'
const root=fileURLToPath(new URL('../',import.meta.url))
export async function verifyBaseSource(directory=root,{base,offline=true,record='base-copies.json'}={}){
 const result=verifyCopies(directory,{record,base,offline})
 if(!result.ok)throw new Error('Base custody: '+[...result.drift.map(item=>item.kind),...(result.unrecordedCopies.length?['unrecordedCopies']:[])].join(','))
 return result
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{const result=await verifyBaseSource();console.log(JSON.stringify({ok:result.ok,copies:result.copies,origin:result.origin}))}
 catch(error){console.error(error.message);process.exitCode=1}
}
