import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {startBrowserRuntime} from './base-runtime.mjs'

export async function moderationJourney(name,journey){
 const output=resolve(process.env.PENNY_EVIDENCE??`../evidence/${name}`)
 assert.ok(!output.startsWith(resolve('.')+'/'))
 await mkdir(output,{recursive:true})
 const axe=await readFile(new URL('../../node_modules/axe-core/axe.min.js',import.meta.url),'utf8')
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 // Clause behavior runs once; route-review retains the shared 390px route smoke.
 try{const width=1440;{
  const runtime=await startBrowserRuntime(),contexts=[],errors=[]
  try{
   const {origin}=runtime
   async function send(path,body,headers={},method=body===undefined?'GET':'POST',expected=200){
    const response=await fetch(origin+path,{method,redirect:'manual',headers:{Origin:origin,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})})
    assert.equal(response.status,expected,`${method} ${path}: ${await response.clone().text()}`);return response
   }
   const json=async(...args)=>(await send(...args)).json()
   const boot=await send('/auth/bootstrap',{token:'synthetic-base-browser-setup-token-12345',displayName:'Maya Patel',returnTo:'/app'},{},'POST',303)
   const Cookie=boot.headers.get('set-cookie').split(';')[0],operator={Cookie}
   const finish=await fetch(origin+'/setup',{method:'POST',redirect:'manual',headers:{Origin:origin,Cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({confirm:'yes',companyName:'Harbor Analytics',postalAddress:'14 Market Street, Boston MA 02110',timezone:'America/New_York',quietEnabled:'yes',quietStart:'20',quietEnd:'8'})})
   assert.equal(finish.status,303)
   await json('/api/operator/boards',{slug:'finance',name:'Finance workflows',visibility:'public'},operator,'POST',201)
   const boards=await json('/api/public/boards'),version=boards.find(board=>board.slug==='finance').subscriptionDisclosure.version
   await json('/api/operator/boards/finance/vote-subscriptions',{enabled:false,version},operator,'PUT')
   async function person(email,displayName){
    await send('/api/public/identity/email',{email,displayName},{},'POST',202)
    const link=runtime.outbox.findLast(message=>message.email===email).url
    const token=new URLSearchParams(new URL(link).hash.slice(1)).get('token')
    return json('/api/public/identity/email/verify',{token})
   }
   async function pageFor({token,cookie}={}){
    const context=await browser.newContext({viewport:{width,height:width===390?844:900}});contexts.push(context)
    if(cookie){const at=cookie.indexOf('=');await context.addCookies([{name:cookie.slice(0,at),value:cookie.slice(at+1),url:origin}])}
    if(token)await context.addInitScript(value=>localStorage.setItem('penny_requester_session',value),token)
    const page=await context.newPage();page.setDefaultTimeout(20000)
    page.on('pageerror',error=>errors.push(error.message))
    page.on('request',request=>{if(/^https?:/.test(request.url())&&new URL(request.url()).origin!==origin)errors.push('External browser request')})
    return page
   }
   async function capture(page,label,region){
    await page.evaluate(async()=>{await document.fonts.ready})
    assert.equal(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth),false,`${label} fits ${width}`)
    await page.evaluate(axe)
    assert.deepEqual(await page.evaluate(async()=>(await window.axe.run(document)).violations.filter(item=>['serious','critical'].includes(item.impact))),[],`${label} accessible`)
    await page.screenshot({path:join(output,`${label}-${width}.png`),fullPage:true})
    if(region)await region.screenshot({path:join(output,`${label}-detail-${width}.png`)})
   }
   await journey({runtime,origin,width,operator,json,send,person,pageFor,capture})
   assert.deepEqual(errors,[])
   console.log(`${name}: ${width}px passed`)
  }finally{for(const context of contexts)await context.close();await runtime.close()}
 }}finally{await browser.close()}
}
