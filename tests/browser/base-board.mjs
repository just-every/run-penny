import { browserOptions } from './browser-options.mjs'
import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { startBrowserRuntime } from './base-runtime.mjs'
import { createAudit, viewports } from './acceptance-audit.mjs'
import {explicitConsentBoard} from './explicit-consent-board.mjs'
const output=process.env.PENNY_EVIDENCE
if(!output)throw new Error('PENNY_EVIDENCE must name the evidence directory.')
await mkdir(output,{recursive:true})
const runtime=await startBrowserRuntime(),{origin}=runtime
let browser
try{
async function api(path,body,headers={}){
 const r=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:origin,...headers},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'})
 if(!r.ok&&r.status!==302&&r.status!==303)throw new Error(`${path}: ${r.status} ${await r.text()}`)
 return r
}
const link=email=>{const value=runtime.outbox.findLast(message=>message.email===email);if(!value)throw new Error('No captured test-provider message');return value.url}
const signed=await api('/auth/bootstrap',{token:'synthetic-base-browser-setup-token-12345',displayName:'Browser Owner',returnTo:'/app'})
const cookie=signed.headers.get('set-cookie').split(';')[0]
const unique=Date.now().toString(36),board=`capture-${unique}`
await api('/api/operator/boards',{name:'Product feedback',slug:board,visibility:'public'},{Cookie:cookie})
await explicitConsentBoard(origin,board,cookie)
browser=await chromium.launch(browserOptions())
const captures=[],errors=[]
 for(const viewport of viewports){
  const {width}=viewport
  const requester=await browser.newContext({viewport}),operator=await browser.newContext({viewport})
  const requesterAudit=await createAudit(requester,origin,output,viewport),operatorAudit=await createAudit(operator,origin,output,viewport)
  const page=await requester.newPage(),review=await operator.newPage()
  await review.goto(origin+'/signin')
  await review.getByLabel('Operator email',{exact:true}).fill('owner@penny.invalid')
  await review.getByRole('button',{name:'Send sign-in link',exact:true}).click()
  await review.getByText('If your address is allowed, check your email for a sign-in link.',{exact:true}).waitFor()
  await review.goto(link('owner@penny.invalid'))
  await review.getByRole('button',{name:'Confirm',exact:true}).click()
  await review.waitForURL(origin+'/app')
  assert.ok((await operator.cookies()).some(c=>c.name.startsWith('operator_session_local')))
  const email=`capture-${unique}-${width}@example.test`
  await api('/api/public/identity/email',{email,displayName:'Review requester'})
  await page.goto(link(email))
  await page.getByRole('button',{name:'Verify email',exact:true}).click()
  await page.getByText('Email verified.',{exact:true}).waitFor()
  const token=await page.evaluate(()=>localStorage.getItem('penny_requester_session'))
  assert.ok(token)
  for(const p of [page,review])p.on('pageerror',()=>errors.push({kind:'pageerror',width}))
  async function shot(p,name){await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(200);const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw new Error(`${name} overflows at ${width}`);await (p===page?requesterAudit:operatorAudit).audit(p,name);const file=`${name}-${width}.png`;captures.push({file,width,url:p.url(),overflow:false,sha256:createHash('sha256').update(await readFile(`${output}/${file}`)).digest('hex')})}
  await page.goto(origin+'/portal/feedback/new')
  await page.getByLabel('Title',{exact:true}).fill(`Scheduled exports ${width} ${unique}`)
  await page.getByLabel('Problem description',{exact:true}).fill('We need a scheduled export for the monthly accountant handoff.')
  await page.locator('select[name=board]').selectOption(board)
  await page.getByRole('button',{name:'Send for review',exact:true}).click()
  await page.getByRole('heading',{name:'Feedback is awaiting review'}).waitFor()
  await shot(page,'submitted')
  const activity=await (await api('/api/public/requester/activity',undefined,{Authorization:`Bearer ${token}`})).json()
  const slug=activity.requests[0].slug
  await review.goto(origin+'/app/moderation')
  const card=review.locator('article').filter({has:review.getByRole('heading',{name:`Scheduled exports ${width} ${unique}`,exact:true})})
  await card.getByLabel('Public title',{exact:true}).fill(`Scheduled exports ${width} ${unique}`)
  await card.locator('textarea[name=description]').fill('Schedule a monthly export for your accountant.')
  await card.locator('select[name=boardSlug]').selectOption(board)
  await card.getByLabel('Approved display name',{exact:true}).first().fill('Reviewed requester')
  await card.getByRole('button',{name:'Approve and publish',exact:true}).click()
  await review.getByText('Approved wording is now public.').waitFor()
  await shot(review,'approve')
  await page.goto(origin+`/portal/feedback/${slug}`)
  // Submission records the author's vote; remove and restore it through the mounted controls.
  await page.getByRole('button',{name:'Remove vote',exact:true}).click()
  await page.getByText('Vote removed.',{exact:true}).waitFor()
  await page.getByRole('button',{name:'Vote',exact:true}).click()
  await page.getByText('Vote saved.',{exact:true}).waitFor()
  await shot(page,'vote')
  await page.getByRole('button',{name:'Follow',exact:true}).click()
  await page.getByText('Following with email permission.',{exact:true}).waitFor()
  await shot(page,'follow')
  await page.getByLabel('Add a comment',{exact:true}).fill('Monthly scheduling would remove a repeated manual step.')
  await page.getByRole('button',{name:'Send comment for review',exact:true}).click()
  await page.getByText('Your comment is awaiting review.',{exact:true}).waitFor()
  await shot(page,'comment')
  await review.reload()
  await card.getByText('Discussion, status and request controls',{exact:true}).click()
  const comment=card.locator('form').filter({has:review.getByRole('heading',{name:'Comment',exact:true})})
  await comment.getByLabel('Approved display name',{exact:true}).fill('Reviewed requester')
  await comment.getByRole('button',{name:'Approve comment',exact:true}).click()
  await comment.waitFor({state:'detached'})
  const status=card.locator('form').filter({has:review.getByRole('heading',{name:'Publish status update',exact:true})})
  await status.locator('select[name=status]').selectOption('under_review')
  await status.getByLabel('Public update',{exact:true}).fill('We are reviewing the monthly scheduling workflow.')
  await status.getByLabel('Pin above comments',{exact:true}).check()
  await status.getByRole('button',{name:'Publish status update',exact:true}).click()
  await page.reload();await page.getByText('We are reviewing the monthly scheduling workflow.',{exact:true}).waitFor()
  await page.getByText('Monthly scheduling would remove a repeated manual step.',{exact:true}).waitFor()
  await shot(page,'status')
  await page.goto(origin+'/portal/feedback/activity');await page.getByRole('heading',{name:`Scheduled exports ${width} ${unique}`,exact:true}).waitFor();await shot(page,'your-feedback')
  await page.goto(origin+'/portal/feedback');await page.getByLabel('Search feedback',{exact:true}).fill('Scheduled exports');await page.locator('select[name=status]').selectOption('under_review');await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByRole('heading',{name:`Scheduled exports ${width} ${unique}`,exact:true}).waitFor();await shot(page,'search-filter')
  await requesterAudit.finish('requester-board');await operatorAudit.finish('requester-board-operator')
  await requester.close();await operator.close()
 }
 if(errors.length)throw new Error('Unexpected browser page errors')
 await writeFile(`${output}/manifest.json`,JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),generatedAt:new Date().toISOString(),runtime:'Exact emitted production Start modules in workerd; actual Base operator auth; SendGrid HTTP fixture only; no hosted provider claim',captures,pageErrors:errors},null,2)+'\n')
 console.log(`Captured ${captures.length} verified browser states; no overflow or page errors.`)
} finally {await browser?.close();await runtime.close()}
