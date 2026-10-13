import { browserOptions } from './browser-options.mjs'
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { createHash, randomBytes } from 'node:crypto'
import { startBrowserRuntime } from './base-runtime.mjs'
import { createAudit, evidenceDirectory, viewports } from './acceptance-audit.mjs'
const output=evidenceDirectory('no-mail')
const runtime=await startBrowserRuntime({https:true,bindings:{PENNY_ENVIRONMENT:'production',MAIL_PROVIDER:'',MAIL_FROM:'',SENDGRID_API_KEY:''}})
let browser
try {
 browser=await chromium.launch(browserOptions())
 const stamp=new Date().toISOString(),token=randomBytes(32).toString('base64url'),hash=createHash('sha256').update(token).digest('hex')
 await runtime.db.batch([
  runtime.db.prepare("INSERT INTO boards(id,slug,name,visibility,position,created_at,updated_at) VALUES('no-mail-board','feedback','Feedback','public',0,?,?)").bind(stamp,stamp),
  runtime.db.prepare("INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES('no-mail-person','Verified requester',?,?)").bind(stamp,stamp),
  runtime.db.prepare("INSERT INTO requester_addresses(id,requester_id,email,verified_at,created_at,updated_at) VALUES('no-mail-address','no-mail-person','verified@example.test',?,?,?)").bind(stamp,stamp,stamp),
  runtime.db.prepare("INSERT INTO native_requester_sessions(id,requester_id,address_id,token_hash,expires_at,last_used_at,created_at,updated_at) VALUES('no-mail-session','no-mail-person','no-mail-address',?,?,?,?,?)").bind(hash,new Date(Date.now()+86400000).toISOString(),stamp,stamp,stamp),
 ])
 for(const viewport of viewports){
  const context=await browser.newContext({viewport,ignoreHTTPSErrors:true}),{audit,finish}=await createAudit(context,runtime.origin,output,viewport),page=await context.newPage()
  try{
   await page.goto(runtime.origin+'/signin',{waitUntil:'networkidle'})
   await page.getByText('Operator sign-in is temporarily unavailable because email links cannot be sent.',{exact:true}).waitFor()
   assert.equal(await page.getByRole('button',{name:'Sign-in unavailable',exact:true}).isDisabled(),true)
   assert.equal(await page.getByLabel('Operator email',{exact:true}).isEnabled(),true)
   await audit(page,'G.3-no-mail-signin',{axeZero:true})
   await page.getByRole('link',{name:'Back to feedback',exact:true}).click()
   await page.waitForURL(url=>url.pathname==='/portal/feedback')
   await page.getByRole('heading',{name:'What should we improve?',exact:true}).waitFor()
   await audit(page,'G.3-no-mail-public-reading',{axeZero:true})
   await page.goto(runtime.origin+'/portal/feedback/new',{waitUntil:'networkidle'})
   await page.getByText('Email verification is temporarily unavailable. You can browse published feedback; new visitors need verification before submitting.',{exact:true}).waitFor()
   assert.equal(await page.getByRole('button',{name:'Send verification link',exact:true}).isDisabled(),true)
   assert.equal(await page.getByLabel('Email',{exact:true}).isEnabled(),true)
   await audit(page,'G.3-no-mail-verification',{axeZero:true})
   await page.evaluate(value=>localStorage.setItem('penny_requester_session',value),token)
   await page.reload({waitUntil:'networkidle'})
   await page.getByText('Verified as Verified requester. Submission grants no email update permission.',{exact:true}).waitFor()
   const submit=page.getByRole('button',{name:'Send for review',exact:true})
   assert.equal(await submit.isEnabled(),true,'[G.3 REQ-003] verified session retains submission')
   await page.getByLabel('Title',{exact:true}).fill(`No mail feedback ${viewport.width}`)
   await page.getByLabel('Problem description',{exact:true}).fill('Email transport is not needed to record this verified feedback.')
   await page.locator('select[name=board]').selectOption('feedback')
   await audit(page,'G.3-no-mail-verified-form',{axeZero:true})
   await submit.click();await page.getByRole('heading',{name:'Feedback is awaiting review',exact:true}).waitFor()
   await audit(page,'G.3-no-mail-submitted',{axeZero:true})
   for(const path of ['/__dev/outbox','/__dev/outbox?message=anything'])assert.equal((await context.request.get(runtime.origin+path)).status(),404)
   await finish('G.3-no-mail',{clauses:['BASE-SECRET-002','REQ-003','REQ-023'],mode:'Emitted production Worker with no provider; actual D1 verified-session test fixture'})
  }finally{await context.close()}
 }
 console.log('[G.3] No-provider pages and verified submissions passed at both widths.')
}finally{await browser?.close();await runtime.close()}
