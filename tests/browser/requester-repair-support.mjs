import { execFileSync } from 'node:child_process'
import { mkdir,writeFile,readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
export const origin=process.env.PENNY_TEST_ORIGIN??'http://127.0.0.1:41894'
export const output=process.env.PENNY_EVIDENCE
if(!output)throw new Error('PENNY_EVIDENCE must name the proof directory outside the repository.')
export const captures=[]
export async function shot(page,name,width){
 await mkdir(output,{recursive:true});await page.evaluate(async()=>{window.scrollTo(0,0);await document.fonts.ready;await new Promise(requestAnimationFrame)})
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name} overflow ${width}`)
 const file=`${name}-${width}.jpg`;await page.screenshot({path:`${output}/${file}`,type:'jpeg',quality:82,fullPage:true})
 const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await readFile(`${output}/${file}`)))].map(b=>b.toString(16).padStart(2,'0')).join('')
 captures.push({file,width,url:page.url(),overflow:false,sha256})
}
export async function manifest(name,pageErrors,checks,runtimeOrigin=origin){
 assert.deepEqual(pageErrors,[])
 const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
 const dirty=execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()
 await writeFile(`${output}/${name}.json`,JSON.stringify({sourceCommit,dirty:Boolean(dirty),generatedAt:new Date().toISOString(),runtime:{environment:'emitted local workerd with isolated D1/R2',capabilities:await(await fetch(runtimeOrigin+'/api/auth/capabilities')).json(),providerSends:false,node:process.version},captures,pageErrors,checks},null,2)+'\n')
 console.log(`${captures.length} captures; ${checks.length} checks; commit ${sourceCommit}; dirty=${Boolean(dirty)}`)
}
