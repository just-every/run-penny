// Resolve the seed-local documented-format rows through the adopted registry API.
// Resolve shipped bytes offline. The intended public URL is not fetched here;
// success makes no claim about public repository availability or a real export.
// `--refresh` recomputes each row's guide hash, size and committed revision.
import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {validateImporters} from '../../base/modules/import-kit/src/status/index.ts'
const root=new URL('../../',import.meta.url),published='https://github.com/just-every/run-penny/blob/main/'
try{
 const document=JSON.parse(await readFile(new URL('importers.json',root),'utf8'))
 if(process.argv[2]==='--refresh'){
  for(const {evidence} of document.importers){
   const bytes=await readFile(new URL(evidence.sourcePath,root)),sha256=createHash('sha256').update(bytes).digest('hex')
   const revision=execFileSync('git',['log','-1','--format=%H','--',evidence.sourcePath],{cwd:root,encoding:'utf8'}).trim()
   if(!revision||!execFileSync('git',['show',revision+':'+evidence.sourcePath],{cwd:root}).equals(bytes))throw new Error('Commit '+evidence.sourcePath+' before refreshing its importer evidence.')
   Object.assign(evidence,{link:published+evidence.sourcePath,sha256,size:bytes.length,sourceRepository:'urn:git:commit:'+revision,sourceRevision:revision,sourceSha256:sha256})
  }
  await writeFile(new URL('importers.json',root),JSON.stringify(document,null,2)+'\n')
 }
 const guides=new Map(await Promise.all(document.importers.map(async ({evidence})=>[published+evidence.sourcePath,new Uint8Array(await readFile(new URL(evidence.sourcePath,root)))])))
 const result=await validateImporters(document,{trustedHosts:['github.com'],resolve:async link=>guides.has(link)?{url:link,bytes:guides.get(link)}:undefined})
 if(!result.valid){console.error(JSON.stringify({valid:false,issues:result.issues}));process.exitCode=1}
 else console.log(JSON.stringify({valid:true,resolution:'shipped-guide-offline',publicAvailability:'unverified',evidence:result.evidence,importers:document.importers.map(row=>({incumbent:row.incumbent,status:row.status,realExport:row.evidence.realExport}))}))
}catch(error){console.error(error instanceof Error&&error.message.startsWith('Commit ')?error.message:'Importer status validation failed.');process.exitCode=1}
