import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {resolve} from 'node:path'
import {chromium} from '@playwright/test'
import {startBrowserRuntime} from './base-runtime.mjs'
import {browserOptions} from './browser-options.mjs'

const output=resolve(process.env.PENNY_CLOCK_SHOTS??'../workspace-clock-shots')
await mkdir(output,{recursive:true})
const axe=await readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js'),'utf8')
process.env.PENNY_BROWSER_EXECUTABLE??=chromium.executablePath()
const browser=await chromium.launch(browserOptions())
try{
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  const runtime=await startBrowserRuntime(),context=await browser.newContext({viewport,timezoneId:'America/New_York'})
  const errors=[],external=[]
  context.on('page',page=>{page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});page.on('request',request=>{if(new URL(request.url()).origin!==runtime.origin)external.push(new URL(request.url()).origin)})})
  try{
   const claim=await context.request.post(runtime.origin+'/auth/bootstrap',{headers:{Origin:runtime.origin},data:{token:'synthetic-base-browser-setup-token-12345',displayName:'Maya Chen',returnTo:'/setup'},maxRedirects:0})
   assert.equal(claim.status(),303)
   const page=await context.newPage()
   async function inspect(name,locator){
    await page.evaluate(()=>document.fonts.ready)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' fits the viewport')
    await page.evaluate(axe)
    const violations=await page.evaluate(async()=> (await window.axe.run()).violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id))
    assert.deepEqual(violations,[],name+' is accessible')
    if(locator){await locator.getByRole('heading',{level:2}).evaluate(element=>element.scrollIntoView({block:'start'}));await page.screenshot({path:resolve(output,`${name}-context-${viewport.width}.png`)});await locator.screenshot({path:resolve(output,`${name}-${viewport.width}.png`)})}
    else await page.screenshot({path:resolve(output,`${name}-${viewport.width}.png`),fullPage:true})
   }
   await page.goto(runtime.origin+'/setup',{waitUntil:'networkidle'})
   assert.equal(await page.getByLabel('Workspace timezone',{exact:true}).inputValue(),'America/New_York')
   await page.getByLabel('Company name',{exact:true}).fill('Harbor Analytics')
   await page.getByLabel('Business postal address',{exact:true}).fill('125 High Street, Boston, MA 02110, USA')
   await page.getByRole('checkbox',{name:'I confirm this owner account and business postal address are ready to use.'}).check()
   await page.getByLabel('Workspace timezone',{exact:true}).fill('')
   await page.getByRole('button',{name:'Finish setup',exact:true}).click()
   assert.equal(new URL(page.url()).pathname,'/setup')
   assert.equal(await runtime.db.prepare('SELECT * FROM oa_first_run').first(),null)
   await page.getByLabel('Workspace timezone',{exact:true}).fill('America/New_York')
   await inspect('setup')
   await page.getByRole('button',{name:'Finish setup',exact:true}).click()
   await page.waitForURL(url=>url.pathname.startsWith('/app'))
   await page.waitForLoadState('networkidle')
   assert.equal(await runtime.db.prepare('SELECT timezone FROM penny_workspace_clock').first('timezone'),'America/New_York')
   const evidence=await context.request.post(runtime.origin+'/api/operator/evidence',{headers:{Origin:runtime.origin},data:{sourceType:'interview',wording:'Harbor Analytics needs scheduled CSV exports for the monthly finance review.',observedAt:'2026-10-17T14:00:00-04:00'}})
   assert.equal(evidence.status(),201)
   await page.goto(runtime.origin+'/app/settings#workspace-clock',{waitUntil:'networkidle'})
   const settings=page.getByRole('region',{name:'Workspace time and customer email',exact:true})
   async function saveSettings(){const saved=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/operator/settings/workspace-clock'&&response.request().method()==='PUT');await settings.getByRole('button',{name:'Save workspace time',exact:true}).click();assert.equal((await saved).status(),200)}
   await settings.getByRole('button',{name:'Save workspace time',exact:true}).waitFor()
   await inspect('settings',settings)
   await settings.getByRole('checkbox',{name:'Use requester quiet hours'}).uncheck()
   await settings.getByLabel('Workspace timezone',{exact:true}).fill('Asia/Tokyo')
   await saveSettings()
   await page.reload({waitUntil:'networkidle'})
   assert.equal(await settings.getByLabel('Workspace timezone',{exact:true}).inputValue(),'Asia/Tokyo')
   assert.equal(await settings.getByRole('checkbox',{name:'Use requester quiet hours'}).isChecked(),false)
   await inspect('settings-off',settings)
   await runtime.db.prepare('DELETE FROM penny_workspace_clock').run()
   await page.goto(runtime.origin+'/app/overview',{waitUntil:'networkidle'})
   await page.getByRole('heading',{name:'Confirm your workspace time',exact:true}).waitFor()
   await inspect('legacy-prompt')
   await page.getByRole('link',{name:'Confirm or change the timezone and quiet hours.'}).click()
   await saveSettings()
   await page.getByRole('heading',{name:'Confirm your workspace time',exact:true}).waitFor({state:'hidden'})
   await page.goto(runtime.origin+'/app/overview',{waitUntil:'networkidle'})
   assert.equal(await page.getByRole('heading',{name:'Confirm your workspace time',exact:true}).count(),0)
   await inspect('confirmed')
   const invitation=await context.request.post(runtime.origin+'/api/operator/settings/operators',{headers:{Origin:runtime.origin},data:{email:'clock-admin@example.test'}})
   assert.equal(invitation.status(),202)
   const token=new URL(runtime.outbox.findLast(message=>message.email==='clock-admin@example.test').url).searchParams.get('token')
   const peer=await context.request.post(runtime.origin+'/auth/confirm',{headers:{Origin:runtime.origin},data:{token},maxRedirects:0})
   assert.equal(peer.status(),303)
   await runtime.db.prepare("UPDATE oa_operators SET role='admin' WHERE email='clock-admin@example.test'").run()
   assert.equal((await context.request.post(runtime.origin+'/api/auth/magic-link',{headers:{Origin:runtime.origin},data:{email:'clock-admin@example.test'}})).status(),202)
   const adminToken=new URL(runtime.outbox.findLast(message=>message.email==='clock-admin@example.test').url).searchParams.get('token')
   assert.equal((await context.request.post(runtime.origin+'/auth/confirm',{headers:{Origin:runtime.origin},data:{token:adminToken},maxRedirects:0})).status(),303)
   await page.goto(runtime.origin+'/app/settings#workspace-clock',{waitUntil:'networkidle'})
   await settings.getByLabel('Workspace timezone',{exact:true}).fill('Europe/London')
   await saveSettings()
   await page.reload({waitUntil:'networkidle'})
   assert.equal(await settings.getByLabel('Workspace timezone',{exact:true}).inputValue(),'Europe/London')
   await inspect('admin-settings',settings)
   assert.deepEqual(errors,[])
   assert.deepEqual(external,[])
   console.log(`[OPS-008] setup, persisted quiet-hours off and legacy confirmation passed at ${viewport.width}`)
  }finally{await context.close();await runtime.close()}
 }
}finally{await browser.close()}
