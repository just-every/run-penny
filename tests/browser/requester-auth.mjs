import assert from 'node:assert/strict'
import { startBrowserRuntime } from './base-runtime.mjs'
import { finishFirstRun } from './local-signin.mjs'

/** Real browser sign-in; only outbound synthetic email is intercepted by the runtime. */
export async function requesterAuth(browser) {
 const runtime=await startBrowserRuntime(),{origin}=runtime
 async function api(path,body,authority={},method=body===undefined?'GET':'POST') {
  const headers={Origin:origin,'Content-Type':'application/json'}
  let response
  if(typeof authority.fetch==='function') {
   const result=await authority.fetch(origin+path,{method,headers,...(body===undefined?{}:{data:body}),maxRedirects:0})
   response=new Response(await result.body(),{status:result.status(),headers:result.headers()})
  } else response=await fetch(origin+path,{method,headers:{...headers,...authority},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'})
  assert(response.ok||response.status===303,`${method} ${path}: ${response.status} ${await response.clone().text()}`)
  return response
 }
 // Installation custody uses the existing public bootstrap; its cookie is discarded.
 await api('/auth/bootstrap',{token:'synthetic-base-browser-setup-token-12345',displayName:'Review owner',returnTo:'/setup'})
 async function operator(width) {
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage()
  try {
   await page.goto(origin+'/signin')
   await page.getByRole('textbox',{name:'Operator email',exact:true}).fill('owner@penny.invalid')
   await page.getByRole('button',{name:'Send sign-in link',exact:true}).click()
   await page.getByRole('status').filter({hasText:'check your email'}).waitFor()
   const message=runtime.outbox.findLast(message=>message.email==='owner@penny.invalid')
   assert.ok(message,'synthetic mail edge received the operator link')
   await page.goto(message.url)
   await page.getByRole('button',{name:'Confirm',exact:true}).click()
   await page.waitForURL(url=>url.pathname==='/setup'||url.pathname.startsWith('/app'))
   await finishFirstRun(page,async()=>{})
   await page.waitForURL(url=>url.pathname.startsWith('/app'))
   return {context,page}
  } catch(error) {await context.close();throw error}
 }
 async function requester(width,email) {
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),cookies=[]
  page.on('response',response=>{if(response.headers()['set-cookie'])cookies.push(new URL(response.url()).pathname)})
  try {
   await page.goto(origin+'/portal/feedback/new')
   await page.getByLabel('Display name',{exact:true}).fill('Review requester')
   await page.getByLabel('Email',{exact:true}).fill(email)
   await page.getByRole('button',{name:'Send verification link',exact:true}).click()
   await page.getByText('Check your email for a verification link; it expires after 30 minutes.',{exact:true}).waitFor()
   const message=runtime.outbox.findLast(message=>message.email===email)
   assert.ok(message,'synthetic mail edge received the requester verification link')
   await page.goto(message.url)
   await page.getByRole('button',{name:'Verify email',exact:true}).click()
   await page.getByText('Email verified.',{exact:true}).waitFor()
   assert.equal(new URL(page.url()).hash,'','application removes the consumed link')
   const token=await page.evaluate(()=>localStorage.getItem('penny_requester_session'))
   assert.ok(token,'application created the browser-local requester session')
   const headers={Authorization:`Bearer ${token}`}
   assert.equal((await fetch(origin+'/api/public/identity/session',{headers})).status,200)
   assert.equal((await fetch(origin+'/api/operator/moderation',{headers})).status,401)
   assert.equal((await fetch(origin+'/api/public/identity/session')).status,401)
   assert.deepEqual(await context.cookies(),[]);assert.deepEqual(cookies,[])
   console.log(`requester-auth: ${width}px public verification, browser-local session, cookie-free, operator refusal 401, signed-out refusal 401`)
   return {context,page,token}
  } catch(error) {await context.close();throw error}
 }
 async function explicitConsentBoard(slug,authority) {
  const boards=await (await api('/api/public/boards')).json(),board=boards.find(board=>board.slug===slug)
  assert.ok(board?.subscriptionDisclosure)
  await api(`/api/operator/boards/${slug}/vote-subscriptions`,{enabled:false,version:board.subscriptionDisclosure.version},authority,'PUT')
 }
 async function sql(command) {
  const statements=command.split(';').map(value=>value.trim()).filter(Boolean)
  const results=await runtime.db.batch(statements.map(statement=>runtime.db.prepare(statement)))
  return results[0].results
 }
 return {runtime,origin,api,operator,requester,explicitConsentBoard,sql}
}
