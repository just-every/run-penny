import assert from 'node:assert/strict'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {browserOptions} from './browser-options.mjs'
import {startBrowserRuntime} from './base-runtime.mjs'
import {createHostExample} from '../../examples/host-identity/server.mjs'
const output=resolve(process.env.PENNY_EVIDENCE??'../evidence/host-identity-browser'),checks=[]
assert.ok(!output.startsWith(resolve('.')+'/'));await mkdir(output,{recursive:true})
const axe=await readFile(new URL('../../node_modules/axe-core/axe.min.js',import.meta.url),'utf8')
const hostOrigin='http://127.0.0.1:41870',secret='test-only-native-browser-host-signing-key',password='test-only-host-login-password'
let browser
try{
 browser=await chromium.launch(browserOptions())
 for(const width of [1440,390]){
  const runtime=await startBrowserRuntime({bindings:{PORTAL_IDENTITY_SECRET:secret,PORTAL_FRAME_ORIGINS:JSON.stringify([hostOrigin])}})
  const host=createHostExample({appOrigin:runtime.origin,secret,password,user:{email:'host-browser@example.test',displayName:'Host customer',accountId:'private-host-account',accountName:'Private supplied company',revenueCents:99123}})
  let context
  try{
   await new Promise((ready,reject)=>{host.once('error',reject);host.listen(41870,'127.0.0.1',ready)})
   const bootstrap=await fetch(runtime.origin+'/auth/bootstrap',{method:'POST',redirect:'manual',headers:{Origin:runtime.origin,'Content-Type':'application/json'},body:JSON.stringify({token:'synthetic-base-browser-setup-token-12345',displayName:'Owner',returnTo:'/app'})})
   assert.equal(bootstrap.status,303)
   const cookie=bootstrap.headers.get('set-cookie').split(';')[0]
   const board=await fetch(runtime.origin+'/api/operator/boards',{method:'POST',headers:{Origin:runtime.origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({name:'Product feedback',slug:'feedback',visibility:'public'})});assert.equal(board.status,201)
   context=await browser.newContext({viewport:{width,height:width===390?844:900}})
   const page=await context.newPage(),errors=[],external=[]
   page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push({message:message.text(),resource:message.location().url?.split('?')[0]})})
   page.on('request',request=>{if(![runtime.origin,hostOrigin].includes(new URL(request.url()).origin))external.push(new URL(request.url()).origin)})
   assert.equal((await page.goto(hostOrigin)).status(),200)
   await page.getByLabel('Host password').fill(password);await page.getByRole('button',{name:'Sign in to host',exact:true}).click()
   const frame=page.frameLocator('iframe[data-penny]')
   await frame.getByText('Signed in as Host customer',{exact:false}).waitFor()
   await frame.getByLabel('Title',{exact:true}).fill('A host customer problem')
   await frame.getByLabel('Problem description',{exact:true}).fill('Original feedback from the signed host application.')
   await frame.locator('select[name=board]').selectOption('feedback')
   async function capture(label){
    for(const target of [page,page.frames().find(frame=>frame.url().startsWith(runtime.origin))]){
     assert.equal(await target.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth),false,label+' overflow')
     await target.evaluate(axe);assert.deepEqual(await target.evaluate(async()=>(await window.axe.run(document)).violations.filter(row=>['serious','critical'].includes(row.impact))),[],label+' accessibility')
    }
    const text=await frame.locator('body').innerText();for(const value of [secret,password,'Private supplied company','99123','private-host-account'])assert.ok(!text.includes(value))
    await page.screenshot({path:join(output,label+'-'+width+'.png'),fullPage:true});checks.push({width,label})
   }
   await capture('host-signed-in')
   await frame.getByRole('button',{name:'Send for review',exact:true}).click()
   await frame.getByRole('heading',{name:'Feedback is awaiting review',exact:true}).waitFor();await capture('host-submitted')
   await frame.getByRole('link',{name:'Your feedback',exact:true}).last().click()
   await frame.getByText('A host customer problem',{exact:true}).waitFor();await capture('host-activity')
   assert.equal(await runtime.db.prepare('SELECT count(*) n FROM requester_update_permissions').first('n'),0)
   assert.equal(await runtime.db.prepare('SELECT count(*) n FROM native_requester_sessions').first('n'),0)
   assert.equal(await runtime.db.prepare('SELECT count(*) n FROM requesters').first('n'),1)
   assert.equal(await runtime.db.prepare('SELECT revenue_cents FROM accounts').first('revenue_cents'),99123)
   assert.equal(await frame.locator('body').evaluate(()=>localStorage.getItem('penny_requester_session')),null)
   assert.equal((await fetch(runtime.origin+'/app',{redirect:'manual'})).status,401)
   const operatorDocument=await fetch(runtime.origin+'/app',{redirect:'manual',headers:{Accept:'text/html'}});assert.equal(operatorDocument.status,302);assert.equal(operatorDocument.headers.get('Location'),'/signin')
   const signIn=await fetch(runtime.origin+'/signin');assert.equal(signIn.status,200);assert.ok(signIn.headers.get('Content-Security-Policy')?.includes("frame-ancestors 'self'"))
   assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.equal(runtime.outbox.length,0)
  }finally{await context?.close();host.closeAllConnections();await new Promise(done=>host.close(done));await runtime.close()}
 }
 await writeFile(join(output,'results.json'),JSON.stringify({clauses:['REQ-014','REQ-031','BASE-ACCESS-002'],checks,unexpectedErrors:0,externalRequests:0,providerCalls:0,teardown:'fulfilled'},null,2)+'\n')
 console.log('host-identity: '+checks.length+' captures passed')
}finally{await browser?.close()}
