import assert from 'node:assert/strict'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {browserOptions} from './browser-options.mjs'
import {startBrowserRuntime} from './base-runtime.mjs'
import {createHostExample} from '../../examples/host-identity/server.mjs'
import {explicitConsentBoard} from './explicit-consent-board.mjs'
const output=resolve(process.env.PENNY_EVIDENCE??'../evidence/host-identity-browser'),checks=[]
assert.ok(!output.startsWith(resolve('.')+'/'));await mkdir(output,{recursive:true})
const axe=await readFile(new URL('../../node_modules/axe-core/axe.min.js',import.meta.url),'utf8')
const hostOrigin='http://127.0.0.1:41870',secret='test-only-native-browser-host-signing-key',password='test-only-host-login-password'
let browser
try{
 browser=await chromium.launch(browserOptions())
 for(const width of [1440,390]){
  const runtime=await startBrowserRuntime({bindings:{PORTAL_IDENTITY_SECRET:secret}})
  const user={email:['synthetic-penny-host','example.test'].join('@'),displayName:'Host customer',accountId:'private-host-account',accountName:'Private supplied company',revenueCents:99123}
  const hostConfig={appOrigin:runtime.origin,secret,password,user,now:new Date()}
  const host=createHostExample(hostConfig)
  let context
  try{
   await new Promise((ready,reject)=>{host.once('error',reject);host.listen(41870,'127.0.0.1',ready)})
   const bootstrap=await fetch(runtime.origin+'/auth/bootstrap',{method:'POST',redirect:'manual',headers:{Origin:runtime.origin,'Content-Type':'application/json'},body:JSON.stringify({token:'synthetic-base-browser-setup-token-12345',displayName:'Owner',returnTo:'/app'})})
   assert.equal(bootstrap.status,303)
   const cookie=bootstrap.headers.get('set-cookie').split(';')[0]
   const frames=await fetch(runtime.origin+'/api/operator/settings/frames',{method:'PUT',headers:{Origin:runtime.origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({publicOriginAllowlist:[hostOrigin]})})
   assert.equal(frames.status,200)
   assert.deepEqual(await frames.json(),{publicOriginAllowlist:[hostOrigin]})
   const board=await fetch(runtime.origin+'/api/operator/boards',{method:'POST',headers:{Origin:runtime.origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({name:'Product feedback',slug:'feedback',visibility:'public'})});assert.equal(board.status,201)
   await explicitConsentBoard(runtime.origin,'feedback',cookie)
   context=await browser.newContext({viewport:{width,height:width===390?844:900}})
   const page=await context.newPage(),errors=[],external=[],expectedErrors=[]
   page.setDefaultTimeout(15000)
   let expectHostRefusal=false
   page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push({message:message.text(),resource:message.location().url?.split('?')[0]})})
   page.on('response',response=>{if(expectHostRefusal&&response.status()===401&&response.url()===runtime.origin+'/api/public/identity/host')expectedErrors.push({message:'Failed to load resource: the server responded with a status of 401 (Unauthorized)',resource:response.url()})})
   page.on('request',request=>{if(![runtime.origin,hostOrigin].includes(new URL(request.url()).origin))external.push(new URL(request.url()).origin)})
   assert.equal((await page.goto(hostOrigin)).status(),200)
   await page.getByLabel('Host password').fill(password);await page.getByRole('button',{name:'Sign in to host',exact:true}).click()
   const frame=page.frameLocator('iframe[data-penny]')
   await frame.getByText('Signed in as Host customer',{exact:false}).last().waitFor()
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
   async function exchange(){
    const response=page.waitForResponse(response=>response.url()===runtime.origin+'/api/public/identity/host'&&response.request().method()==='POST',{timeout:15000})
    await page.evaluate(async origin=>{
     const response=await fetch('/identity',{credentials:'same-origin',cache:'no-store'})
     if(!response.ok)throw new Error('Fixture host identity unavailable')
     document.querySelector('iframe[data-penny]').contentWindow.postMessage({type:'penny-host-identity',version:1,...await response.json()},origin)
    },runtime.origin)
    return response
   }
   async function snapshot(){
    // Admission bookkeeping may change on reads; identity and product custody may not.
    const names=(await runtime.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT IN ('d1_migrations','penny_public_admission') ORDER BY name").all()).results
    return (await runtime.db.batch(names.map(({name})=>runtime.db.prepare('SELECT * FROM "'+name+'" ORDER BY rowid')))).map(result=>result.results)
   }
   const refusals=[{label:'expired',offset:-25*3600000},{label:'future-dated',offset:10*60000},{label:'wrong-signature',offset:0,key:'synthetic-penny-wrong-signing-material'}]
   // Functional refusal cases run at desktop width; the phone records the fallback screen.
   for(const [index,refusal] of (width===1440?refusals:refusals.slice(0,1)).entries()){
    console.log('host-identity: '+width+' '+refusal.label+' establishing identity')
    if(index>0)hostConfig.now=new Date()
    hostConfig.secret=secret;hostConfig.user=user
    expectHostRefusal=false
    assert.equal((await exchange()).status(),200)
    await frame.getByText('Signed in as Host customer',{exact:false}).last().waitFor()
    if(new URL(page.frames().find(frame=>frame.url().startsWith(runtime.origin)).url()).pathname!=='/portal/feedback/activity'){
     const granted=page.waitForResponse(response=>response.url()===runtime.origin+'/api/public/identity/host'&&response.status()===200,{timeout:15000})
     await frame.locator('a[href="/portal/feedback/activity"]').first().click()
     await granted
    }
    await frame.getByText('A host customer problem',{exact:true}).waitFor()
    const before=await snapshot()
    console.log('host-identity: '+width+' '+refusal.label+' rejecting identity')
    hostConfig.now=new Date(Date.now()+refusal.offset);hostConfig.secret=refusal.key??secret
    hostConfig.user={...user,email:['synthetic-penny-rejected-'+index,'example.test'].join('@'),displayName:'Rejected host claim'}
    expectHostRefusal=true
    const rejected=await exchange()
    assert.equal(rejected.status(),401,refusal.label)
    console.log('host-identity: '+width+' '+refusal.label+' checking fallback')
    await frame.getByRole('alert').filter({hasText:'Host sign-in could not be confirmed'}).waitFor()
    await frame.getByRole('link',{name:'Verify your email',exact:true}).waitFor()
    assert.equal(await frame.getByText('Signed in as Host customer',{exact:false}).count(),0)
    assert.equal(await frame.getByText('A host customer problem',{exact:true}).count(),0)
    assert.equal(await frame.getByText('Rejected host claim',{exact:false}).count(),0)
    await frame.getByRole('link',{name:'Email verification',exact:true}).click()
    await frame.getByRole('heading',{name:'Verify your email first',exact:true}).waitFor()
    await frame.getByRole('alert').filter({hasText:'Host sign-in could not be confirmed'}).waitFor()
    await frame.getByLabel('Display name',{exact:true}).fill('Email fallback customer')
    await frame.getByLabel('Email',{exact:true}).fill(['synthetic-penny-fallback','example.test'].join('@'))
    assert.equal(await frame.getByRole('button',{name:'Send verification link',exact:true}).isEnabled(),true)
    assert.equal(await frame.getByLabel('Title',{exact:true}).count(),0)
    assert.equal(await frame.locator('body').evaluate(()=>localStorage.getItem('penny_requester_session')),null)
    assert.deepEqual(await snapshot(),before,refusal.label+' has no identity, permission, mail or product writes')
    assert.equal(runtime.outbox.length,0,refusal.label+' sends no mail without an explicit email request')
    if(index===0)await capture('host-email-fallback')
    checks.push({width,label:refusal.label,exchange:401,fallback:'email form',identity:'cleared',writes:0,mail:0})
   }
   assert.deepEqual(errors,expectedErrors);assert.deepEqual(external,[]);assert.equal(runtime.outbox.length,0)
  }catch(error){console.error(error);throw error}finally{await context?.close();host.closeAllConnections();await new Promise(done=>host.close(done));await runtime.close()}
 }
 await writeFile(join(output,'results.json'),JSON.stringify({clauses:['REQ-014','REQ-031','BASE-ACCESS-002'],checks,unexpectedErrors:0,externalRequests:0,providerCalls:0,teardown:'fulfilled'},null,2)+'\n')
 console.log('host-identity: '+checks.length+' checks passed')
}finally{await browser?.close()}
