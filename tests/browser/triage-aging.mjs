import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {browserOptions} from './browser-options.mjs'
import {startBrowserRuntime} from './base-runtime.mjs'
import {finishFirstRun} from './local-signin.mjs'
const output=resolve(process.env.PENNY_EVIDENCE??'../evidence/triage-aging')
assert.ok(!output.startsWith(resolve('.')+'/'))
await mkdir(output,{recursive:true})
const axe=await readFile(new URL('../../node_modules/axe-core/axe.min.js',import.meta.url),'utf8')
process.env.PENNY_BROWSER_EXECUTABLE??=chromium.executablePath()
const browser=await chromium.launch(browserOptions())
try{
 for(const width of [1440,390]){
  const runtime=await startBrowserRuntime();let context
  try{
   const {origin}=runtime,errors=[]
   async function send(path,body,cookie,method=body===undefined?'GET':'POST',expected=200,extra={}){
    const r=await fetch(origin+path,{method,redirect:'manual',headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})})
    assert.equal(r.status,expected,`${method} ${path}`);return r
   }
   const json=async(...args)=>(await send(...args)).json()
   const bootstrap=await send('/auth/bootstrap',{token:'synthetic-base-browser-setup-token-12345',displayName:'Maya Patel',returnTo:'/app'},null,'POST',303),cookie=bootstrap.headers.get('set-cookie').split(';')[0]
   context=await browser.newContext({viewport:{width,height:width===390?844:900},timezoneId:'Australia/Brisbane'})
   const split=cookie.indexOf('=');await context.addCookies([{name:cookie.slice(0,split),value:cookie.slice(split+1),url:origin}])
   const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message))
   async function audit(target,label,region){
    assert.equal(await target.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth),false,`${label} fits ${width}`)
    await target.evaluate(axe);assert.deepEqual(await target.evaluate(async()=> (await window.axe.run(document)).violations.filter(v=>['serious','critical'].includes(v.impact))),[],`${label} accessible`)
    await target.screenshot({path:join(output,`${label}-${width}.png`),fullPage:true})
    if(region&&typeof region.screenshot==='function')await region.screenshot({path:join(output,`${label}-detail-${width}.png`)})
   }
   await page.goto(origin+'/setup');await finishFirstRun(page,audit)
   await json('/api/operator/boards',{slug:'finance',name:'Finance workflows',visibility:'public'},cookie,'POST',201)
   const self=(await json('/api/operator/ownership/catalog',undefined,cookie)).operators[0]
   await json('/api/operator/ownership/boards/finance',{operatorId:self.id},cookie,'PATCH')
   const request=await json('/api/operator/requests',{title:'Schedule monthly finance exports',description:'Harbor Analytics needs a CSV before each monthly finance review.',boardSlug:'finance'},cookie,'POST',201)
   await json(`/api/operator/moderation/${request.slug}`,{verdict:'approved',title:'Schedule monthly finance exports',description:'Deliver a monthly CSV for the finance review.',boardSlug:'finance',displayName:'Maya'},cookie)
   await json(`/api/operator/requests/${request.slug}/status-updates`,{status:'planned',publicEta:'2027-Q1'},cookie)
   const unanswered=await json('/api/operator/requests',{title:'Use local currencies in billing reports',description:'Finance needs a currency column for international invoices.',boardSlug:'finance'},cookie,'POST',201)
   await json(`/api/operator/moderation/${unanswered.slug}`,{verdict:'approved',title:'Use local currencies in billing reports',description:'Show the original invoice currency in billing exports.',boardSlug:'finance',displayName:'Maya'},cookie)
   const evidence=await json('/api/operator/evidence',{sourceType:'interview',wording:'Harbor Analytics still rebuilds its monthly finance report by hand. Maya will confirm the required CSV columns.',observedAt:'2026-10-01T10:00:00Z',boardSlug:'finance'},cookie,'POST',201)
   await send('/api/public/identity/email',{email:'finance-lead@example.test',displayName:'Eli Wong'},null,'POST',202)
   const link=runtime.outbox.findLast(m=>m.email==='finance-lead@example.test').url,token=new URLSearchParams(new URL(link).hash.slice(1)).get('token')
   const identity=await json('/api/public/identity/email/verify',{token},null),authorization={Authorization:`Bearer ${identity.token}`}
   const comment=await json(`/api/public/requests/${request.slug}/comments`,{body:'Can the finance team try an export before the next month-end?'},null,'POST',201,authorization)
   const old=new Date(Date.now()-32*86400000).toISOString()
   await runtime.db.batch([runtime.db.prepare('UPDATE evidence_items SET created_at=? WHERE id=?').bind(old,evidence.id),runtime.db.prepare('UPDATE requests SET published_at=? WHERE id=?').bind(old,unanswered.id),runtime.db.prepare('UPDATE request_comments SET created_at=? WHERE id=?').bind(old,comment.id),runtime.db.prepare('UPDATE penny_triage_status_clock SET since_at=? WHERE request_id=?').bind(old,request.id)])
   await runtime.schedule();await runtime.restart();await runtime.schedule()
   const summary=await json('/api/operator/triage',undefined,cookie)
   assert.deepEqual(summary.counts,{inbox:1,comment:1,response:1,stale:1})
   assert.equal(summary.reminders.length,4)
   await page.goto(origin+'/app/overview')
   const follow=page.getByRole('region',{name:'Aging and follow-up',exact:true})
   await follow.getByRole('heading',{name:'Stale status (1)',exact:true}).waitFor()
   await audit(page,'overview-aging',follow)
   await follow.getByRole('link',{name:'Stale status (1)',exact:true}).click()
   await follow.getByRole('region',{name:'Stale status',exact:true}).getByRole('link',{name:'Schedule monthly finance exports',exact:true}).click()
   const stale=page.getByRole('region',{name:'Stale requests',exact:true})
   await stale.getByRole('heading',{name:'Stale status (1)',exact:true}).waitFor()
   await audit(page,'request-queue-stale',stale)
   await page.goto(origin+'/app/settings')
   const settings=page.locator('details').filter({has:page.getByText('Aging and reminder settings',{exact:true})})
   // The settings resource mounts its form after client hydration. Opening the
   // server-rendered disclosure earlier can be reset when React takes over.
   await settings.locator('form').waitFor({state:'attached'})
   await settings.locator('summary').click()
   await settings.getByLabel('Planned stale (days)',{exact:true}).fill('14')
   await settings.getByRole('button',{name:'Save follow-up ages',exact:true}).click()
   await settings.getByRole('status').filter({hasText:'Follow-up ages saved.'}).waitFor()
   await audit(page,'follow-up-settings',settings)
   await page.goto(origin+`/app/feedback?item=${evidence.id}`)
   const card=page.locator(`#evidence-${evidence.id}`)
   await card.getByText('Snooze evidence',{exact:true}).click()
   const tomorrow=new Date(Date.now()+86400000),parts=new Intl.DateTimeFormat('sv-SE',{timeZone:'Australia/Brisbane',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(tomorrow).replace(' ','T')
   await card.getByLabel('Return to inbox on',{exact:true}).fill(parts)
   await card.getByRole('button',{name:'Save snooze',exact:true}).click()
   await card.getByRole('status').filter({hasText:'Evidence snoozed.'}).waitFor()
   await audit(page,'evidence-snooze',card)
   await page.goto(origin+'/app/overview')
   const snoozed=page.getByRole('region',{name:'Snoozed evidence',exact:true})
   await snoozed.getByRole('heading',{name:'Snoozed evidence (1)',exact:true}).waitFor()
   await audit(page,'snoozed-until-date',snoozed)
   await snoozed.getByRole('button',{name:'Return to inbox now',exact:true}).click()
   await follow.getByRole('heading',{name:'Untriaged inbox (1)',exact:true}).waitFor()
   await json(`/api/operator/requests/${request.slug}/status-updates`,{status:'in_progress'},cookie)
   await follow.getByRole('button',{name:'Refresh follow-up',exact:true}).click()
   await follow.getByRole('heading',{name:/^Stale status/}).waitFor({state:'detached'})
   await audit(page,'status-change-clears-stale',follow)
   assert.deepEqual(errors,[])
  }finally{await context?.close();await runtime.close()}
 }
}finally{await browser.close()}
