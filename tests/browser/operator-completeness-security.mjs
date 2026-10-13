import assert from 'node:assert/strict'
import {pacePublicContext} from './public-entry-pacing.mjs'
import {createServer} from 'node:http'
import {once} from 'node:events'
import {readFile,readdir} from 'node:fs/promises'
import {api} from './operator-completeness-auth.mjs'
import {proofId} from './operator-completeness-data.mjs'
async function parentServer(origin) {
 const server=createServer((request,response)=>{
  const path=new URL(request.url,'http://parent.test').searchParams.get('target')??'/'
  const target=new URL(path,origin)
  if(target.origin!==origin){response.writeHead(400);response.end();return}
  const src=target.href.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;')
  response.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'})
  response.end(`<html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Parent proof</title><style>body{margin:0}h1{margin:16px;font:24px sans-serif}iframe{display:block;width:100%;height:calc(100vh - 64px);border:0}</style></head><body><main><h1>Parent proof</h1><iframe title="Penny portal" src="${src}"></iframe></main></body></html>`)
 })
 server.listen(0,'127.0.0.1');await once(server,'listening')
 return {origin:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
}
async function navigateFrame({parent,parentOrigin,target,allowed,capture,label,width,axe}) {
 let blocked=false
 const onConsole=message=>{if(/frame-ancestors|Refused to frame|Refused to display/.test(message.text()))blocked=true}
 parent.on('console',onConsole)
 try {
  await parent.goto(`${parentOrigin}/?target=${encodeURIComponent(target.path)}`)
  const frame=await (await parent.locator('iframe').elementHandle()).contentFrame()
  assert.ok(frame,'[REQ-027] actual child browsing context exists')
  if(allowed) {
   await frame.locator('main h1').waitFor()
   await frame.waitForURL(url=>url.pathname.replace(/\/$/,'')===target.finalPath.replace(/\/$/,''))
   if(target.title)await frame.getByRole('heading',{name:target.title,exact:true}).waitFor()
   await frame.evaluate(async()=>{await document.fonts.ready})
   assert.equal(await frame.evaluate(()=>innerWidth),width,'[REQ-027] embedded viewport has the requested width')
   assert.equal(await frame.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth),false,`[REQ-027] ${target.path} iframe overflow at ${width}`)
   await frame.evaluate(axe)
   const violations=await frame.evaluate(async()=>(await window.axe.run(document)).violations.filter(row=>['serious','critical'].includes(row.impact)))
   assert.deepEqual(violations,[],`[REQ-027] ${target.path} iframe axe at ${width}`)
  }else {
   assert.equal(await frame.locator('main').count(),0,`[REQ-027] blocked parent cannot render ${target.path}`)
   assert.ok(blocked||frame.url()==='chrome-error://chromewebdata/',`[REQ-027] browser enforces frame denial for ${target.path}`)
  }
  await capture(label,parent)
 }finally{parent.off('console',onConsole)}
}
export async function reviewFrameOrigins({page,browser,origin,capture,width,db,runtime}) {
 const allowed=await parentServer(origin),denied=await parentServer(origin);let context
 try {
  // The completeness fixture starts unpublished; earlier rejection checks consume 00–04.
  const request=await db.prepare('SELECT slug FROM requests WHERE id=?').bind(proofId(1,55)).first()
  assert.ok(request?.slug,'[REQ-027] existing fixture request available for native publication')
  const title='Embedding proof feedback'
  assert.equal((await api(page,`/api/operator/moderation/${request.slug}`,{verdict:'approved',title,description:'Published feedback for the embedding journey.',boardSlug:'proof-board',displayName:'Proof requester'})).status(),200)
  const detail=`/portal/feedback/${request.slug}`
  const targets=[
   {name:'root',path:'/',finalPath:'/',title},
   {name:'portal-redirect',path:'/portal',finalPath:'/',title},
   {name:'portal-slash-redirect',path:'/portal/',finalPath:'/',title},
   {name:'feedback',path:'/portal/feedback?board=proof-board',finalPath:'/portal/feedback',title},
   {name:'feedback-slash',path:'/portal/feedback/',finalPath:'/portal/feedback',title},
   {name:'detail',path:detail,finalPath:detail,title},
   {name:'detail-slash',path:detail+'/',finalPath:detail,title},
   {name:'roadmap',path:'/portal/roadmap',finalPath:'/portal/roadmap'},
   {name:'updates',path:'/portal/updates',finalPath:'/portal/updates'},
  ]
  await page.goto(origin+'/app/settings')
  await page.getByLabel('Allowed parent origins',{exact:true}).fill(allowed.origin)
  const saved=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/operator/settings/frames'&&r.request().method()==='PUT')
  await page.getByRole('button',{name:'Save portal embedding',exact:true}).click()
  assert.equal((await saved).status(),200)
  await page.reload();assert.equal(await page.getByLabel('Allowed parent origins',{exact:true}).inputValue(),allowed.origin)
  await capture('REQ-027-persisted-frame-settings',page)
  context=await browser.newContext({viewport:{width,height:width===390?844:900},extraHTTPHeaders:{'CF-Connecting-IP':'198.51.100.40'}})
  await pacePublicContext(context,runtime,'198.51.100.40')
  const parent=await context.newPage()
  const axe=await readFile(new URL('../../node_modules/axe-core/axe.min.js',import.meta.url),'utf8')
  const navigate=options=>navigateFrame({parent,capture,width,axe,...options})
  for(const target of targets)for(const [permitted,server] of [[true,allowed],[false,denied]])
   await navigate({parentOrigin:server.origin,target,allowed:permitted,label:`REQ-027-${permitted?'allowed':'denied'}-iframe-${target.name}`})
  for(const value of ['*','https://example.test/path','https://user@example.test','http://example.test','null'])assert.equal((await api(page,'/api/operator/settings/frames',{publicOriginAllowlist:[value]},'PUT')).status(),400)
  // The operator's authenticated context proves private documents themselves refuse framing.
  const privateParent=await page.context().newPage()
  try{for(const path of ['/app/settings','/signin','/setup'])
   await navigateFrame({parent:privateParent,parentOrigin:allowed.origin,target:{path},allowed:false,capture,label:`REQ-027-private-iframe-${path.slice(1).replaceAll('/','-')}`,width,axe})
  }finally{await privateParent.close()}
  await page.getByLabel('Allowed parent origins',{exact:true}).fill('')
  const cleared=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/operator/settings/frames'&&r.request().method()==='PUT')
  await page.getByRole('button',{name:'Save portal embedding',exact:true}).click()
  assert.equal((await cleared).status(),200)
  await page.reload();assert.equal(await page.getByLabel('Allowed parent origins',{exact:true}).inputValue(),'')
  await capture('REQ-027-cleared-frame-settings',page)
  for(const target of targets)
   await navigate({parentOrigin:allowed.origin,target,allowed:false,label:`REQ-027-cleared-iframe-${target.name}`})
 }finally{await context?.close();await allowed.close();await denied.close()}
}
export async function reviewPublicRate({page,origin,db}) {
 const manifest=JSON.parse(await readFile(new URL('../../seed.json',import.meta.url),'utf8'))
 const allowance=manifest.limits.publicReadRequestsPerMinutePerIp,scope='public_entry'
 assert.ok(Number.isSafeInteger(allowance)&&allowance>0&&scope,'Read actual entry policy without importing app aliases')
 const ip='198.51.100.201',options={headers:{'CF-Connecting-IP':ip}}
 let denied=false
 for(let count=0;count<=allowance;count++) {
  const response=await page.context().request.get(origin+'/api/public/boards?rate-proof='+count,options)
  if(response.status()===429){denied=true;break}
  assert.equal(response.status(),200,'[BASE-ACCESS-003] normal admission before exhaustion')
 }
 assert.equal(denied,true,'[BASE-ACCESS-003] actual configured allowance exhausted')
 const asset=(await readdir('dist/client/assets')).find(file=>/\.(js|css)$/.test(file)),font=(await readdir('dist/client/fonts')).find(file=>/\.woff2?$/.test(file))
 assert.ok(asset&&font,'[BASE-ACCESS-003] emitted actual assets and font available')
 for(const path of [`/assets/${asset}`,`/fonts/${font}`])assert.equal((await page.context().request.get(origin+path,{headers:{'CF-Connecting-IP':'198.51.100.203'}})).status(),200,'[BASE-ACCESS-003] real emitted bytes normally readable')
 const representativePrefixes={'/assets/':`/assets/${asset}`,'/fonts/':`/fonts/${font}`,'/brand/':'/brand/penny-mark.svg','/api/public/requests/':'/api/public/requests/proof-request-00','/api/public/roadmap/':'/api/public/roadmap/proof-roadmap-00','/api/public/releases/':'/api/public/releases/proof-release-00','/portal/':'/portal/feedback','/docs/':'/docs/data-ownership','/_serverFn/':'/_serverFn/rate-proof'}
 const declared=manifest.deploy.publicPaths.map(path=>representativePrefixes[path]??path)
 for(const path of declared)for(const method of ['GET','HEAD','OPTIONS']) {
  const response=await page.context().request.fetch(origin+path,{...options,method})
  assert.equal(response.status(),429,`[BASE-ACCESS-003] Worker admission before read/asset ${method} ${path}`)
 }
 assert.equal((await page.context().request.get(origin+'/api/public/boards',{headers:{'CF-Connecting-IP':'198.51.100.202'}})).status(),200,'second ingress client proceeds')
 // Move only this test fixture's limiter window; no sleeps or fake endpoints.
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip))
 const subject=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')
 await db.prepare('UPDATE penny_public_admission SET expires_at=? WHERE scope=? AND subject_hash=?').bind('2000-01-01T00:00:00.000Z',scope,subject).run()
 assert.equal((await page.context().request.get(origin+'/api/public/boards',options)).status(),200,'[BASE-ACCESS-003] expired real bucket admits next window')
 await db.prepare("CREATE TRIGGER browser_rate_storage_failure BEFORE INSERT ON penny_public_admission BEGIN SELECT RAISE(ABORT,'test storage refusal'); END").run()
 try{assert.equal((await page.context().request.get(origin+'/api/public/boards',{headers:{'CF-Connecting-IP':'198.51.100.204'}})).status(),503,'[BASE-ACCESS-003] actual limiter storage failure refuses admission')}finally{await db.prepare('DROP TRIGGER browser_rate_storage_failure').run()}
}
export async function reviewDestructionAudit({page,db,origin,capture}) {
 assert.equal((await api(page,'/api/operator/boards/proof-board',{archived:true},'PATCH')).status(),200,'[BASE-OPS-005] real board archive route succeeds')
 const audit=await db.prepare("SELECT action,actor_type,actor_id,entity_id,occurred_at FROM audit_entries WHERE action='board.archived' AND entity_id=?").bind(proofId(8)).first()
 assert.equal(audit?.actor_type,'operator');assert.equal(audit?.entity_id,proofId(8));assert.ok(audit.actor_id&&Number.isFinite(Date.parse(audit.occurred_at)))
 await page.goto(origin+'/app/settings');await capture('BASE-OPS-005-archived-board',page)
 await db.prepare("CREATE TRIGGER browser_audit_storage_failure BEFORE INSERT ON audit_entries BEGIN SELECT RAISE(ABORT,'test audit refusal'); END").run()
 try {
  const failed=await api(page,'/api/operator/boards/peer-operation',{archived:true},'PATCH')
  assert.ok(failed.status()>=500,'[BASE-OPS-005] failed audit insertion prevents destructive success')
  const retained=await db.prepare("SELECT archived_at FROM boards WHERE slug='peer-operation'").first()
  assert.equal(retained.archived_at,null,'[BASE-OPS-005] no unaudited board archive remains')
 }finally{await db.prepare('DROP TRIGGER browser_audit_storage_failure').run()}
}
