import assert from 'node:assert/strict'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {chromium} from '@playwright/test'
import {browserOptions} from './browser-options.mjs'
import {startBrowserRuntime} from './base-runtime.mjs'
import {editorProvider} from './editor-provider.mjs'
import {freshLocalPort} from './fresh-local-port.mjs'
const output=resolve(process.env.PENNY_EVIDENCE??'../evidence/editor-browser'),checks=[]
assert.ok(!output.startsWith(resolve('.')+'/'));await mkdir(output,{recursive:true})
const source=new URL('../../src/visual-edits.json',import.meta.url),original=await readFile(source)
assert.equal(JSON.parse(original).edits.length,0,'This source-edit proof requires the initial unpublished snapshot')
const axe=await readFile(new URL('../../node_modules/axe-core/axe.min.js',import.meta.url),'utf8')
const text='Feedback that informs a clear decision'
let browser,provider,runtime
async function capture(page,label,width){
 for(const frame of page.frames()){
  assert.equal(await frame.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth),false,label+' overflow')
  await frame.evaluate(axe);assert.deepEqual(await frame.evaluate(async()=>(await window.axe.run(document)).violations.filter(row=>['serious','critical'].includes(row.impact))),[],label+' accessibility')
 }
 await page.screenshot({path:join(output,label+'-'+width+'.png'),fullPage:true});checks.push({label,width})
}
try{
 const port=await freshLocalPort()
 provider=await editorProvider({parentOrigin:`http://127.0.0.1:${port}`,persist:async snapshot=>{assert.equal(snapshot.edits[0].change.text,text);await writeFile(source,JSON.stringify(snapshot,null,2)+'\n')}})
 runtime=await startBrowserRuntime({port,bindings:{RER_MANAGEMENT_ORIGIN:provider.origin,RER_INSTALLATION_ID:'native-penny-editor'}})
 const response=await fetch(runtime.origin+'/auth/bootstrap',{method:'POST',redirect:'manual',headers:{Origin:runtime.origin,'Content-Type':'application/json'},body:JSON.stringify({token:'synthetic-base-browser-setup-token-12345',displayName:'Owner',returnTo:'/app'})})
 assert.equal(response.status,303);const [name,value]=response.headers.get('set-cookie').split(';')[0].split('=')
 browser=await chromium.launch(browserOptions())
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900}})
  try{
   const page=await context.newPage(),errors=[],external=[]
   page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())})
   page.on('request',request=>{if(![runtime.origin,provider.origin].includes(new URL(request.url()).origin))external.push(new URL(request.url()).origin)})
   assert.equal((await page.goto(runtime.origin+'/portal/feedback')).status(),200);await page.locator('h1').waitFor();assert.equal(await page.locator('[data-rer-editor]').count(),0)
   const before=provider.state.requests;await context.addCookies([{name,value,url:runtime.origin}]);await page.reload()
   await page.getByRole('button',{name:'Open Run Edit Run',exact:true}).click()
   await page.waitForFunction(()=>document.querySelector('[data-rer-editor]')?.dataset.connection==='connected')
   assert.ok(provider.state.requests>before)
   const frame=page.frameLocator('iframe[title="Run Edit Run editor"]')
   await frame.getByRole('button',{name:'Review public page',exact:true}).click();await frame.getByText('Public page reviewed',{exact:true}).waitFor()
   await frame.getByLabel('Heading text').fill(text);await frame.getByRole('button',{name:'Apply live edit',exact:true}).click()
   await page.getByRole('heading',{name:text,exact:true}).waitFor();await frame.getByText('Live edit applied',{exact:true}).waitFor()
   await capture(page,'native-live-edit',width)
   await frame.getByRole('button',{name:'Save local source',exact:true}).click();await frame.getByText('Saved to local source',{exact:true}).waitFor()
   assert.equal(JSON.parse(await readFile(source,'utf8')).edits[0].change.text,text)
   if(width===390){
    const logout=await fetch(runtime.origin+'/api/auth/sign-out',{method:'POST',headers:{Origin:runtime.origin,Cookie:name+'='+value,'Content-Type':'application/json'},body:'{}'})
    assert.ok(logout.ok);await page.reload();assert.equal(await page.locator('[data-rer-editor]').count(),0)
   }
   assert.deepEqual(errors,[]);assert.deepEqual(external,[])
  }finally{await context.close()}
 }
 await browser.close();browser=null;await runtime.close();runtime=null;await provider.close();provider=null
 const build=await promisify(execFile)('pnpm',['run','build'],{maxBuffer:8*1024*1024});assert.equal(build.stderr.includes('error TS'),false)
 runtime=await startBrowserRuntime();browser=await chromium.launch(browserOptions())
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900}})
  try{
   const page=await context.newPage(),errors=[],external=[];let documents=0
   page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame())documents++;if(new URL(request.url()).origin!==runtime.origin)external.push(new URL(request.url()).origin)})
   assert.equal((await page.goto(runtime.origin+'/portal/feedback')).status(),200);await page.getByRole('heading',{name:text,exact:true}).waitFor();await capture(page,'compiled-public-edit',width)
   assert.equal(await page.locator('[data-rer-editor]').count(),0)
   const count=documents;await page.getByRole('link',{name:'Roadmap',exact:true}).first().click();await page.waitForURL('**/portal/roadmap');await page.goBack();await page.getByRole('heading',{name:text,exact:true}).waitFor();assert.equal(documents,count)
   assert.deepEqual(errors,[]);assert.deepEqual(external,[])
  }finally{await context.close()}
 }
 await writeFile(join(output,'results.json'),JSON.stringify({clauses:['EDIT-001','BASE-ACCESS-004'],checks,sourcePersisted:true,productionReload:true,management:'local network fixture; no hosted publish',unexpectedErrors:0,externalRequests:0,teardown:'fulfilled'},null,2)+'\n')
 console.log('editor: '+checks.length+' captures passed')
}finally{
 await browser?.close();await runtime?.close();await provider?.close();await writeFile(source,original)
}
