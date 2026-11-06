import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from '/workspace/run-penny/node_modules/@playwright/test/index.mjs'
import {startBrowserRuntime} from '/workspace/run-penny/tests/browser/base-runtime.mjs'
import {browserOptions} from '/workspace/run-penny/tests/browser/browser-options.mjs'
import {finishFirstRun} from '/workspace/run-penny/tests/browser/local-signin.mjs'
import {pacePublicContext} from '/workspace/run-penny/tests/browser/public-entry-pacing.mjs'
import {trackerCreateEdge} from '/workspace/run-penny/tests/browser/integration-tracker-edge.mjs'
import {checkTrackerActions} from '/workspace/run-penny/tests/browser/integration-tracker-actions.mjs'
const output=process.argv[2],edge=await trackerCreateEdge(),captures=[]
await mkdir(output,{recursive:true})
const browser=await chromium.launch(browserOptions()),runtime=await startBrowserRuntime()
let context
try{
 const bootstrap=await fetch(runtime.origin+'/auth/bootstrap',{method:'POST',redirect:'manual',headers:{Origin:runtime.origin,'Content-Type':'application/json'},body:JSON.stringify({token:'synthetic-base-browser-setup-token-12345',displayName:'Owner',returnTo:'/app'})});assert.equal(bootstrap.status,303)
 const cookie=bootstrap.headers.get('set-cookie').split(';')[0],index=cookie.indexOf('='),headers={Origin:runtime.origin,Cookie:cookie,'Content-Type':'application/json'}
 const action=async(path,body)=>{const response=await fetch(runtime.origin+path,{method:'POST',headers,body:JSON.stringify(body)});assert.ok(response.ok,path+' status '+response.status);return response.json()}
 await action('/api/operator/boards',{name:'Product feedback',slug:'feedback',visibility:'public'})
 const subject=await action('/api/operator/requests',{title:'Deliberate tracker subject',description:'Private original wording',boardSlug:'feedback'})
 context=await browser.newContext({viewport:{width:1440,height:900},extraHTTPHeaders:{'CF-Connecting-IP':'192.0.2.42'}})
 await pacePublicContext(context,runtime,'192.0.2.42');await context.addCookies([{name:cookie.slice(0,index),value:cookie.slice(index+1),url:runtime.origin}])
 const page=await context.newPage()
 await page.goto(runtime.origin+'/app/settings');await finishFirstRun(page,async()=>{})
 const capture=async(label,target)=>{await target.screenshot({path:output+'/'+label+'-1440.png',mask:[page.locator('input[type=password]')]});captures.push(label)}
 const restarts=await checkTrackerActions({runtime,page,action,subject,capture,edge,teamId:'461b4065-5ccf-49ae-a432-876d77554e04',organizationId:'462adcc8-15a5-4802-a438-226f1fd930a6',secret:'synthetic-penny-tracker-signing-material-1'})
 await writeFile(output+'/results.json',JSON.stringify({passed:true,width:1440,journey:'checkTrackerActions',providers:['linear','jira'],subjects:['request','decision'],captures,nativeRuntimeRestarts:restarts,fixtureCreates:edge.calls.length,assertions:'queued, sending and rejected new and existing issue refusals; wrong-subject uncertain refusal; rollback; reconciliation; replay; restart and repeated drain',teardown:'fulfilled'},null,2)+'\n')
 console.log('tracker actions: all native assertions passed')
}finally{await context?.close();await runtime.close();await browser.close()}
