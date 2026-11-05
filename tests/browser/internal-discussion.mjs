import assert from 'node:assert/strict'
import { mkdir,readFile } from 'node:fs/promises'
import { resolve,join } from 'node:path'
import { chromium } from '@playwright/test'
import { browserOptions } from './browser-options.mjs'
import { startBrowserRuntime } from './base-runtime.mjs'
import { finishFirstRun } from './local-signin.mjs'
const output=resolve(process.env.PENNY_EVIDENCE??'../evidence/internal-discussion')
assert.ok(!output.startsWith(resolve('.')+'/'))
await mkdir(output,{recursive:true})
const axe=await readFile(new URL('../../node_modules/axe-core/axe.min.js',import.meta.url),'utf8')
process.env.PENNY_BROWSER_EXECUTABLE??=chromium.executablePath()
let browser
try{
 browser=await chromium.launch(browserOptions())
 // Exercise the discussion once; capture its same saved state at both widths.
 const width=1440;{
  const runtime=await startBrowserRuntime();let context
  try{
   const {origin}=runtime
   async function send(path,body,cookie,expected=200){const response=await fetch(origin+path,{method:body===undefined?'GET':'POST',redirect:'manual',headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});assert.equal(response.status,expected,path);return response}
   const bootstrap=await send('/auth/bootstrap',{token:'synthetic-base-browser-setup-token-12345',displayName:'Owner',returnTo:'/app'},null,303)
   const cookie=bootstrap.headers.get('set-cookie').split(';')[0]
   context=await browser.newContext({viewport:{width,height:900}})
   const split=cookie.indexOf('=');await context.addCookies([{name:cookie.slice(0,split),value:cookie.slice(split+1),url:origin}])
   const page=await context.newPage();page.setDefaultTimeout(15000)
   page.on('response',response=>{if(response.url().includes('/api/operator/discussion')&&!response.ok())console.log(new URL(response.url()).pathname,response.status())})
   async function audit(target,label){
    try{for(const width of [1440,390]){
     await target.setViewportSize({width,height:900})
     assert.equal(await target.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
     await target.evaluate(axe)
     assert.deepEqual(await target.evaluate(async()=> (await window.axe.run(document)).violations.filter(row=>['serious','critical'].includes(row.impact))),[])
     await target.screenshot({path:join(output,`${label}-${width}.png`),fullPage:true})
     if(label==='threaded-internal-notes')await target.getByRole('region',{name:'Internal notes',exact:true}).screenshot({path:join(output,`notes-detail-${width}.png`)})
     if(label==='durable-mention')await target.getByRole('region',{name:'Your mentions',exact:true}).screenshot({path:join(output,`mentions-detail-${width}.png`)})
    }}finally{await target.setViewportSize({width,height:900})}
   }
   await page.goto(origin+'/setup');await finishFirstRun(page,audit)
   await send('/api/operator/boards',{slug:'discussion',name:'Discussion',visibility:'public'},cookie,201)
   const request=await (await send('/api/operator/requests',{title:'Schedule monthly finance exports',description:'Finance needs a CSV before its monthly review.',boardSlug:'discussion'},cookie,201)).json()
   await send(`/api/operator/moderation/${request.slug}`,{verdict:'approved',title:'Schedule monthly finance exports',description:'Finance needs a CSV before its monthly review.',boardSlug:'discussion',displayName:'Owner'},cookie)
   const operators=await (await send('/api/operator/discussion/operators',undefined,cookie)).json()
   await page.goto(origin+`/app/moderation?item=${request.id}`)
   const notes=page.getByRole('region',{name:'Internal notes',exact:true})
   const noteBody='Please confirm whether finance needs scheduled exports or an on-demand download.'
   const commentBody='We are exploring scheduled monthly exports for your finance team.'
   await notes.getByLabel('Add an internal note',{exact:true}).fill(noteBody)
   await notes.getByRole('checkbox',{name:'@'+operators.operators[0].displayName,exact:true}).check()
   const noteSaved=page.waitForResponse(response=>response.url().endsWith(`/api/operator/discussion/requests/${request.slug}/notes`)&&response.request().method()==='POST')
   await notes.getByRole('button',{name:'Save note',exact:true}).click()
   const noteResponse=await noteSaved;assert.equal(noteResponse.status(),201)
   const note=await noteResponse.json();assert.ok(note.id)
   try{await notes.getByText(noteBody,{exact:true}).waitFor()}catch(error){await page.screenshot({path:join(output,`failure-${width}.png`),fullPage:true});throw error}
   await notes.getByRole('button',{name:'Reply',exact:true}).click()
   await notes.getByLabel('Internal reply',{exact:true}).fill('Maya confirmed a scheduled monthly CSV would remove the manual reporting step.')
   await notes.getByRole('button',{name:'Save note',exact:true}).click()
   await notes.getByText('Maya confirmed a scheduled monthly CSV would remove the manual reporting step.',{exact:true}).waitFor()
   const card=page.locator(`[id="request-${request.slug}"]`)
   await card.getByText('Discussion, status and request controls',{exact:true}).click()
   await card.getByLabel('Operator comment',{exact:true}).fill(commentBody)
   const commentSaved=page.waitForResponse(response=>response.url().endsWith(`/api/operator/requests/${request.slug}/comments`)&&response.request().method()==='POST')
   await card.getByRole('button',{name:'Post public comment',exact:true}).click()
   const commentResponse=await commentSaved;assert.equal(commentResponse.status(),201)
   const comment=await commentResponse.json();assert.ok(comment.id);assert.notEqual(comment.id,note.id)
   async function distinctDiscussion(){
    await notes.locator(`[id="note-${note.id}"]`).getByText(noteBody,{exact:true}).waitFor()
    assert.equal(await notes.getByText(commentBody,{exact:true}).count(),0)
    const publicComment=card.getByText(commentBody,{exact:true})
    await publicComment.waitFor()
    assert.equal(await publicComment.evaluate(element=>element.closest('[aria-label="Internal notes"]')===null),true)
    const context=await (await send(`/api/operator/requests/${request.slug}/context`,undefined,cookie)).json()
    assert.equal(context.requestId,request.id)
    assert.deepEqual(context.notes.map(({id,body,parent_note_id})=>({id,body,parent_note_id})).find(row=>row.id===note.id),{id:note.id,body:noteBody,parent_note_id:null})
    assert.deepEqual(context.comments.map(({id,body})=>({id,body})),[{id:comment.id,body:commentBody}])
    assert.equal(context.notes.some(row=>row.id===comment.id||row.body===commentBody),false)
    assert.equal(context.comments.some(row=>row.id===note.id||row.body===noteBody),false)
    return {notes:context.notes,comments:context.comments}
   }
   const savedDiscussion=await distinctDiscussion()
   const publicRequest=await (await send(`/api/public/requests/${request.slug}`)).json()
   assert.deepEqual(publicRequest.comments.map(({id,body,author})=>({id,body,kind:author.kind})),[{id:comment.id,body:commentBody,kind:'operator'}])
   for(const privateText of [noteBody,'Maya confirmed a scheduled monthly CSV would remove the manual reporting step.',note.id])assert.equal(JSON.stringify(publicRequest).includes(privateText),false)
   await audit(page,'threaded-internal-notes')
   await page.reload()
   assert.deepEqual(await distinctDiscussion(),savedDiscussion)
   const mentions=page.getByRole('region',{name:'Your mentions',exact:true})
   await mentions.getByText(noteBody,{exact:true}).waitFor()
   assert.equal(await mentions.getByRole('button',{name:'Dismiss mention',exact:true}).count(),1)
   await audit(page,'durable-mention')
   await mentions.getByRole('button',{name:'Dismiss mention',exact:true}).click()
   await mentions.getByText('No new mentions.',{exact:true}).waitFor()
   await page.reload();await mentions.getByText('No new mentions.',{exact:true}).waitFor()
   assert.deepEqual(await distinctDiscussion(),savedDiscussion)
   console.log('PROBE REQ-032 point 1: approved request, native note and public comment controls -> distinct labelled note and separate operator comment; identities and wording persist after reload; public read contains only the comment')
  }finally{await context?.close();await runtime.close()}
 }
}finally{await browser?.close()}
