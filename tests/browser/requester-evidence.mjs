import { execFileSync } from 'node:child_process'
import { mkdir,writeFile,readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { resolve,sep } from 'node:path'
export const output=process.env.PENNY_EVIDENCE
if(!output)throw new Error('PENNY_EVIDENCE must name the proof directory outside the repository.')
assert.ok(!resolve(output).startsWith(resolve('.')+sep),'Evidence stays outside the repository')
const axe=await readFile(new URL('../../node_modules/axe-core/axe.min.js',import.meta.url),'utf8')
export const captures=[]
export async function shot(page,name,width){
 await mkdir(output,{recursive:true});await page.evaluate(async()=>{window.scrollTo(0,0);await document.fonts.ready;await new Promise(requestAnimationFrame)})
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name} overflow ${width}`)
 await page.evaluate(axe)
 const violations=await page.evaluate(async()=>(await window.axe.run(document)).violations.filter(item=>['serious','critical'].includes(item.impact)))
 assert.deepEqual(violations,[],`${name} accessibility ${width}`)
 const file=`${name}-${width}.jpg`;await page.screenshot({path:`${output}/${file}`,type:'jpeg',quality:82,fullPage:true})
 const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await readFile(`${output}/${file}`)))].map(b=>b.toString(16).padStart(2,'0')).join('')
 captures.push({file,width,url:page.url(),overflow:false,sha256})
}
export async function manifest(name,pageErrors,checks,runtimeOrigin){
 assert.deepEqual(pageErrors,[])
 const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
 const dirty=execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()
 await writeFile(`${output}/${name}.json`,JSON.stringify({sourceCommit,dirty:Boolean(dirty),generatedAt:new Date().toISOString(),runtime:{environment:'emitted local workerd with isolated D1/R2',capabilities:await(await fetch(runtimeOrigin+'/api/auth/capabilities')).json(),providerSends:false,node:process.version},captures,pageErrors,checks},null,2)+'\n')
 console.log(`${captures.length} captures; ${checks.length} checks; commit ${sourceCommit}; dirty=${Boolean(dirty)}`)
}

/** Current moderation opens automatically for held items. Never toggle an open section shut. */
export async function openRequestControls(card) {
 const summary=card.getByText('Discussion, status and request controls',{exact:true})
 const details=card.locator('details').filter({has:card.page().getByText('Discussion, status and request controls',{exact:true})})
 const wasOpen=await details.getAttribute('open')!==null
 if(!wasOpen)await summary.click()
 assert.notEqual(await details.getAttribute('open'),null,'request controls are open')
 console.log('request-controls:',JSON.stringify({width:card.page().viewportSize().width,wasOpen,clicked:!wasOpen}))
}
