import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
const git=(repo,...args)=>execFileSync('git',['-C',repo,...args],{maxBuffer:64*1024*1024,stdio:['ignore','pipe','pipe']})
const text=(repo,...args)=>git(repo,...args).toString().trim()
const json=(repo,ref,path)=>JSON.parse(git(repo,'show',`${ref}:${path}`))
const failure=()=>{throw new Error('Publication candidate custody refused')}
export function assertCandidateRefs(refs,count){
 if(count!==1||refs.length!==1||refs[0]!=='refs/heads/main')failure()
}
function inventory(repo,ref){
 return git(repo,'ls-tree','-rz','--full-tree',ref).toString().split('\0').filter(Boolean).map(row=>{
  const split=row.indexOf('\t'),[mode,type,blob]=row.slice(0,split).split(' ')
  if(type!=='blob'||!['100644','100755'].includes(mode))failure()
  return {mode,blob,path:row.slice(split+1)}
 })
}
/** Read-only inspection; publishing remains the maintained release tool's job. */
export function inspectPublicationCandidate(source,sourceRef,candidate){
 if(!/^[0-9a-f]{40}$/.test(sourceRef))failure()
 const edition=json(source,sourceRef,'edition.json'),project=json(source,sourceRef,'rer-project.json')
 if(edition.id!=='just-every/penny'||project.projectId!==edition.id||project.sourceRepository!=='https://github.com/just-every/run-penny')failure()
 assertCandidateRefs(text(candidate,'for-each-ref','--format=%(refname)').split('\n').filter(Boolean),Number(text(candidate,'rev-list','--count','--all')))
 if(existsSync(resolve(candidate,text(candidate,'rev-parse','--git-path','objects/info/alternates'))))failure()
 const reachable=new Set(text(candidate,'rev-list','--objects','--all').split('\n').map(row=>row.split(' ')[0]))
 const objects=text(candidate,'cat-file','--batch-all-objects','--batch-check=%(objectname)').split('\n')
 if(objects.length!==reachable.size||objects.some(object=>!reachable.has(object)))failure()
 const candidateRef=text(candidate,'rev-parse','HEAD')
 if(text(candidate,'rev-list','--parents','-n','1',candidateRef)!==candidateRef||text(candidate,'status','--porcelain'))failure()
 const a=inventory(source,sourceRef),b=inventory(candidate,candidateRef)
 if(a.length!==b.length)failure()
 for(let i=0;i<a.length;i++){
  if(a[i].path!==b[i].path||a[i].mode!==b[i].mode||a[i].blob!==b[i].blob||!git(source,'cat-file','blob',a[i].blob).equals(git(candidate,'cat-file','blob',b[i].blob)))failure()
 }
 const sourceTree=text(source,'rev-parse',`${sourceRef}^{tree}`),candidateTree=text(candidate,'rev-parse',`${candidateRef}^{tree}`)
 if(sourceTree!==candidateTree)failure()
 return {source:sourceRef,candidate:candidateRef,sourceTree,candidateTree,files:a.length,commits:1,tags:0,rawBlobsEqual:true,modesEqual:true,project:edition.id,repository:project.sourceRepository}
}
