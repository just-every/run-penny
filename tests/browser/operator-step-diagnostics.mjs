import {mkdir} from 'node:fs/promises'
import {isAbsolute,join,relative,resolve,sep} from 'node:path'
import {fileURLToPath} from 'node:url'

const repository=fileURLToPath(new URL('../..',import.meta.url))
let sequence=0

// Drop every query and fragment, including development sign-in credentials.
function safeUrl(value) {
 try {
  const url=new URL(value,'http://diagnostic.invalid')
  return value.startsWith('/')?url.pathname:url.origin+url.pathname
 } catch {return '[unavailable URL]'}
}
function safeText(value) {
 return value.replace(/(?:https?:\/\/|\/)[^\s<>"']+/g,safeUrl)
}

/** Observe only response status/pathname; never collect headers or bodies. */
export function monitorStepFailures(page) {
 const responses=[]
 const observed=response=>{
  try {
   responses.push({status:response.status(),pathname:new URL(response.url()).pathname})
   if(responses.length>10)responses.shift()
  } catch {/* A detached response cannot replace the step's failure. */}
 }
 page.on('response',observed)
 return {
  stop(){page.off('response',observed)},
  async run(step,action) {
   try {return await action()}
   catch(error) {
    const diagnostics={step,url:safeUrl(page.url()),main:'[unavailable]',responses:responses.slice(),screenshot:null}
    try {diagnostics.main=safeText(await page.locator('main').innerText({timeout:1000}))}catch {/* Keep the original error. */}
    try {
     const output=resolve(process.env.PENNY_EVIDENCE??'../evidence/decision-loop-resume')
     const location=relative(repository,output)
     if(location!=='..'&&!location.startsWith('..'+sep)&&!isAbsolute(location))throw new Error('Evidence must stay outside the repository')
     await mkdir(output,{recursive:true})
     const width=page.viewportSize()?.width??'unknown'
     const path=join(output,`${step}-${width}-failure-${process.pid}-${++sequence}.png`)
     diagnostics.screenshot=path
     await page.screenshot({path,fullPage:true,timeout:5000})
    } catch {diagnostics.screenshotError='Screenshot unavailable'}
    try {error.browserDiagnostics=diagnostics}catch {/* Preserve even a non-extensible thrown error. */}
    throw error
   }
  },
 }
}
