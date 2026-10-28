import assert from 'node:assert/strict'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {browserOptions} from './browser-options.mjs'
import {startBrowserRuntime} from './base-runtime.mjs'
const output=resolve(process.env.PENNY_EVIDENCE??'../evidence/api-browser'),checks=[]
assert.ok(!output.startsWith(resolve('.')+'/'));await mkdir(output,{recursive:true})
const axe=await readFile(new URL('../../node_modules/axe-core/axe.min.js',import.meta.url),'utf8')
let browser
try{
 browser=await chromium.launch(browserOptions())
 // Cloud behavioral assertions use one width; the candidate proof covers both.
 for(const width of [1440]){
  const runtime=await startBrowserRuntime();let context
  try{
   const bootstrap=await fetch(runtime.origin+'/auth/bootstrap',{method:'POST',redirect:'manual',headers:{Origin:runtime.origin,'Content-Type':'application/json'},body:JSON.stringify({token:'synthetic-base-browser-setup-token-12345',displayName:'Owner',returnTo:'/app'})});assert.equal(bootstrap.status,303)
   const [name,value]=bootstrap.headers.get('set-cookie').split(';')[0].split('=')
   const setup=await fetch(runtime.origin+'/setup',{method:'POST',redirect:'manual',headers:{Origin:runtime.origin,Cookie:`${name}=${value}`,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({confirm:'yes',companyName:'Harbor Analytics',postalAddress:'14 Market Street',timezone:'UTC',quietStart:'22',quietEnd:'8'})});assert.equal(setup.status,303)
   context=await browser.newContext({viewport:{width,height:width===390?844:900}});await context.addCookies([{name,value,url:runtime.origin}])
   const page=await context.newPage(),errors=[],external=[]
   page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())})
   page.on('request',request=>{if(new URL(request.url()).origin!==runtime.origin)external.push(new URL(request.url()).origin)})
   assert.equal((await page.goto(runtime.origin+'/app/settings')).status(),200)
   await page.getByLabel('Key name',{exact:true}).fill('Server public reads')
   await page.getByLabel('requests:read',{exact:true}).check()
   await page.getByRole('button',{name:'Create API key',exact:true}).click()
   const input=page.getByLabel('New key',{exact:true});await input.waitFor();assert.equal(await input.getAttribute('type'),'password')
   const token=await input.inputValue();assert.ok(/^int_[a-f0-9]{64}$/.test(token))
   async function capture(label){
    assert.equal(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth),false)
    assert.ok(!(await page.locator('body').innerText()).includes(token))
    await page.evaluate(axe);assert.deepEqual(await page.evaluate(async()=>(await window.axe.run(document)).violations.filter(row=>['serious','critical'].includes(row.impact))),[])
    await page.screenshot({path:join(output,label+'-'+width+'.png'),fullPage:true,mask:[input]});checks.push({label,width})
   }
   await capture('created-masked-key')
   const request=(path,body)=>fetch(runtime.origin+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{Origin:runtime.origin,'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})
   const policy=await fetch(runtime.origin+'/agents/api/policy',{method:'PUT',headers:{Origin:runtime.origin,Cookie:`${name}=${value}`,'Content-Type':'application/json'},body:JSON.stringify({document:{schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',rules:[{id:'client-journey',class:'*',do:'autonomous'}],spend:{none:true}}})});assert.equal(policy.status,200)
   assert.equal((await request('/api/v1/requests')).status,200)
   assert.equal((await request('/api/v1/requests',{title:'Denied write',description:'Body',boardSlug:'feedback'})).status,401)
   assert.equal((await request('/api/operator/data/export')).status,401)
   await page.getByRole('button',{name:'I saved the key',exact:true}).click();assert.equal(await input.count(),0)
   await page.reload();assert.equal(await input.count(),0)
   await page.getByRole('button',{name:'Revoke Server public reads',exact:true}).click()
   await page.getByText('Key revoked.',{exact:true}).waitFor();await capture('revoked-key')
   assert.equal((await request('/api/v1/requests')).status,401)
   assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.equal(runtime.outbox.length,0)
  }finally{await context?.close();await runtime.close()}
 }
 await writeFile(join(output,'results.json'),JSON.stringify({clauses:['API-001','API-002','BASE-ACCESS-002'],checks,keysMasked:true,unexpectedErrors:0,externalRequests:0,providerCalls:0,teardown:'fulfilled'},null,2)+'\n')
 console.log('integration-api: '+checks.length+' captures passed')
}finally{await browser?.close()}
