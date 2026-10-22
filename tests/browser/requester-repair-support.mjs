import { execFileSync } from 'node:child_process'
import { mkdir,writeFile,readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
export const origin=process.env.PENNY_TEST_ORIGIN??'http://127.0.0.1:41894'
export const output=process.env.PENNY_EVIDENCE
const state=process.env.PENNY_LOCAL_STATE
if(!output||!state)throw new Error('PENNY_EVIDENCE and PENNY_LOCAL_STATE must name isolated proof directories.')
export const captures=[]
export function sql(command){
 const raw=execFileSync('pnpm',['exec','wrangler','d1','execute','feedback-penny-local','--local','--persist-to',state,'--json','--command',command],{encoding:'utf8',stdio:['ignore','pipe','pipe']})
 return JSON.parse(raw.slice(raw.indexOf('[')))[0].results
}
export async function api(path,body,headers={},method=body===undefined?'GET':'POST'){
 const response=await fetch(origin+path,{method,headers:{'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'})
 assert(response.ok||response.status===302,`${path}: ${response.status} ${await response.clone().text()}`)
 return response
}
export async function identity(email){
 await api('/api/public/identity/email',{email,displayName:'Review requester'})
 const link=sql(`SELECT token FROM local_auth_outbox WHERE recipient='${email}' ORDER BY created_at DESC LIMIT 1`)[0]
 return (await (await api('/api/public/identity/email/verify',{token:link.token})).json()).token
}
export async function operatorCookie(){
 await api('/api/auth/magic-link',{email:'owner@penny.invalid'})
 const token=sql("SELECT token FROM local_auth_outbox WHERE recipient='owner@penny.invalid' ORDER BY created_at DESC LIMIT 1")[0].token
 return (await api(`/api/auth/magic-link/consume?token=${token}`)).headers.get('set-cookie').split(';')[0]
}
export async function shot(page,name,width){
 await mkdir(output,{recursive:true});await page.evaluate(async()=>{window.scrollTo(0,0);await document.fonts.ready;await new Promise(requestAnimationFrame)})
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name} overflow ${width}`)
 const file=`${name}-${width}.jpg`;await page.screenshot({path:`${output}/${file}`,type:'jpeg',quality:82,fullPage:true})
 const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await readFile(`${output}/${file}`)))].map(b=>b.toString(16).padStart(2,'0')).join('')
 captures.push({file,width,url:page.url(),overflow:false,sha256})
}
export async function manifest(name,pageErrors,checks){
 assert.deepEqual(pageErrors,[])
 const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
 const dirty=execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()
 await writeFile(`${output}/${name}.json`,JSON.stringify({sourceCommit,dirty:Boolean(dirty),generatedAt:new Date().toISOString(),runtime:{environment:'emitted local workerd with isolated D1/R2',capabilities:await(await fetch(origin+'/api/auth/capabilities')).json(),providerSends:false,node:process.version},captures,pageErrors,checks},null,2)+'\n')
 console.log(`${captures.length} captures; ${checks.length} checks; commit ${sourceCommit}; dirty=${Boolean(dirty)}`)
}
