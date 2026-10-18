import assert from 'node:assert/strict'
import { mkdir,readFile } from 'node:fs/promises'
import { resolve,join } from 'node:path'
import { chromium } from '@playwright/test'
import { browserOptions } from './browser-options.mjs'
import { startBrowserRuntime } from './base-runtime.mjs'
import { finishFirstRun } from './local-signin.mjs'
const output=resolve(process.env.PENNY_EVIDENCE??'../evidence/internal-discussion')
assert.ok(!output.startsWith(resolve('.')+'/'))
await mkdir(output,{recursive:true})
const axe=await readFile(new URL('../../node_modules/axe-core/axe.min.js',import.meta.url),'utf8')
process.env.PENNY_BROWSER_EXECUTABLE??=chromium.executablePath()
let browser
try{
 browser=await chromium.launch(browserOptions())
 for(const width of [1440,390]){
  const runtime=await startBrowserRuntime();let context
  try{
   const {origin}=runtime
   async function send(path,body,cookie,expected=200){const response=await fetch(origin+path,{method:body===undefined?'GET':'POST',redirect:'manual',headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});assert.equal(response.status,expected,path);return response}
   const bootstrap=await send('/auth/bootstrap',{token:'synthetic-base-browser-setup-token-12345',displayName:'Owner',returnTo:'/app'},null,303)
   const cookie=bootstrap.headers.get('set-cookie').split(';')[0]
   context=await browser.newContext({viewport:{width,height:900}})
   const split=cookie.indexOf('=');await context.addCookies([{name:cookie.slice(0,split),value:cookie.slice(split+1),url:origin}])
   const page=await context.newPage();page.setDefaultTimeout(15000)
   page.on('response',response=>{if(response.url().includes('/api/operator/discussion')&&!response.ok())console.log(new URL(response.url()).pathname,response.status())})
   async function audit(target,label){assert.equal(await target.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await target.evaluate(axe);assert.deepEqual(await target.evaluate(async()=> (await window.axe.run(document)).violations.filter(row=>['serious','critical'].includes(row.impact))),[]);await target.screenshot({path:join(output,`${label}-${width}.png`),fullPage:true});if(label==='threaded-internal-notes')await target.getByRole('region',{name:'Internal notes',exact:true}).screenshot({path:join(output,`notes-detail-${width}.png`)});if(label==='durable-mention')await target.getByRole('region',{name:'Your mentions',exact:true}).screenshot({path:join(output,`mentions-detail-${width}.png`)})}
   await page.goto(origin+'/setup');await finishFirstRun(page,audit)
   await send('/api/operator/boards',{slug:'discussion',name:'Discussion',visibility:'public'},cookie,201)
   const request=await (await send('/api/operator/requests',{title:'Schedule monthly finance exports',description:'Finance needs a CSV before its monthly review.',boardSlug:'discussion'},cookie,201)).json()
   const operators=await (await send('/api/operator/discussion/operators',undefined,cookie)).json()
   await page.goto(origin+`/app/moderation?item=${request.id}`)
   const notes=page.getByRole('region',{name:'Internal notes',exact:true})
   await notes.getByLabel('Add an internal note',{exact:true}).fill('Please confirm whether finance needs scheduled exports or an on-demand download.')
   await notes.getByRole('checkbox',{name:'@'+operators.operators[0].displayName,exact:true}).check()
   await notes.getByRole('button',{name:'Save note',exact:true}).click()
   try{await notes.getByText('Please confirm whether finance needs scheduled exports or an on-demand download.',{exact:true}).waitFor()}catch(error){await page.screenshot({path:join(output,`failure-${width}.png`),fullPage:true});throw error}
   await notes.getByRole('button',{name:'Reply',exact:true}).click()
   await notes.getByLabel('Internal reply',{exact:true}).fill('Maya confirmed a scheduled monthly CSV would remove the manual reporting step.')
   await notes.getByRole('button',{name:'Save note',exact:true}).click()
   await notes.getByText('Maya confirmed a scheduled monthly CSV would remove the manual reporting step.',{exact:true}).waitFor()
   await audit(page,'threaded-internal-notes')
   await page.reload()
   const mentions=page.getByRole('region',{name:'Your mentions',exact:true})
   await mentions.getByText('Please confirm whether finance needs scheduled exports or an on-demand download.',{exact:true}).waitFor()
   assert.equal(await mentions.getByRole('button',{name:'Dismiss mention',exact:true}).count(),1)
   await audit(page,'durable-mention')
   await mentions.getByRole('button',{name:'Dismiss mention',exact:true}).click()
   await mentions.getByText('No new mentions.',{exact:true}).waitFor()
   await page.reload();await mentions.getByText('No new mentions.',{exact:true}).waitFor()
  }finally{await context?.close();await runtime.close()}
 }
}finally{await browser?.close()}
