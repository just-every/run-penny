import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
const root=process.cwd(), req=createRequire(join(root,'package.json'))
const {chromium}=req('@playwright/test')
const load=path=>import(pathToFileURL(join(root,path)))
const {startBrowserRuntime}=await load('tests/browser/base-runtime.mjs')
const {browserOptions}=await load('tests/browser/browser-options.mjs')
const {reviewStatusDrafts}=await load('tests/browser/operator-pages-status.mjs')
const {seedOverviewAttention,duplicateOverviewAttention}=await load('tests/browser/operator-pages-data.mjs')
const {finishFirstRun}=await load('tests/browser/local-signin.mjs')
const {pacePublicContext,pacePublicPhase}=await load('tests/browser/public-entry-pacing.mjs')
const output=resolve(process.env.PENNY_EVIDENCE)
await mkdir(output,{recursive:true})
const axe=await readFile(join(root,'node_modules/axe-core/axe.min.js'),'utf8')
const receipt={source:'89d5997b2ba55fb4637552fc2c656bcced2bcc15',started_at:new Date().toISOString(),entry:'Existing reviewStatusDrafts exported by tests/browser/operator-pages-status.mjs; isolated native setup outside product checkout',checks:[],refusals:[],declineObservations:[],errors:[]}
let browser
try {
 browser=await chromium.launch(browserOptions())
 for(const width of [1440,390]) {
  const runtime=await startBrowserRuntime({bindings:{WORKSPACE_TIMEZONE:'Australia/Brisbane'}})
  let context
  try {
   const {origin,db}=runtime
   const bootstrap=await fetch(origin+'/auth/bootstrap',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({token:'synthetic-base-browser-setup-token-12345',displayName:'Owner',returnTo:'/app'}),redirect:'manual'})
   assert.equal(bootstrap.status,303)
   const pair=bootstrap.headers.get('set-cookie').split(';')[0],split=pair.indexOf('=')
   context=await browser.newContext({viewport:{width,height:width===390?844:900},timezoneId:'Australia/Brisbane',extraHTTPHeaders:{'CF-Connecting-IP':width===390?'198.51.100.10':'198.51.100.11'}})
   await pacePublicContext(context,runtime,width===390?'198.51.100.10':'198.51.100.11')
   await context.addCookies([{name:pair.slice(0,split),value:pair.slice(split+1),url:origin,httpOnly:true,sameSite:'Lax'}])
   const page=await context.newPage(),errors=[],external=[]
   page.on('pageerror',error=>errors.push(error.message.replace(/https?:\/\/[^\s)]+/g,'[local URL]')))
   page.on('console',message=>{if(message.type()==='error')errors.push(message.text().replace(/https?:\/\/[^\s)]+/g,'[local URL]'))})
   page.on('request',request=>{if(new URL(request.url()).origin!==origin)external.push(new URL(request.url()).origin)})
   const goto=async path=>{const response=await page.goto(origin+path);assert.equal(response.status(),200);await page.locator('main h1').waitFor()}
   await goto('/setup');await finishFirstRun(page,async()=>{})
   await seedOverviewAttention(db);await duplicateOverviewAttention(db)
   const post=(path,data)=>context.request.post(origin+path,{data,headers:{Origin:origin}})
   const firstResponse=await post('/api/operator/requests',{title:'Monthly reporting request',description:'Finish monthly reports accurately.',boardSlug:'attention-board',evidenceIds:[]})
   assert.equal(firstResponse.status(),201)
   const first=await firstResponse.json()
   assert.equal((await post(`/api/operator/moderation/${first.slug}`,{verdict:'approved',title:'Monthly reporting request',description:'Finish monthly reports accurately.',boardSlug:'attention-board',displayName:'Owner'})).status(),200)
   const state=async()=>{
    const tables=['roadmap_update_versions','roadmap_update_histories','roadmap_update_targets','roadmap_update_contexts','notification_events','notification_intents']
    return Object.fromEntries(await Promise.all(tables.map(async table=>[table,(await db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results])))
   }
   let triedRefusals=false
   const capture=async(label,targetPage=page)=>{
    if(label==='stale-status-drafts'&&!triedRefusals) {
     const before=await state()
     const anonymous=await fetch(origin+'/api/operator/roadmap-updates/attention-update/publish',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'})
     assert.equal(anonymous.status,401)
     const stale=await post('/api/operator/roadmap-updates/attention-update/publish',{})
     assert.equal(stale.status(),409)
     assert.deepEqual(await state(),before,'refused anonymous and stale publication retain all publication data')
     receipt.refusals.push({width,anonymous:anonymous.status,stale:stale.status(),unchangedPublicationState:true})
     triedRefusals=true
    }
    await targetPage.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))})
    assert.equal(await targetPage.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth),false,`${label} overflow`)
    await targetPage.evaluate(axe)
    const violations=await targetPage.evaluate(async()=>(await window.axe.run(document)).violations.filter(row=>['serious','critical'].includes(row.impact)))
    assert.deepEqual(violations,[])
    await targetPage.screenshot({path:join(output,`${label}-${width}.png`),fullPage:true})
    receipt.checks.push({width,label,seriousCriticalAxe:0,overflow:false})
    await pacePublicPhase(targetPage)
   }
   await reviewStatusDrafts({page,db,goto,capture})
   // Observe the full clause's decline arm through its existing public route.
   // This reports native behavior; it adds no source test or product criterion.
   const draftCount=async()=>Number((await db.prepare('SELECT COUNT(*) n FROM roadmap_update_versions').first()).n)
   const priorCount=await draftCount()
   const declined=await post(`/api/operator/requests/${first.slug}/status-updates`,{status:'declined',body:'Monthly reporting is being replaced by the new reporting workflow.'})
   assert.equal(declined.status(),200)
   const declinedDetail=await (await context.request.get(origin+`/api/public/requests/${first.slug}`)).json()
   const persisted=(await db.prepare("SELECT public_status,body,published_at FROM request_status_updates WHERE request_id=? AND public_status='declined'").bind(first.id).all()).results
   receipt.declineObservations.push({width,httpStatus:declined.status(),publicStatus:declinedDetail.status,roadmapDraftCountBefore:priorCount,roadmapDraftCountAfter:await draftCount(),publishedDeclineRows:persisted.length,allDeclineRowsImmediatelyPublished:persisted.every(row=>row.published_at!==null),reasonVisibleInPublicHistory:declinedDetail.statusUpdates.some(row=>row.body==='Monthly reporting is being replaced by the new reporting workflow.')})
   assert.deepEqual(errors,[]);assert.deepEqual(external,[])
   console.log(`ROAD-007 native browser width=${width}: existing journey passed; decline observation recorded`)
  } finally {try{await context?.close()}finally{await runtime.close()}}
 }
 receipt.status='passed'
} catch(error) {
 receipt.status='failed';receipt.errors.push(String(error).replace(/https?:\/\/[^\s)]+/g,'[local URL]'));throw error
} finally {
 try{await browser?.close()}finally{receipt.finished_at=new Date().toISOString();await writeFile(join(output,'browser-receipt.json'),JSON.stringify(receipt,null,2)+'\n')}
}
