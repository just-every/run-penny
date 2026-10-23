import assert from 'node:assert/strict'

/** Native requester verification and settings; only runtime.outbox's mail edge is a fixture. */
export async function weeklySummaryChoice({browser,owner,runtime,viewport,inspect}) {
 const {origin}=runtime,setting=owner.getByRole('region',{name:'Weekly requester summary',exact:true})
 const ownerChoice=setting.getByRole('checkbox',{name:'Enable weekly requester summaries',exact:true})
 await owner.goto(origin+'/app/settings#weekly-summary',{waitUntil:'networkidle'})
 await setting.getByRole('button',{name:'Save weekly summary setting',exact:true}).waitFor()
 assert.equal(await ownerChoice.isChecked(),false,'weekly summaries start off')
 await inspect('weekly-owner-off',setting)
 async function enable(value) {
  await ownerChoice.setChecked(value)
  const saved=owner.waitForResponse(response=>new URL(response.url()).pathname==='/api/operator/settings/weekly-summary'&&response.request().method()==='PUT')
  await setting.getByRole('button',{name:'Save weekly summary setting',exact:true}).click()
  assert.equal((await saved).status(),200)
  await setting.getByRole('status').filter({hasText:'setting saved'}).waitFor()
 }
 const context=await browser.newContext({viewport,extraHTTPHeaders:{'CF-Connecting-IP':'198.51.100.76'}}),errors=[]
 context.on('page',page=>{
  page.on('pageerror',error=>errors.push(error.message))
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text())})
  page.on('request',request=>{if(/^https?:/.test(request.url())&&new URL(request.url()).origin!==origin)errors.push('External browser request')})
 })
 try {
  const page=await context.newPage(),email='weekly-reader@example.test'
  // Portal appearance is fetched by the mounted layout effect, so it proves
  // client attachment before interacting with the server-rendered auth form.
  async function authDocument(url) {
   const ready=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/public/branding'&&response.request().method()==='GET')
   await page.goto(url,{waitUntil:'networkidle'})
   assert.equal((await ready).status(),200)
  }
  await authDocument(origin+'/portal/feedback/new')
  await page.getByLabel('Display name',{exact:true}).fill('Jordan Rivera')
  await page.getByLabel('Email',{exact:true}).fill(email)
  const requested=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/public/identity/email'&&response.request().method()==='POST')
  await page.getByRole('button',{name:'Send verification link',exact:true}).click()
  assert.equal((await requested).status(),202)
  await page.getByText('Check your email for a verification link; it expires after 30 minutes.',{exact:true}).waitFor()
  const verification=runtime.outbox.findLast(message=>message.email===email)?.url
  assert.ok(verification,'the mail-edge fixture receives the native verification link')
  await authDocument(verification)
  await page.getByRole('button',{name:'Verify email',exact:true}).click()
  await page.getByText('Email verified.',{exact:true}).waitFor()
  const region=()=>page.getByRole('region',{name:'Weekly summary',exact:true})
  const choice=()=>region().getByRole('checkbox',{name:'Email me a weekly summary',exact:true})
  async function toggle(value) {
   const saved=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/public/requester/weekly-summary'&&response.request().method()==='PATCH')
   await choice().setChecked(value)
   const response=await saved
   assert.equal(response.status(),200)
   assert.equal((await response.json()).subscribed,value)
   await region().getByRole('status').filter({hasText:value?'enabled.':'stopped.'}).waitFor()
  }
  await page.goto(origin+'/portal/feedback/activity',{waitUntil:'networkidle'})
  await choice().waitFor()
  assert.equal(await choice().isChecked(),false)
  assert.equal(await choice().isDisabled(),true,'owner-off prevents opting in')
  await inspect('weekly-activity-unavailable',region(),page)
  await enable(true)
  await owner.reload({waitUntil:'networkidle'})
  assert.equal(await ownerChoice.isChecked(),true,'owner setting persists')
  await inspect('weekly-owner-on',setting)
  await page.reload({waitUntil:'networkidle'})
  await choice().waitFor()
  await toggle(true)
  await inspect('weekly-activity-opted-in',region(),page)
  await page.getByRole('link',{name:'Updates',exact:true}).click()
  await page.getByRole('heading',{name:'Product updates',exact:true}).waitFor()
  await choice().waitFor()
  assert.equal(await choice().isChecked(),true,'the same choice appears on updates')
  await page.reload({waitUntil:'networkidle'})
  await choice().waitFor()
  assert.equal(await choice().isChecked(),true,'requester choice survives reload')
  await inspect('weekly-updates-opted-in',region(),page)
  await enable(false)
  await page.reload({waitUntil:'networkidle'})
  await choice().waitFor()
  assert.equal(await choice().isChecked(),true)
  assert.equal(await choice().isDisabled(),false,'owner-off still permits opting out')
  await toggle(false)
  assert.equal(await choice().isDisabled(),true)
  await inspect('weekly-updates-opted-out',region(),page)
  await page.getByRole('link',{name:'Your feedback',exact:true}).click()
  await page.getByRole('heading',{name:'Your feedback',exact:true}).waitFor()
  await choice().waitFor()
  assert.equal(await choice().isChecked(),false,'updates opt-out is reflected on activity')
  await inspect('weekly-activity-opted-out',region(),page)
  assert.deepEqual(errors,[],'weekly choice has no browser errors or external requests')
  assert.deepEqual(await context.cookies(),[],'requester verification remains cookie-free')
  console.log(`[NOTIFY-010] native owner setting, requester choice and owner-off opt-out passed at ${viewport.width}`)
 } finally {await context.close()}
}
