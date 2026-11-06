import {chromium} from './run-penny/node_modules/@playwright/test/index.mjs'
import {randomBytes,createHash} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import {startBrowserRuntime} from './run-penny/tests/browser/base-runtime.mjs'
import {browserOptions} from './run-penny/tests/browser/browser-options.mjs'
import {createAudit,viewports} from './run-penny/tests/browser/acceptance-audit.mjs'
const output='/home/agent/rer-consolidation/work/ct-judge-penny-req023-20261105-1430-sol1/evidence/no-mail-functional'
await mkdir(output,{recursive:true})
const runtime=await startBrowserRuntime({https:true,bindings:{PENNY_ENVIRONMENT:'production',MAIL_PROVIDER:'',MAIL_FROM:'',MAIL_API_KEY:''}})
let browser
try{
 const stamp=new Date().toISOString(),token=randomBytes(32).toString('base64url'),hash=createHash('sha256').update(token).digest('hex')
 await runtime.db.batch([
  runtime.db.prepare("INSERT INTO boards(id,slug,name,visibility,position,created_at,updated_at) VALUES('no-mail-board','feedback','Feedback','public',0,?,?)").bind(stamp,stamp),
  runtime.db.prepare("INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES('no-mail-person','Verified requester',?,?)").bind(stamp,stamp),
  runtime.db.prepare("INSERT INTO requester_addresses(id,requester_id,email,verified_at,created_at,updated_at) VALUES('no-mail-address','no-mail-person','verified@example.test',?,?,?)").bind(stamp,stamp,stamp),
  runtime.db.prepare("INSERT INTO native_requester_sessions(id,requester_id,address_id,token_hash,expires_at,last_used_at,created_at,updated_at) VALUES('no-mail-session','no-mail-person','no-mail-address',?,?,?,?,?)").bind(hash,new Date(Date.now()+86400000).toISOString(),stamp,stamp,stamp)
 ])
 browser=await chromium.launch(browserOptions())
 const observations=[]
 for(const viewport of viewports){
  const context=await browser.newContext({viewport,ignoreHTTPSErrors:true}),page=await context.newPage(),{audit,finish}=await createAudit(context,runtime.origin,output,viewport)
  const responses=[]
  page.on('response',r=>{if(new URL(r.url()).pathname.startsWith('/api/public/'))responses.push({path:new URL(r.url()).pathname,status:r.status(),setsCookie:!!r.headers()['set-cookie']})})
  try{
   await page.goto(runtime.origin+'/signin',{waitUntil:'networkidle'})
   const unavailable=await page.getByRole('button',{name:'Sign-in unavailable',exact:true}).isDisabled()
   await audit(page,'manual-no-mail-signin',{axeZero:true})
   await page.getByRole('link',{name:'Back to feedback',exact:true}).click()
   await page.getByRole('heading',{name:'What should we improve?',exact:true}).waitFor()
   await audit(page,'manual-no-mail-public',{axeZero:true})
   await page.goto(runtime.origin+'/portal/feedback/new',{waitUntil:'networkidle'})
   const verificationDisabled=await page.getByRole('button',{name:'Send verification link',exact:true}).isDisabled()
   await audit(page,'manual-no-mail-verification',{axeZero:true})
   await page.evaluate(value=>localStorage.setItem('penny_requester_session',value),token)
   await page.reload({waitUntil:'networkidle'})
   await page.getByLabel('Title',{exact:true}).waitFor()
   const verifiedText=await page.getByText('Verified as Verified requester. Your vote is recorded when you submit.',{exact:true}).innerText()
   const submit=page.getByRole('button',{name:'Send for review',exact:true}),submissionEnabled=await submit.isEnabled()
   await page.getByLabel('Title',{exact:true}).fill(`No mail functional feedback ${viewport.width}`)
   await page.getByLabel('Problem description',{exact:true}).fill('Email transport is not needed to record this verified feedback.')
   await page.locator('select[name=board]').selectOption('feedback')
   await audit(page,'manual-no-mail-verified-form',{axeZero:true})
   await submit.click()
   const outcome=await page.getByRole('heading',{name:'Feedback is awaiting review',exact:true}).innerText()
   await audit(page,'manual-no-mail-submitted',{axeZero:true})
   const outboxStatuses=[]
   for(const path of ['/__dev/outbox','/__dev/outbox?message=anything'])outboxStatuses.push((await context.request.get(runtime.origin+path)).status())
   observations.push({viewport,unavailable,verificationDisabled,verifiedText,submissionEnabled,outcome,cookies:(await context.cookies()).length,outboxStatuses,responses})
   await finish('manual-no-mail-functional',{source:'Exact source; manual continuation of existing no-mail journey using rendered copy; original journey remains FAILED'})
  }finally{await context.close()}
 }
 const counts={}
 for(const table of ['requests','evidence_items','request_votes','requester_update_permissions','notification_events','notification_intents','notification_outbox'])counts[table]=await runtime.db.prepare(`SELECT count(*) n FROM ${table}`).first('n')
 const receipt={source:'f8377876c502bb0c5a99de92f7964c6f30e41c76',kind:'manual functional observations, not a passing original browser test',observations,counts,mailCalls:runtime.outbox.length}
 await writeFile(output+'/FUNCTIONAL-RECEIPT.json',JSON.stringify(receipt,null,2)+'\n')
 console.log(JSON.stringify(receipt,null,2))
}finally{await browser?.close();await runtime.close()}
