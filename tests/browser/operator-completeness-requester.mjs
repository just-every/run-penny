import assert from 'node:assert/strict'
import {proofId} from './operator-completeness-data.mjs'
import {gate} from './operator-completeness-auth.mjs'
import {generatedOperatorTransport,generatedHeaders} from './operator-completeness-transport.mjs'
export async function reviewRequesterPrivacy({browser,origin,width,capture}) {
 const context=await browser.newContext({viewport:{width,height:width===390?844:900},extraHTTPHeaders:{'CF-Connecting-IP':'198.51.100.50'}})
 try {
  const page=await context.newPage()
  await page.goto(origin+'/portal/feedback/new')
  await page.getByLabel('Display name',{exact:true}).fill('Privacy proof requester')
  await page.getByLabel('Email',{exact:true}).fill('privacy-proof-requester@example.test')
  const requested=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/public/identity/email'&&r.request().method()==='POST')
  await page.getByRole('button',{name:'Send verification link',exact:true}).click()
  assert.equal((await requested).status(),202)
  await gate(page,origin)
  await page.getByRole('link',{name:'Read message',exact:true}).first().click()
  await page.getByRole('link',{name:'Open this link',exact:true}).click()
  await page.getByRole('button',{name:'Verify email',exact:true}).click()
  await page.getByText('Email verified.',{exact:true}).waitFor()
  const token=await page.evaluate(()=>localStorage.getItem('penny_requester_session'))
  assert.ok(token,'[OPS-004] real requester authority issued')
  const headers={Authorization:`Bearer ${token}`}
  assert.equal((await context.request.get(origin+'/api/public/identity/session',{headers})).status(),200)
  for(const path of ['/api/operator/search?q=privateproof','/api/operator/accounts',`/api/operator/custom-fields/account/${proofId(6)}`,'/app/search']) {
   const response=await context.request.get(origin+path,{headers,maxRedirects:0})
   assert.ok([302,303,401].includes(response.status()),'[OPS-004 DATA-004] genuine requester cannot read private surface')
   assert.doesNotMatch(await response.text(),/privateproof|customproof/)
  }
  const generated=await context.request.get(origin+await generatedOperatorTransport(),{headers:{...generatedHeaders(origin),...headers}})
  assert.doesNotMatch(await generated.text(),/privateproof|customproof/,'[OPS-004 DATA-004] requester generated private read denied')
  await page.goto(origin+'/portal/feedback')
  await capture('OPS-004-requester-public-boundary',page)
 }finally{await context.close()}
}
