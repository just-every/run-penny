import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import {explicitConsentBoard} from './explicit-consent-board.mjs'
const origin='http://127.0.0.1:41869'
const state=process.env.PENNY_LOCAL_STATE
if(!state)throw new Error('PENNY_LOCAL_STATE must name the isolated capture store.')
const output='visual/requester-board'
await mkdir(output,{recursive:true})
async function api(path,body,headers={}){
 const r=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'})
 if(!r.ok&&r.status!==302)throw new Error(`${path}: ${r.status} ${await r.text()}`)
 return r
}
function outbox(email){
 if(!/^[a-z0-9@.-]+$/.test(email))throw new Error('Invalid fixture address')
 const raw=execFileSync('pnpm',['exec','wrangler','d1','execute','feedback-penny-local','--local','--persist-to',state,'--json','--command',`SELECT token FROM local_auth_outbox WHERE recipient='${email}' ORDER BY created_at DESC LIMIT 1`],{encoding:'utf8',stdio:['ignore','pipe','pipe']})
 const data=JSON.parse(raw.slice(raw.indexOf('[')))
 if(!data[0]?.results[0]?.token)throw new Error('Local fixture link was not issued')
 return data[0].results[0].token
}
await api('/api/auth/magic-link',{email:'owner@penny.invalid'})
const signed=await api(`/api/auth/magic-link/consume?token=${outbox('owner@penny.invalid')}`)
const cookie=signed.headers.get('set-cookie').split(';')[0]
const unique=Date.now().toString(36),board=`capture-${unique}`
await api('/api/operator/boards',{name:'Product feedback',slug:board,visibility:'public'},{Cookie:cookie})
await explicitConsentBoard(origin,board,cookie)
const browser=await chromium.launch({headless:true})
const captures=[],errors=[]
try{
 for(const width of [1440,390]){
  const requester=await browser.newContext({viewport:{width,height:1000}}),operator=await browser.newContext({viewport:{width,height:1000}})
  const [name,value]=cookie.split('=');await operator.addCookies([{name,value,url:origin,httpOnly:true,sameSite:'Lax'}])
  const email=`capture-${unique}-${width}@example.test`
  await api('/api/public/identity/email',{email,displayName:'Review requester'})
  const {token}=await (await api('/api/public/identity/email/verify',{token:outbox(email)})).json()
  await requester.addInitScript(token=>localStorage.setItem('penny_requester_session',token),token)
  const page=await requester.newPage(),review=await operator.newPage()
  for(const p of [page,review])p.on('pageerror',e=>errors.push(e.message))
  async function shot(p,name){await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(200);const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw new Error(`${name} overflows at ${width}`);const file=`${name}-${width}.jpg`;await p.screenshot({path:`${output}/${file}`,fullPage:true,type:'jpeg',quality:82});captures.push({file,width,url:p.url(),overflow:false})}
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
  await requester.close();await operator.close()
 }
 if(errors.length)throw new Error(errors.join('\n'))
 await writeFile(`${output}/manifest.json`,JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),generatedAt:new Date().toISOString(),runtime:'local workerd with isolated D1 and native local auth; no provider calls',captures,pageErrors:errors},null,2)+'\n')
 console.log(`Captured ${captures.length} verified browser states; no overflow or page errors.`)
} finally {await browser.close()}
