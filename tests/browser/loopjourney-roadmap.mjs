import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { form, save, requestTitle } from './loopjourney-steps.mjs'
export async function approveRoadmap(operator,requester,runtime,audit,commit,requestSlug) {
 const {origin}=runtime
 await operator.goto(origin+'/app/roadmap',{waitUntil:'networkidle'})
 await operator.getByText('Edit, approve or move',{exact:true}).click()
 const approval=form(operator,'Approve public projection')
 const contextResponse=await operator.request.get(origin+`/api/operator/roadmap/${commit.itemId}/context`)
 assert.equal(contextResponse.status(),200,'[ROAD-004] selected bet context is available')
 const context=await contextResponse.json()
 assert.deepEqual(context.proposed.map(({slug,title})=>({slug,title})),[{slug:requestSlug,title:requestTitle}],'[ROAD-004] proposes the selected bet’s linked published request before mapping')
 const suggestion=approval.getByText(`Suggestions from the selected bet: ${requestTitle}. Select each mapping to approve it.`,{exact:true})
 await suggestion.waitFor()
 assert.equal(await suggestion.count(),1,'[ROAD-004] the selected request suggestion is displayed before manual approval')
 await approval.getByLabel('Approved title',{exact:true}).fill('See onboarding progress')
 await approval.getByLabel('Approved summary',{exact:true}).fill('See each onboarding step and understand what needs attention.')
 await approval.getByLabel('Public board',{exact:true}).selectOption('onboarding')
 await approval.getByLabel(requestTitle,{exact:true}).check()
 await audit(operator,'E.1-public-wording-and-mapping')
 const started=performance.now()
 await save(operator,approval,'Approve wording and selected mappings',`/api/operator/roadmap/${commit.itemId}/approve`)
 const apiStarted=performance.now()
 let publicRequest,apiMs,ssrMs
 while(performance.now()-started<=5000){
  const response=await requester.request.get(origin+`/api/public/requests/${requestSlug}`)
  assert.equal(response.status(),200,'[ROAD-006] approved public request remains readable')
  publicRequest=await response.json()
  if(publicRequest.status==='planned'||publicRequest.publicState==='planned'){apiMs=performance.now()-started;break}
  await new Promise(r=>setTimeout(r,50))
 }
 assert.ok(apiMs!==undefined&&apiMs<=5000,'[ROAD-006] public request API reflects Planned within 5 seconds after approval')
 const document=await requester.request.get(origin+`/portal/feedback/${requestSlug}`)
 assert.equal(document.status(),200,'[ROAD-006] public request SSR remains available')
 assert.match(await document.text(),/Planned/,'[ROAD-006] public request SSR contains Planned')
 ssrMs=performance.now()-started
 assert.ok(ssrMs<=5000,'[ROAD-006] SSR projection appears within 5 seconds of approval')
 await requester.goto(origin+`/portal/feedback/${requestSlug}`,{waitUntil:'domcontentloaded'})
 await requester.getByText('Planned',{exact:true}).first().waitFor()
 const domMs=performance.now()-started
 assert.ok(domMs<=5000,'[ROAD-006] requester DOM shows Planned within 5 seconds of approval')
 const text=await requester.locator('body').innerText()
 for(const privateText of ['Internal rationale','Weekly onboarding digest','Local interview participant'])assert.equal(text.includes(privateText),false,'[ROAD-006] public projection excludes internal context')
 await audit(requester,'E.1-public-request-Planned')
 // Public roadmap identity is the publication's opaque slug, never the internal item slug.
 const published=(await (await requester.request.get(origin+'/api/public/roadmap')).json()).find(item=>item.title==='See onboarding progress')
 assert.ok(published,'[ROAD-004] approved item is on the public roadmap')
 assert.notEqual(published.slug,commit.slug,'[ROAD-006] public roadmap identity is not the internal item slug')
 await requester.goto(origin+`/portal/roadmap/${published.slug}`,{waitUntil:'networkidle'})
 await requester.getByRole('heading',{name:'See onboarding progress',exact:true}).waitFor()
 await audit(requester,'E.1-approved-public-roadmap-detail')
 return {apiMs,ssrMs,domMs,measurement:'Node monotonic performance.now starts immediately before approval UI click',apiPollingStartedMs:apiStarted-started}
}
export async function moveRoadmap(operator,origin,audit,commit,status) {
 await operator.goto(origin+'/app/roadmap',{waitUntil:'networkidle'})
 await operator.getByText('Edit, approve or move',{exact:true}).click()
 const move=form(operator,'Move roadmap item')
 await move.getByLabel('New status',{exact:true}).selectOption(status)
 await move.getByLabel('Reason',{exact:true}).fill(status==='in_progress'?'The team has started the committed dashboard.':'The committed dashboard is available to customers.')
 await audit(operator,`E.1-move-${status}-form`)
 await save(operator,move,'Record move',`/api/operator/roadmap/${commit.itemId}/move`)
 await audit(operator,`E.1-roadmap-${status}`)
}
